import { Router } from "express";
import { DUMMY_CASE_DATA, CRIME_SCENE } from "../shared.js";

const router = Router();

router.get("/case/dummy", (_req, res) => {
  res.json(DUMMY_CASE_DATA);
});

router.get("/case/scene", (_req, res) => {
  res.json(CRIME_SCENE);
});

export default router;
