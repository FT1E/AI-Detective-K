import { Router } from "express";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * Ingest route for camera frames.
 * POST /api/ingest/frame
 *
 * Accepts JSON:
 * {
 *   camera_id?: string,
 *   frame_id?: string,
 *   timestamp?: number|string,
 *   frame_index?: number,
 *   canvas_size?: { width, height },
 *   detections: [ { track_id?, id?, label, confidence, bbox_px?, bbox_norm?, bbox?, centroid?, ... } ],
 *   rgb_base64: string,
 *   depth_base64?: string,
 *   extra?: {}
 * }
 *
 * Returns:
 * { ui_display: {...}, chatbot_payload: {...} }
 *
 * Optional security: set INGEST_API_KEY in env and send header `x-api-key`.
 */

// Configuration
const CONFIDENCE_THRESHOLD = 0.4;
const THUMBNAIL_MAX_PX = 128;
const FRAME_PREVIEW_WIDTH = 640;
const SUDDEN_MOTION_THRESHOLD = 0.15;

// In-memory tracking state (per camera); ephemeral — resets on restart.
const previousTrackIds = {}; // cameraId -> Set(trackId)
const previousCentroids = {}; // cameraId -> { trackId: [cx,cy] }

/* ---------- Helpers ---------- */

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function computeCentroid(bboxNorm) {
  // bboxNorm = [x_min, y_min, x_max, y_max]
  return [(bboxNorm[0] + bboxNorm[2]) / 2, (bboxNorm[1] + bboxNorm[3]) / 2];
}

function centroidDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function stripDataUriPrefix(b64) {
  if (!b64 || typeof b64 !== "string") return "";
  const idx = b64.indexOf(",");
  if (idx !== -1 && idx < 100) return b64.slice(idx + 1);
  return b64;
}

async function decodeImage(b64) {
  try {
    const buf = Buffer.from(stripDataUriPrefix(b64), "base64");
    const meta = await sharp(buf).metadata();
    return { buffer: buf, width: meta.width, height: meta.height };
  } catch (e) {
    return null;
  }
}

async function imageToDataUri(buf, maxDim) {
  let pipeline = sharp(buf);
  if (maxDim) {
    pipeline = pipeline.resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
    });
  }
  const jpeg = await pipeline.jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function cropThumbnail(imgBuf, imgW, imgH, bboxNorm) {
  try {
    const left = Math.round(clamp(bboxNorm[0]) * imgW);
    const top = Math.round(clamp(bboxNorm[1]) * imgH);
    const right = Math.round(clamp(bboxNorm[2]) * imgW);
    const bottom = Math.round(clamp(bboxNorm[3]) * imgH);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (width <= 0 || height <= 0) return null;
    const cropped = await sharp(imgBuf)
      .extract({ left, top, width, height })
      .resize({
        width: THUMBNAIL_MAX_PX,
        height: THUMBNAIL_MAX_PX,
        fit: "inside",
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${cropped.toString("base64")}`;
  } catch {
    return null;
  }
}

function normalizeBbox(det, canvasW, canvasH) {
  // Accept several bbox representations and convert to normalized [x1,y1,x2,y2]
  if (Array.isArray(det.bbox_norm) && det.bbox_norm.length === 4) {
    return det.bbox_norm.map((v) => clamp(v));
  }
  if (Array.isArray(det.bbox_px) && canvasW && canvasH) {
    const [x, y, w, h] = det.bbox_px;
    return [
      clamp(x / canvasW),
      clamp(y / canvasH),
      clamp((x + w) / canvasW),
      clamp((y + h) / canvasH),
    ];
  }
  if (Array.isArray(det.bbox) && det.bbox.length === 4 && canvasW && canvasH) {
    const [a, b, c, d] = det.bbox;
    // If bbox provided in pixel coords (values > 1) convert
    if (det.bbox.some((v) => v > 1)) {
      return [
        clamp(a / canvasW),
        clamp(b / canvasH),
        clamp(c / canvasW),
        clamp(d / canvasH),
      ];
    }
    return det.bbox.map((v) => clamp(v));
  }
  return null;
}

function requireApiKey(req, res) {
  const required = process.env.INGEST_API_KEY;
  if (!required) return true; // no key configured
  const provided =
    req.headers["x-api-key"] ||
    req.headers["X-API-KEY"] ||
    req.headers["x-api-key".toUpperCase()];
  if (!provided || provided !== required) {
    res.status(401).json({ detail: "Unauthorized" });
    return false;
  }
  return true;
}

/* ---------- Route: POST /ingest/frame ---------- */

router.post("/ingest/frame", async (req, res) => {
  // Optional API key guard
  if (!requireApiKey(req, res)) return;

  const {
    detections = [],
    rgb_base64 = "",
    depth_base64 = "",
    canvas_size = null,
    camera_id: camIdRaw = "cam-1",
    frame_index = null,
    timestamp = null,
    frame_id = null,
    extra = null,
  } = req.body || {};

  const camId = String(camIdRaw || "cam-1");

  // Resolve timestamp
  const nowIso = new Date().toISOString();
  let tsIso;
  if (timestamp) {
    if (typeof timestamp === "number") {
      tsIso = new Date(timestamp * 1000).toISOString();
    } else {
      try {
        tsIso = new Date(String(timestamp)).toISOString();
      } catch {
        tsIso = nowIso;
      }
    }
  } else {
    tsIso = nowIso;
  }

  // Snapshot id (prefer provided frame_id)
  const snapshotId =
    frame_id ||
    `f_${tsIso.replace(/[-:T.]/g, "").slice(0, 14)}_${uuidv4().slice(0, 6)}`;

  // Basic validation
  const errors = [];
  if (!Array.isArray(detections)) errors.push("detections must be an array");
  if (!rgb_base64) errors.push("rgb_base64 missing or empty");
  if (errors.length > 0) {
    const errMsg = errors.join("; ");
    return res.status(400).json({
      ui_display: { error: errMsg },
      chatbot_payload: { error: errMsg },
    });
  }

  // Decode RGB image (best-effort)
  const rgbImg = await decodeImage(rgb_base64);
  let canvasW = canvas_size?.width || null;
  let canvasH = canvas_size?.height || null;
  if (rgbImg && !canvasW) {
    canvasW = rgbImg.width;
    canvasH = rgbImg.height;
  }

  let framePreview = null;
  let rgbDecodeError = null;
  if (rgbImg) {
    try {
      framePreview = await imageToDataUri(rgbImg.buffer, FRAME_PREVIEW_WIDTH);
    } catch {
      framePreview = null;
    }
  } else {
    rgbDecodeError = "Failed to decode rgb_base64";
  }

  // Prepare per-camera previous state
  const prevIds = previousTrackIds[camId] || new Set();
  const prevCentroids = previousCentroids[camId] || {};
  const currentTrackIds = new Set();
  const currentCentroids = {};

  const overlays = [];
  const chatDetections = [];
  const evidenceList = [];
  const timelineEvents = [];
  let eventCounter = 0;

  // Process detections
  for (let idx = 0; idx < detections.length; idx++) {
    const det = detections[idx] || {};

    // Confidence normalization
    let rawConf = 0;
    if (det.confidence != null) {
      rawConf = Number(det.confidence) || 0;
    }
    if (rawConf < CONFIDENCE_THRESHOLD) continue;
    const confPct =
      rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);

    // Track id resolution
    let trackId = det.track_id ?? det.id ?? null;
    if (trackId) {
      trackId = String(trackId).startsWith("t_")
        ? String(trackId)
        : `t_${String(trackId)}`;
    } else {
      trackId = `t_${idx}`;
    }

    const label = det.label || "unknown";

    // Normalize bbox
    const bboxNorm = normalizeBbox(det, canvasW, canvasH);
    if (!bboxNorm) continue;

    const centroid = computeCentroid(bboxNorm);
    currentTrackIds.add(trackId);
    currentCentroids[trackId] = centroid;

    const evidenceRef = `EVID_${snapshotId}_${trackId}`;

    // Thumbnail generation
    let thumbnail = null;
    let cropFailedReason = null;
    if (rgbImg) {
      thumbnail = await cropThumbnail(
        rgbImg.buffer,
        rgbImg.width,
        rgbImg.height,
        bboxNorm,
      );
      if (!thumbnail) cropFailedReason = "crop empty or out of bounds";
    }

    // Status inference (entered / moving / stationary / present)
    let status = "present";
    if (!prevIds.has(trackId)) {
      status = "entered";
    } else if (prevCentroids[trackId]) {
      const dist = centroidDistance(centroid, prevCentroids[trackId]);
      if (dist > SUDDEN_MOTION_THRESHOLD) status = "moving";
      else if (dist < 0.01) status = "stationary";
    }

    // Bbox in pixels if canvas available
    let bboxPx = null;
    if (canvasW && canvasH) {
      bboxPx = [
        Math.round(bboxNorm[0] * canvasW),
        Math.round(bboxNorm[1] * canvasH),
        Math.round((bboxNorm[2] - bboxNorm[0]) * canvasW),
        Math.round((bboxNorm[3] - bboxNorm[1]) * canvasH),
      ];
    }

    const depthMean = det.depth_mean ?? det.depth_m ?? null;

    // Meta fields
    const meta = {
      track_history_len: det.track_history_len ?? 1,
      raw_confidence: rawConf,
    };
    if (cropFailedReason) meta.crop_failed_reason = cropFailedReason;
    if (det.temp != null) meta.thermal = det.temp;
    if (det.speed != null || det.speed_kmh != null)
      meta.speed = det.speed ?? det.speed_kmh;
    if (det.direction_changes != null)
      meta.direction_changes = det.direction_changes;

    overlays.push({
      id: trackId,
      label,
      confidence: confPct,
      bbox_norm: bboxNorm,
      bbox_px: bboxPx,
      centroid_norm: centroid,
      thumbnail_data_uri: thumbnail,
      depth_mean: depthMean != null ? Number(depthMean) : null,
      status,
      meta,
    });

    // Short notes for chatbot
    const noteParts = [];
    if (typeof det.temp === "number" && det.temp > 37.5)
      noteParts.push("thermal spike");
    if (det.speed_kmh && det.speed_kmh > 6) noteParts.push("fast exit");
    if (det.direction_changes && det.direction_changes > 4)
      noteParts.push("erratic movement");

    chatDetections.push({
      id: trackId,
      label,
      confidence: confPct,
      bbox_norm: bboxNorm,
      centroid_norm: centroid,
      evidence_ref: evidenceRef,
      notes: noteParts.join(", "),
    });

    evidenceList.push({
      evidence_id: evidenceRef,
      type: "image",
      ref: `evidence://${snapshotId}/${trackId}/thumb.jpg`,
      short_desc: `thumbnail crop of ${label}`,
    });

    // Timeline events heuristics
    if (status === "entered") {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`,
        type: "enter",
        timestamp_iso: tsIso,
        related_ids: [trackId],
        short: `${label} entered scene`,
        detail: `${label} first detected at [${centroid[0].toFixed(2)}, ${centroid[1].toFixed(2)}]`,
      });
    }

    if (status === "moving" && prevCentroids[trackId]) {
      const dist = centroidDistance(centroid, prevCentroids[trackId]);
      if (dist > SUDDEN_MOTION_THRESHOLD * 2) {
        eventCounter++;
        timelineEvents.push({
          id: `E${eventCounter}`,
          type: "sudden_motion",
          timestamp_iso: tsIso,
          related_ids: [trackId],
          short: `${label} rapid displacement`,
          detail: `${label} moved ${dist.toFixed(3)} normalized units between frames`,
        });
      }
    }

    if (typeof det.temp === "number" && det.temp > 37.5) {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`,
        type: "thermal_spike",
        timestamp_iso: tsIso,
        related_ids: [trackId],
        short: `${label} thermal spike ${det.temp}°C`,
        detail: `Thermal reading ${det.temp}°C exceeds threshold`,
      });
    }
  } // end detections loop

  // Exit events for tracks that disappeared
  for (const goneId of prevIds) {
    if (!currentTrackIds.has(goneId)) {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`,
        type: "exit",
        timestamp_iso: tsIso,
        related_ids: [goneId],
        short: `${goneId} exited scene`,
        detail: `Track ${goneId} no longer detected`,
      });
    }
  }

  // Update per-camera tracking state
  previousTrackIds[camId] = currentTrackIds;
  previousCentroids[camId] = currentCentroids;

  // Depth evidence entry
  if (depth_base64) {
    evidenceList.push({
      evidence_id: `EVID_${snapshotId}_depth`,
      type: "depth",
      ref: `evidence://${snapshotId}/depth_map`,
      short_desc: "depth frame for this snapshot",
    });
  }

  // Build outputs
  const uiDisplay = {
    frame_id: snapshotId,
    timestamp_iso: tsIso,
    canvas_size: canvasW ? { width: canvasW, height: canvasH } : null,
    overlays,
    timeline_events: timelineEvents,
    frame_preview: framePreview,
    meta: rgbDecodeError ? { error: rgbDecodeError } : undefined,
  };

  const chatbotPayload = {
    snapshot_id: snapshotId,
    timestamp_iso: tsIso,
    scene_summary: { num_detections: chatDetections.length },
    detections: chatDetections,
    evidence: evidenceList,
    derived_events: timelineEvents.map((ev) => ({
      type: ev.type,
      id: ev.id,
      timestamp_iso: ev.timestamp_iso,
      involved: ev.related_ids,
      confidence: 85,
    })),
    processing_meta: {
      camera_id: camId,
      frame_index: frame_index,
      source: "ingest",
    },
    extra: extra ?? null,
  };

  // Respond with processed payload
  res.json({ ui_display: uiDisplay, chatbot_payload: chatbotPayload });
});

export default router;
