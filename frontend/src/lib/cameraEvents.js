import { labelName } from "./cameraSummary";

function distanceMeters(spatial) {
  if (!spatial) return null;
  const x = Number(spatial.x) || 0;
  const z = Number(spatial.z) || 0;
  if (x === 0 && z === 0) return null;
  return Math.sqrt(x * x + z * z) / 1000;
}

function formatTime(ts) {
  if (ts == null) return null;
  return new Date(ts * 1000).toISOString().slice(11, 19);
}

// Derive per-class events from a frame stream. No tracking — treats each class
// as one "subject" since the OAK payload has no track ids.
export function extractEvents(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return [];

  const byClass = new Map();

  frames.forEach((frame, idx) => {
    const ts = typeof frame?.timestamp === "number" ? frame.timestamp : null;
    const dets = Array.isArray(frame?.detections) ? frame.detections : [];

    const countsInFrame = new Map();
    for (const det of dets) {
      const id = det?.label;
      if (id == null) continue;
      countsInFrame.set(id, (countsInFrame.get(id) || 0) + 1);
    }

    for (const [label, count] of countsInFrame) {
      let s = byClass.get(label);
      if (!s) {
        s = {
          label,
          firstIdx: idx, firstTs: ts,
          lastIdx: idx, lastTs: ts,
          minDist: null, minDistIdx: null, minDistTs: null,
          maxCount: 0, maxCountIdx: idx, maxCountTs: ts,
        };
        byClass.set(label, s);
      } else {
        s.lastIdx = idx;
        s.lastTs = ts;
      }
      if (count > s.maxCount) {
        s.maxCount = count;
        s.maxCountIdx = idx;
        s.maxCountTs = ts;
      }
      for (const det of dets) {
        if (det?.label !== label) continue;
        const d = distanceMeters(det.spatial);
        if (d != null && (s.minDist == null || d < s.minDist)) {
          s.minDist = d;
          s.minDistIdx = idx;
          s.minDistTs = ts;
        }
      }
    }
  });

  const events = [];
  const total = frames.length;

  for (const s of byClass.values()) {
    const name = labelName(s.label);

    events.push({
      type: "first_seen",
      frame_index: s.firstIdx,
      timestamp: s.firstTs,
      label: s.label,
      object: name,
      summary: `${name} first detected`,
    });

    if (s.lastIdx < total - 1) {
      events.push({
        type: "left_scene",
        frame_index: s.lastIdx,
        timestamp: s.lastTs,
        label: s.label,
        object: name,
        summary: `${name} last seen`,
      });
    }

    if (s.minDist != null) {
      events.push({
        type: "closest_approach",
        frame_index: s.minDistIdx,
        timestamp: s.minDistTs,
        label: s.label,
        object: name,
        distance: s.minDist,
        summary: `${name} at closest approach (${s.minDist.toFixed(2)} m)`,
      });
    }

    if (s.maxCount > 1) {
      events.push({
        type: "peak_count",
        frame_index: s.maxCountIdx,
        timestamp: s.maxCountTs,
        label: s.label,
        object: name,
        count: s.maxCount,
        summary: `${s.maxCount} ${name}s detected simultaneously`,
      });
    }
  }

  events.sort(
    (a, b) => (a.frame_index - b.frame_index) || a.type.localeCompare(b.type),
  );
  return events;
}

// Pick a small set of representative frames (for sending to the vision model).
// Includes first, last, and any frame flagged by closest_approach / peak_count.
export function pickKeyFrames(frames, events, max = 4) {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  const indices = new Set();
  indices.add(0);
  indices.add(frames.length - 1);
  for (const ev of events) {
    if (ev.type === "closest_approach" || ev.type === "peak_count") {
      indices.add(ev.frame_index);
    }
  }
  const sorted = [...indices]
    .filter((i) => i >= 0 && i < frames.length)
    .sort((a, b) => a - b)
    .slice(0, max);

  return sorted.map((i) => {
    const f = frames[i];
    const detList = (f.detections || [])
      .map((d) => labelName(d.label))
      .join(", ") || "no detections";
    const timeStr = f.timestamp ? ` @ ${formatTime(f.timestamp)}` : "";
    return {
      frame_index: i,
      timestamp: f.timestamp ?? null,
      rgb_base64: f.rgb_base64 || "",
      caption: `Frame ${i + 1}/${frames.length}${timeStr} — ${detList}`,
    };
  });
}
