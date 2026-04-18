import { Router } from "express";

const router = Router();

const store = [];

router.post("/camera-output", (req, res) => {
  const entry = { ...req.body, received_at: new Date().toISOString() };
  store.push(entry);
  res.json({
    status: "ok",
    index: store.length - 1,
    received_at: entry.received_at,
  });
});

router.get("/camera-output", (_req, res) => {
  res.json(store);
});

export default router;
