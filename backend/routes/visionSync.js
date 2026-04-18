import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/vision-sync", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  // TODO: store the file (e.g. save to disk or object storage)
  // TODO: forward to detection / analysis pipeline
  // TODO: return a real job/session ID so frontend can poll progress

  res.json({
    status: "received",
    filename: req.file.originalname,
    mode: req.body.mode || "rgb",
    size: req.file.size,
    content_type: req.file.mimetype,
  });
});

export default router;
