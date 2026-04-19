import { Router } from "express";

const router = Router();

let store = [];

const MAX_FRAMES = 300;

router.post("/camera-output", (req, res) => {
  const received_at = new Date().toISOString();
  const frames = Array.isArray(req.body) ? req.body : [req.body];

  for (const frame of frames) {
    store.push({ ...frame, received_at });
  }
  if (store.length > MAX_FRAMES) {
    store = store.slice(-MAX_FRAMES);
  }

  res.json({
    status: "ok",
    count: frames.length,
    total: store.length,
    received_at,
  });
});

router.get("/camera-output", (_req, res) => {
  res.json(store);
});

export default router;
