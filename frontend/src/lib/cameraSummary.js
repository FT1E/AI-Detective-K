// COCO class names (YOLO default label set). Keys are the numeric label ids
// returned by the spatial detection network in /api/camera-output.
export const COCO_LABELS = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear",
  "hair drier", "toothbrush",
];

export function labelName(id) {
  return COCO_LABELS[id] ?? `class ${id}`;
}

// spatial.x and spatial.z are millimeters from the camera origin.
// Euclidean distance in meters on the horizontal plane.
function distanceMeters(spatial) {
  if (!spatial) return null;
  const x = Number(spatial.x) || 0;
  const z = Number(spatial.z) || 0;
  if (x === 0 && z === 0) return null;
  return Math.sqrt(x * x + z * z) / 1000;
}

// Straight-line distance between two spatial points (meters).
function pairDistanceMeters(a, b) {
  if (!a || !b) return null;
  const ax = Number(a.x) || 0, az = Number(a.z) || 0;
  const bx = Number(b.x) || 0, bz = Number(b.z) || 0;
  if ((ax === 0 && az === 0) || (bx === 0 && bz === 0)) return null;
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz) / 1000;
}

export function summarizeFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return null;

  const classes = new Map(); // label id -> aggregate
  const pairs = new Map(); // "labelA|labelB" (sorted) -> { a, b, nameA, nameB, minDist, maxDist, frameIndex }
  let closest = null; // { label, name, distance, conf, frameIndex }
  let firstTs = null;
  let lastTs = null;

  frames.forEach((frame, frameIndex) => {
    if (typeof frame?.timestamp === "number") {
      if (firstTs === null || frame.timestamp < firstTs) firstTs = frame.timestamp;
      if (lastTs === null || frame.timestamp > lastTs) lastTs = frame.timestamp;
    }

    const dets = Array.isArray(frame?.detections) ? frame.detections : [];
    const seenInFrame = new Set();

    for (const det of dets) {
      const id = det?.label;
      if (id == null) continue;
      const name = labelName(id);
      const conf = Number(det.conf) || 0;
      const dist = distanceMeters(det.spatial);

      let agg = classes.get(id);
      if (!agg) {
        agg = {
          label: id,
          name,
          frameCount: 0,
          detectionCount: 0,
          maxConf: 0,
          minDistance: null,
          maxDistance: null,
          lastSeenIndex: frameIndex,
        };
        classes.set(id, agg);
      }
      agg.detectionCount += 1;
      if (!seenInFrame.has(id)) {
        agg.frameCount += 1;
        seenInFrame.add(id);
      }
      if (conf > agg.maxConf) agg.maxConf = conf;
      if (dist != null) {
        if (agg.minDistance == null || dist < agg.minDistance) agg.minDistance = dist;
        if (agg.maxDistance == null || dist > agg.maxDistance) agg.maxDistance = dist;
      }
      agg.lastSeenIndex = frameIndex;

      if (dist != null && (closest == null || dist < closest.distance)) {
        closest = { label: id, name, distance: dist, conf, frameIndex };
      }
    }

    // Pairwise distances between different-class detections in this frame.
    for (let i = 0; i < dets.length; i++) {
      const a = dets[i];
      if (a?.label == null || !a.spatial) continue;
      for (let j = i + 1; j < dets.length; j++) {
        const b = dets[j];
        if (b?.label == null || !b.spatial) continue;
        if (a.label === b.label) continue;
        const d = pairDistanceMeters(a.spatial, b.spatial);
        if (d == null) continue;
        const [loA, loB] = a.label < b.label ? [a.label, b.label] : [b.label, a.label];
        const key = `${loA}|${loB}`;
        let p = pairs.get(key);
        if (!p) {
          p = {
            a: loA, b: loB,
            nameA: labelName(loA), nameB: labelName(loB),
            minDist: d, maxDist: d,
            frameIndex,
          };
          pairs.set(key, p);
        } else {
          if (d < p.minDist) { p.minDist = d; p.frameIndex = frameIndex; }
          if (d > p.maxDist) p.maxDist = d;
        }
      }
    }
  });

  const classList = [...classes.values()].sort(
    (a, b) => b.frameCount - a.frameCount || b.maxConf - a.maxConf,
  );

  const duration =
    firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null;

  const pairList = [...pairs.values()].sort((a, b) => a.minDist - b.minDist);

  return {
    totalFrames: frames.length,
    duration,
    firstTs,
    lastTs,
    classes: classList,
    closest,
    pairs: pairList,
  };
}
