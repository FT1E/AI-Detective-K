import { Router } from "express";
import { state, generateTimelineEvent, generateIncidentReport } from "../shared.js";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ recording: state.recording, event_count: state.events.length });
});

// WebSocket handler — attached in server.js via wss.on("connection")
export function handleWebSocket(ws) {
  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.action === "start") {
      state.recording = true;
      state.events = [];
      ws.send(JSON.stringify({ type: "status", recording: true }));

      const baseTime = new Date();
      let offset = 0;

      const loop = () => {
        if (!state.recording) return;
        const delay = 1500 + Math.random() * 2000;
        setTimeout(() => {
          if (!state.recording) return;
          offset += Math.floor(Math.random() * 27) + 8;
          const event = generateTimelineEvent(baseTime, offset);
          state.events.push(event);
          ws.send(
            JSON.stringify({
              type: "event",
              data: event,
              event_count: state.events.length,
            })
          );
          loop();
        }, delay);
      };
      loop();
    } else if (data.action === "stop") {
      state.recording = false;
      const report = generateIncidentReport(state.events);
      ws.send(JSON.stringify({ type: "status", recording: false }));
      if (report) {
        ws.send(JSON.stringify({ type: "report", data: report }));
      }
    }
  });

  ws.on("close", () => {
    state.recording = false;
  });
}

export default router;
