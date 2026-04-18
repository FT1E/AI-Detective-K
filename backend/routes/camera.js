import { Router } from "express";
import { state } from "../shared.js";

const router = Router();

router.post("/camera-data", (req, res) => {
  const payload = { ...req.body, received_at: new Date().toISOString() };
  state.cameraDataStore.push(payload);
  res.json({
    status: "ok",
    index: state.cameraDataStore.length - 1,
    received_at: payload.received_at,
  });
});

router.get("/camera-data", (_req, res) => {
  res.json(state.cameraDataStore);
});

router.get("/camera-data/latest", (_req, res) => {
  if (state.cameraDataStore.length === 0) return res.json(null);
  res.json(state.cameraDataStore[state.cameraDataStore.length - 1]);
});

export default router;
