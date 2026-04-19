import { Router } from "express";

const router = Router();

let store = [];


const MAX_FRAMES = 30

router.post("/camera-output", (req, res) => {
  const entry = { ...req.body, received_at: new Date().toISOString() };
  store.push(entry);
  if (store.length > MAX_FRAMES){
    store = store.slice(-MAX_FRAMES)    
  }

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
