import "dotenv/config";
import express from "express";
import cors from "cors";

import investigateRouter from "./routes/investigate.js";
import cameraOutputRouter from "./routes/cameraOutput.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api", investigateRouter);
app.use("/api", cameraOutputRouter);

const PORT = parseInt(process.env.PORT || "8000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Detective K backend running on http://0.0.0.0:${PORT}`);
});
