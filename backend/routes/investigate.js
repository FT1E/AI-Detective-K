import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DETECTIVE_SYSTEM_PROMPT } from "../shared.js";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
let genai = null;
if (GEMINI_API_KEY) {
  genai = new GoogleGenerativeAI(GEMINI_API_KEY);
}

function stripBase64Prefix(b64) {
  if (typeof b64 !== "string") return "";
  const comma = b64.indexOf(",");
  return comma >= 0 && b64.startsWith("data:") ? b64.slice(comma + 1) : b64;
}

function buildContextText(cameraContext) {
  const { summary, events } = cameraContext || {};
  const lines = [];

  if (summary) {
    lines.push("### Camera summary");
    lines.push(`- Frames: ${summary.totalFrames}`);
    if (summary.duration != null) {
      lines.push(`- Duration: ${summary.duration.toFixed(1)}s`);
    }
    if (Array.isArray(summary.classes) && summary.classes.length > 0) {
      lines.push("- Object classes detected:");
      for (const c of summary.classes) {
        const dist =
          c.minDistance != null
            ? ` · distance ${c.minDistance.toFixed(2)}–${(c.maxDistance ?? c.minDistance).toFixed(2)}m`
            : "";
        lines.push(
          `  · ${c.name} (x${c.detectionCount} over ${c.frameCount} frames, max conf ${(c.maxConf * 100).toFixed(0)}%${dist})`,
        );
      }
    }
    if (summary.closest) {
      lines.push(
        `- Closest approach: ${summary.closest.name} at ${summary.closest.distance.toFixed(2)}m (frame ${summary.closest.frameIndex + 1})`,
      );
    }
  }

  if (Array.isArray(events) && events.length > 0) {
    lines.push("");
    lines.push("### Event timeline");
    for (const ev of events) {
      lines.push(`- [frame ${ev.frame_index + 1}] ${ev.summary}`);
    }
  }

  return lines.join("\n");
}

function buildInitialParts(cameraContext) {
  const parts = [];
  const contextText = buildContextText(cameraContext);
  parts.push({
    text: `A new set of footage has been synced from the OAK-D camera. Here is the structured context:\n\n${contextText}\n\nRepresentative frames follow. Use them along with the numbers above to give an initial read: what do you actually see, what stands out, and what 1-2 questions do you need answered to move forward?`,
  });

  const frames = cameraContext?.key_frames || [];
  for (const f of frames) {
    const data = stripBase64Prefix(f?.rgb_base64 || "");
    if (!data) continue;
    parts.push({ text: f.caption || `Frame ${f.frame_index + 1}` });
    parts.push({
      inlineData: { mimeType: "image/jpeg", data },
    });
  }

  return parts;
}

router.post("/investigate", async (req, res) => {
  const { camera_context: cameraContext, messages = [] } = req.body;

  if (!genai) {
    return res.json(fallbackResponse(cameraContext, messages));
  }

  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: DETECTIVE_SYSTEM_PROMPT,
  });

  const geminiHistory = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  let newMessageParts;
  if (messages.length === 0) {
    newMessageParts = buildInitialParts(cameraContext);
  } else {
    newMessageParts = [{ text: messages[messages.length - 1].content }];
    if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === "user") {
      geminiHistory.pop();
    }
  }

  const chat = model.startChat({ history: geminiHistory });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const result = await chat.sendMessageStream(newMessageParts);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`);
      }
    }
    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`);
  }
  res.end();
});

function fallbackResponse(cameraContext, messages) {
  if (!messages || messages.length === 0) {
    const summary = cameraContext?.summary;
    const events = cameraContext?.events || [];
    const classList = summary?.classes
      ?.map((c) => `${c.name} (${c.detectionCount})`)
      .join(", ");
    const closest = summary?.closest
      ? `Closest object: ${summary.closest.name} at ${summary.closest.distance.toFixed(2)}m.`
      : "No depth-based distance was captured.";

    return {
      content: `## Initial Read (offline — no Gemini key)

I'm running without the live model, so this is a mechanical summary of what the camera reported.

**What the camera saw:** ${classList || "no objects"}
${closest}

**Derived events:** ${events.length}
${events
  .slice(0, 5)
  .map((e) => `- ${e.summary}`)
  .join("\n") || "- (none)"}

Set the GEMINI_API_KEY env var to enable the real detective.`,
    };
  }

  return {
    content: `I'm offline (no GEMINI_API_KEY). Set it to enable conversational analysis.`,
  };
}

export default router;
