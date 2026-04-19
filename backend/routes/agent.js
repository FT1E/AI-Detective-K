import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { store } from "./cameraOutput.js";

const router = Router();

let _genai = null;
function getGenai() {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) return null;
  if (!_genai) _genai = new GoogleGenerativeAI(key);
  return _genai;
}

function getLastFrame() {
  for (let i = store.length - 1; i >= 0; i--) {
    const entry = store[i];
    if (!entry) continue;
    if (entry.rgb_base64) return entry;
    if (Array.isArray(entry.frames)) {
      for (let j = entry.frames.length - 1; j >= 0; j--) {
        if (entry.frames[j]?.rgb_base64) return entry.frames[j];
      }
    }
    const numKeys = Object.keys(entry)
      .filter((k) => !isNaN(parseInt(k, 10)))
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    for (const k of numKeys) {
      if (entry[k]?.rgb_base64) return entry[k];
    }
  }
  return null;
}

function detectMime(b64) {
  if (!b64 || typeof b64 !== "string") return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  return "image/jpeg";
}

function sse(res, eventName, data) {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
}

// ── POST /api/agent/analyze ───────────────────────────────────────────────────
router.post("/agent/analyze", async (req, res) => {
  const { annotations = [] } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const genai = getGenai();
  if (!genai) {
    sse(res, "error", "Gemini API key not configured.");
    res.end();
    return;
  }

  const frame = getLastFrame();
  if (!frame) {
    sse(res, "error", "No frames available. Connect camera or load test data.");
    res.end();
    return;
  }

  const { rgb_base64, depth_base64, detections = [] } = frame;
  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const annotationContext =
    annotations.length > 0
      ? `\n\nThe user has highlighted the following regions:\n${annotations
          .map((a, i) => `${i + 1}. Region at (x:${a.x}, y:${a.y}, w:${a.width}, h:${a.height} normalized): "${a.label}"`)
          .join("\n")}\nPay special attention to these areas.`
      : "";

  // Stage 1: Vision
  sse(res, "stage", "vision");
  const visionParts = [
    {
      text:
        `You are an expert forensic scene analyst. Describe everything you observe in meticulous detail: ` +
        `all objects, their positions, spatial relationships, estimated distances, any people or subjects, ` +
        `unusual elements, and anything forensically significant. Be thorough and methodical.` +
        annotationContext,
    },
    { inlineData: { mimeType: detectMime(rgb_base64), data: rgb_base64 } },
  ];
  if (depth_base64) {
    visionParts.push({ inlineData: { mimeType: detectMime(depth_base64), data: depth_base64 } });
  }

  let visionText = "";
  try {
    const visionResult = await model.generateContentStream(visionParts);
    for await (const chunk of visionResult.stream) {
      const text = chunk.text();
      if (text) {
        visionText += text;
        sse(res, "vision", JSON.stringify(text));
      }
    }
    sse(res, "vision_complete", JSON.stringify(visionText));
  } catch (err) {
    sse(res, "error", `Vision analysis failed: ${err.message}`);
    res.end();
    return;
  }

  // Stage 2: Fusion
  sse(res, "stage", "fusion");
  const fusionPrompt =
    `Forensic analyst cross-referencing data sources.\n\n` +
    `VISUAL DESCRIPTION:\n${visionText}\n\n` +
    `DETECTIONS:\n${JSON.stringify(detections, null, 2)}\n\n` +
    (annotations.length > 0
      ? `USER ANNOTATIONS:\n${annotations.map((a, i) => `${i + 1}. "${a.label}" at (x:${a.x}, y:${a.y}, w:${a.width}, h:${a.height})`).join("\n")}\n\n`
      : "") +
    `Produce a unified scene inventory with spatial context and flag forensically significant elements.`;

  let fusionText = "";
  try {
    const fusionResult = await model.generateContentStream(fusionPrompt);
    for await (const chunk of fusionResult.stream) {
      const text = chunk.text();
      if (text) {
        fusionText += text;
        sse(res, "fusion", JSON.stringify(text));
      }
    }
    sse(res, "fusion_complete", JSON.stringify(fusionText));
  } catch (err) {
    sse(res, "error", `Fusion analysis failed: ${err.message}`);
    res.end();
    return;
  }

  // Stage 3: Report
  sse(res, "stage", "report");
  const now = new Date();
  const caseId = `DK-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const reportPrompt =
    `Based on this forensic analysis, output ONLY a valid JSON object (no markdown fences):\n\n` +
    `FUSED ANALYSIS:\n${fusionText}\n\n` +
    `JSON structure:\n` +
    `{"case_id":"${caseId}","generated_at":"${now.toISOString()}",` +
    `"observation_window":{"start":null,"end":null,"event_count":<int>},` +
    `"threat_assessment":{"level":"critical"|"high"|"elevated"|"moderate","label":"<string>","high_severity_count":<int>,"medium_severity_count":<int>},` +
    `"narrative":"<3-5 sentence summary>",` +
    `"key_findings":[{"finding":"<title>","significance":"<why>","implication":"<what>"}],` +
    `"subject_profiles":[{"id":"<S-N>","label":"<name>","description":"<desc>","involvement_level":"high"|"medium"|"low","event_count":<int>,"zones_visited":[]}],` +
    `"sensor_coverage":{"rgb":<int>,"thermal":0,"depth":<int>},` +
    `"recommendation":"<action>"}`;

  try {
    const reportResult = await model.generateContent(reportPrompt);
    let jsonStr = reportResult.response.text().trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    let reportJson;
    try {
      reportJson = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found in model response");
      reportJson = JSON.parse(match[0]);
    }
    sse(res, "report", JSON.stringify(reportJson));
  } catch (err) {
    sse(res, "error", `Report generation failed: ${err.message}`);
    res.end();
    return;
  }

  sse(res, "done", "");
  res.end();
});

// ── POST /api/agent/follow-up ─────────────────────────────────────────────────
router.post("/agent/follow-up", async (req, res) => {
  const { annotations = [], analysis_summary = "", history = [] } = req.body;

  const genai = getGenai();
  if (!genai) {
    return res.status(503).json({ error: "Gemini API key not configured." });
  }

  const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

  const historyContext =
    history.length > 0
      ? `\n\nPrevious investigation steps:\n${history
          .map((h, i) => {
            const q = h.question?.question || h.question || "";
            const a = h.answer?.text || h.answer || "";
            const aid = h.answer?.id ? `[${h.answer.id}] ` : "";
            return `Step ${i + 1}:\n  Q: ${q}\n  A: ${aid}${a}`;
          })
          .join("\n")}`
      : "";

  const annotationContext =
    annotations.length > 0
      ? `\n\nAnnotated regions of interest:\n${annotations
          .map((a, i) => `${i + 1}. "${a.label}"`)
          .join(", ")}`
      : "";

  const isComplete = history.length >= 5;

  const prompt =
    `You are a forensic investigator guiding an investigation through questions.\n\n` +
    `Scene analysis summary: ${analysis_summary || "A suspicious scene with forensic evidence."}` +
    annotationContext +
    historyContext +
    `\n\n${isComplete ? "The investigation has reached its depth limit. Provide a final summary question to wrap up." : ""}` +
    `\n\nGenerate the next investigation question as a JSON object (no markdown fences):\n` +
    `{"context_summary":"<1-2 sentence recap>","question":"<the question>",` +
    `"options":[{"id":"A","text":"<option>"},{"id":"B","text":"<option>"},{"id":"C","text":"<option>"}],` +
    `"allows_custom":true,"investigation_complete":${isComplete}}`;

  try {
    const result = await model.generateContent(prompt);
    let jsonStr = result.response.text().trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    let questionJson;
    try {
      questionJson = JSON.parse(jsonStr);
    } catch {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      questionJson = JSON.parse(match[0]);
    }
    return res.json(questionJson);
  } catch (err) {
    return res.status(500).json({ error: `Follow-up generation failed: ${err.message}` });
  }
});

export default router;
