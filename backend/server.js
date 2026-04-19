import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import caseRouter from "./routes/case.js";
import analysisRouter from "./routes/analysis.js";

import investigateRouter from "./routes/investigate.js";
import cameraPayloadRouter from "./routes/cameraPayload.js";
import eventsRouter, { handleWebSocket } from "./routes/events.js";

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Routes — all prefixed with /api
app.use("/api", caseRouter);
app.use("/api", analysisRouter);
// app.use("/api", cameraRouter); // removed
app.use("/api", investigateRouter);
// app.use("/api", visionSyncRouter); // replaced by cameraPayloadRouter
app.use("/api", eventsRouter);
app.use("/api", cameraPayloadRouter);

// WebSocket — /ws/events
const wss = new WebSocketServer({ server, path: "/ws/events" });
wss.on("connection", handleWebSocket);

// Start
const PORT = parseInt(process.env.PORT || "8000", 10);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Detective K backend running on http://0.0.0.0:${PORT}`);
});
