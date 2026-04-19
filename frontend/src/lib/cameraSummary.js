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

export function summarizeFrames(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return null;

  const classes = new Map(); // label id -> aggregate
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
  });

  const classList = [...classes.values()].sort(
    (a, b) => b.frameCount - a.frameCount || b.maxConf - a.maxConf,
  );

  const duration =
    firstTs != null && lastTs != null ? Math.max(0, lastTs - firstTs) : null;

  return {
    totalFrames: frames.length,
    duration,
    firstTs,
    lastTs,
    classes: classList,
    closest,
  };
}
