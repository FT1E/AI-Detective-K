import { Router } from "express";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Frame-to-frame tracking state (in-memory, per camera)
const previousTrackIds = {};   // cameraId -> Set of track ids
const previousCentroids = {};  // cameraId -> { trackId: [cx, cy] }

const CONFIDENCE_THRESHOLD = 0.40;
const THUMBNAIL_MAX_PX = 128;
const FRAME_PREVIEW_WIDTH = 640;
const SUDDEN_MOTION_THRESHOLD = 0.15;

function clamp(v, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

function computeCentroid(bbox) {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function centroidDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function stripDataUriPrefix(b64) {
  if (b64.indexOf(",") !== -1 && b64.indexOf(",") < 100) {
    return b64.split(",")[1];
  }
  return b64;
}

async function decodeImage(b64) {
  try {
    const buf = Buffer.from(stripDataUriPrefix(b64), "base64");
    const meta = await sharp(buf).metadata();
    return { buffer: buf, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

async function imageToDataUri(buf, maxDim) {
  let pipeline = sharp(buf);
  if (maxDim) {
    pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: "inside" });
  }
  const jpeg = await pipeline.jpeg({ quality: 80 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function cropThumbnail(imgBuf, imgW, imgH, bboxNorm) {
  try {
    const left = Math.round(bboxNorm[0] * imgW);
    const top = Math.round(bboxNorm[1] * imgH);
    const width = Math.round((bboxNorm[2] - bboxNorm[0]) * imgW);
    const height = Math.round((bboxNorm[3] - bboxNorm[1]) * imgH);
    if (width <= 0 || height <= 0) return null;
    const cropped = await sharp(imgBuf)
      .extract({ left, top, width, height })
      .resize({ width: THUMBNAIL_MAX_PX, height: THUMBNAIL_MAX_PX, fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${cropped.toString("base64")}`;
  } catch {
    return null;
  }
}

function normalizeBbox(det, canvasW, canvasH) {
  if (det.bbox_norm && Array.isArray(det.bbox_norm) && det.bbox_norm.length === 4) {
    return det.bbox_norm.map((v) => clamp(v));
  }
  if (det.bbox_px && canvasW && canvasH) {
    const [x, y, w, h] = det.bbox_px;
    return [clamp(x / canvasW), clamp(y / canvasH), clamp((x + w) / canvasW), clamp((y + h) / canvasH)];
  }
  if (det.bbox && Array.isArray(det.bbox) && det.bbox.length === 4 && canvasW && canvasH) {
    const [x1, y1, x2, y2] = det.bbox;
    if (det.bbox.some((v) => v > 1)) {
      return [clamp(x1 / canvasW), clamp(y1 / canvasH), clamp(x2 / canvasW), clamp(y2 / canvasH)];
    }
    return det.bbox.map((v) => clamp(v));
  }
  return null;
}

router.post("/camera-payload", async (req, res) => {
  const {
    detections = [],
    rgb_base64 = "",
    depth_base64 = "",
    canvas_size = null,
    camera_id: camId = "cam-1",
    frame_index = null,
    timestamp = null,
  } = req.body;

  const nowIso = new Date().toISOString();

  // Resolve timestamp
  let tsIso;
  if (timestamp) {
    if (typeof timestamp === "number") {
      tsIso = new Date(timestamp * 1000).toISOString();
    } else {
      tsIso = String(timestamp);
    }
  } else {
    tsIso = nowIso;
  }

  const snapshotId = `f_${nowIso.replace(/[-:T]/g, "").slice(0, 14)}_${uuidv4().slice(0, 6)}`;

  // Validate
  const errors = [];
  if (!Array.isArray(detections)) errors.push("detections is not a list");
  if (!rgb_base64) errors.push("rgb_base64 is empty");
  if (errors.length > 0) {
    const errMsg = errors.join("; ");
    return res.json({ ui_display: { error: errMsg }, chatbot_payload: { error: errMsg } });
  }

  // Decode image
  const rgbImg = await decodeImage(rgb_base64);
  let canvasW = canvas_size?.width || null;
  let canvasH = canvas_size?.height || null;
  if (rgbImg && !canvasW) {
    canvasW = rgbImg.width;
    canvasH = rgbImg.height;
  }

  // Frame preview
  let framePreview = null;
  let rgbDecodeError = null;
  if (rgbImg) {
    framePreview = await imageToDataUri(rgbImg.buffer, FRAME_PREVIEW_WIDTH);
  } else {
    rgbDecodeError = "Failed to decode rgb_base64";
  }

  // Tracking state
  const prevIds = previousTrackIds[camId] || new Set();
  const prevCentroids = previousCentroids[camId] || {};
  const currentTrackIds = new Set();
  const currentCentroids = {};

  const overlays = [];
  const chatDetections = [];
  const evidenceList = [];
  const timelineEvents = [];
  let eventCounter = 0;

  for (let idx = 0; idx < detections.length; idx++) {
    const det = detections[idx];

    // Confidence filter
    let rawConf = parseFloat(det.confidence) || 0;
    if (rawConf < CONFIDENCE_THRESHOLD) continue;

    const confPct = rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);

    // Track ID
    let trackId = det.track_id || det.id;
    if (trackId) {
      trackId = String(trackId).startsWith("t_") ? String(trackId) : `t_${trackId}`;
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

    // Thumbnail
    let thumbnail = null;
    let cropFailedReason = null;
    if (rgbImg) {
      thumbnail = await cropThumbnail(rgbImg.buffer, rgbImg.width, rgbImg.height, bboxNorm);
      if (!thumbnail) cropFailedReason = "crop region empty or out of bounds";
    }

    // Status
    let status = "present";
    if (!prevIds.has(trackId)) {
      status = "entered";
    } else if (prevCentroids[trackId]) {
      const dist = centroidDistance(centroid, prevCentroids[trackId]);
      if (dist > SUDDEN_MOTION_THRESHOLD) status = "moving";
      else if (dist < 0.01) status = "stationary";
    }

    // Bbox in pixels
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

    // Meta
    const meta = { track_history_len: det.track_history_len || 1, raw_confidence: rawConf };
    if (cropFailedReason) meta.crop_failed_reason = cropFailedReason;
    if (det.temp != null) meta.thermal = det.temp;
    if (det.speed != null || det.speed_kmh != null) meta.speed = det.speed ?? det.speed_kmh;
    if (det.direction_changes != null) meta.direction_changes = det.direction_changes;

    overlays.push({
      id: trackId, label, confidence: confPct, bbox_norm: bboxNorm, bbox_px: bboxPx,
      centroid_norm: centroid, thumbnail_data_uri: thumbnail,
      depth_mean: depthMean != null ? Number(depthMean) : null,
      status, meta,
    });

    // Notes for chatbot
    const noteParts = [];
    if (typeof det.temp === "number" && det.temp > 37.5) noteParts.push("thermal spike");
    if (det.speed_kmh && det.speed_kmh > 6) noteParts.push("fast exit");
    if (det.direction_changes && det.direction_changes > 4) noteParts.push("erratic movement");

    chatDetections.push({
      id: trackId, label, confidence: confPct, bbox_norm: bboxNorm,
      centroid_norm: centroid, evidence_ref: evidenceRef, notes: noteParts.join(", "),
    });

    evidenceList.push({
      evidence_id: evidenceRef, type: "image",
      ref: `evidence://${snapshotId}/${trackId}/thumb.jpg`,
      short_desc: `thumbnail crop of ${label}`,
    });

    // Timeline events
    if (status === "entered") {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`, type: "enter", timestamp_iso: tsIso,
        related_ids: [trackId],
        short: `${label} entered scene`,
        detail: `${label} (conf ${confPct}%) first detected at [${centroid[0].toFixed(2)}, ${centroid[1].toFixed(2)}]`,
      });
    }

    if (status === "moving" && prevCentroids[trackId]) {
      const dist = centroidDistance(centroid, prevCentroids[trackId]);
      if (dist > SUDDEN_MOTION_THRESHOLD * 2) {
        eventCounter++;
        timelineEvents.push({
          id: `E${eventCounter}`, type: "sudden_motion", timestamp_iso: tsIso,
          related_ids: [trackId],
          short: `${label} rapid displacement`,
          detail: `${label} moved ${dist.toFixed(3)} normalized units between frames`,
        });
      }
    }

    if (typeof det.temp === "number" && det.temp > 37.5) {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`, type: "thermal_spike", timestamp_iso: tsIso,
        related_ids: [trackId],
        short: `${label} thermal spike ${det.temp}°C`,
        detail: `Thermal reading ${det.temp}°C exceeds 37.5°C threshold`,
      });
    }
  }

  // Exit events
  for (const goneId of prevIds) {
    if (!currentTrackIds.has(goneId)) {
      eventCounter++;
      timelineEvents.push({
        id: `E${eventCounter}`, type: "exit", timestamp_iso: tsIso,
        related_ids: [goneId],
        short: `${goneId} exited scene`,
        detail: `Track ${goneId} no longer detected`,
      });
    }
  }

  // Update tracking state
  previousTrackIds[camId] = currentTrackIds;
  previousCentroids[camId] = currentCentroids;

  // Depth evidence
  if (depth_base64) {
    evidenceList.push({
      evidence_id: `EVID_${snapshotId}_depth`, type: "depth",
      ref: `evidence://${snapshotId}/depth_map`,
      short_desc: "depth frame for this snapshot",
    });
  }

  // Build outputs
  const uiDisplay = {
    frame_id: snapshotId, timestamp_iso: tsIso,
    canvas_size: canvasW ? { width: canvasW, height: canvasH } : null,
    overlays, timeline_events: timelineEvents, frame_preview: framePreview,
  };
  if (rgbDecodeError) uiDisplay.meta = { error: rgbDecodeError };

  const chatbotPayload = {
    snapshot_id: snapshotId, timestamp_iso: tsIso,
    scene_summary: { num_detections: chatDetections.length },
    detections: chatDetections, evidence: evidenceList,
    derived_events: timelineEvents.map((ev) => ({
      type: ev.type, id: ev.id, timestamp_iso: ev.timestamp_iso,
      involved: ev.related_ids, confidence: 85,
    })),
    processing_meta: { camera_id: camId, frame_index: frame_index, source: "oak_api" },
  };

  res.json({ ui_display: uiDisplay, chatbot_payload: chatbotPayload });
});

export default router;
