import { Router } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DUMMY_CASE_DATA, DETECTIVE_SYSTEM_PROMPT } from "../shared.js";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
let genai = null;
if (GEMINI_API_KEY) {
  genai = new GoogleGenerativeAI(GEMINI_API_KEY);
}

router.post("/investigate", async (req, res) => {
  const { case_data: caseDataInput, messages = [] } = req.body;
  const caseData = caseDataInput || DUMMY_CASE_DATA;

  if (!genai) {
    return res.json(fallbackResponse(caseData, messages));
  }

  // Build Gemini conversation
  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: DETECTIVE_SYSTEM_PROMPT,
  });

  const geminiHistory = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  let prompt;
  if (messages.length === 0) {
    prompt = `New case file has been opened. Here is the complete sensor data from the incident:\n\n\`\`\`json\n${JSON.stringify(caseData, null, 2)}\n\`\`\`\n\nAnalyze this case. Start with your initial assessment, identify the most critical findings, and ask me 2-3 targeted questions to guide the investigation.`;
  } else {
    prompt = messages[messages.length - 1].content;
    // Remove last user message from history since we send it as the new message
    if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === "user") {
      geminiHistory.pop();
    }
  }

  const chat = model.startChat({ history: geminiHistory });

  // SSE streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const result = await chat.sendMessageStream(prompt);
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

function fallbackResponse(caseData, messages) {
  const scene = caseData.scene_data || {};
  if (!messages || messages.length === 0) {
    return {
      content: `## Initial Case Assessment

**Location:** ${scene.location || "Unknown"} | **Time:** ${scene.time || "Unknown"} | **Conditions:** ${scene.environment || "Unknown"}

---

This is a significant case. Let me walk through what the sensors captured.

**Critical Finding #1 — Concealed Individual (23:41:08)**
Thermal imaging detected a 36.2°C heat source behind a shelving unit in the storage area that was *completely invisible* on RGB cameras. Depth mapping confirms a 0.8m concealment pocket. This is the kind of detection that separates our system from standard CCTV — whoever was hiding there knew where the cameras were, but didn't account for thermal.

**Critical Finding #2 — The Exchange (23:43:30)**
S-1 and S-3 converged for exactly 8 seconds with hand-level movement tracked by depth sensors. The thermal transfer on S-3's right hand post-contact is a strong indicator of a physical handoff. The immediate separation in opposite directions is textbook covert exchange.

**Critical Finding #3 — Camera Avoidance (23:37:22)**
S-1 deliberately navigated around primary camera positions on entry. This suggests prior reconnaissance — they knew the layout. Only our thermal peripheral sensors caught this.

---

**Questions for the investigator:**

1. **The concealed person at 23:41** — was this S-1 waiting before S-3 arrived, or is this potentially a third individual? The thermal signature (36.2°C) is slightly lower than S-1's baseline (36.4°C). Can we check if there were any other entry detections we might have missed?

2. **The deposited object (23:45:02)** — the bag reads at ambient temperature (19.2°C), meaning it wasn't recently carried on-body. This is unusual. Was it pre-positioned? Can we check depth baselines for this zone from earlier in the day?

3. **Exit pattern** — S-3 fled at 9.2 km/h with elevated thermal (stress), while S-1 left calmly at 7.1 km/h via a different exit. This asymmetry suggests S-1 was in control of the situation. Do we have any exterior sensor coverage to track their departure directions?`,
    };
  }

  const responses = [
    `Good observation. Let me dig deeper into that.

The thermal data supports your thinking here. If we cross-reference the timeline, there's a 2-minute gap between S-1's arrival in the storage area (23:39:50) and the concealed presence detection (23:41:08). That's enough time for S-1 to have positioned themselves — but the 0.2°C temperature difference is nagging at me.

**New hypothesis:** There may have been a third person already in position before our observation window began. The lower thermal reading could indicate they'd been stationary long enough to cool slightly from physical activity.

**I'd recommend checking:**
- Depth baseline scans from 23:00-23:35 for Zone C — any anomalies would confirm pre-positioning
- Thermal sweep of the entire storage area — are there any other heat signatures we haven't flagged?

What are your thoughts on the deposited object? The ambient temperature reading is the piece that bothers me most.`,

    `That's a critical connection. Let me update my working theory.

**Revised Timeline Reconstruction:**

| Time | Event | Confidence |
|------|-------|------------|
| Pre-23:35 | Third individual enters and conceals in Zone C | 72% |
| 23:36 | S-1 enters via side door, avoids cameras | Confirmed |
| 23:38 | S-3 enters via fire exit, already showing stress | Confirmed |
| 23:39-41 | S-1 moves to storage, possible contact with hidden person | 68% |
| 23:43 | Handoff between S-1 and S-3 | 89% |
| 23:45 | S-1 deposits pre-staged bag | 81% |
| 23:46-48 | Both exit separately — S-3 panicked, S-1 controlled | Confirmed |

**The bag is the key.** If it was pre-positioned (ambient temp confirms it wasn't recently carried), then this was *planned in advance*. Someone placed that bag hours ago, and S-1 knew exactly where to find it.

**Next steps I'd recommend:**
1. Pull all sensor data from Zone C for the past 24 hours
2. Check if the concealed person ever left — or if they're *still there*
3. Cross-reference S-1's entry path with historical traffic patterns — has this exact route been used before?`,

    `We're building a strong picture now. Let me synthesize everything.

**Working Theory (Confidence: 78%):**
This was a coordinated operation involving at least 2, possibly 3 individuals. The warehouse was pre-scouted (camera avoidance confirms this). An item was pre-staged in the storage area. S-1 acted as the primary operator — calm, deliberate, familiar with the space. S-3 was secondary — showed signs of stress throughout, possibly coerced or inexperienced.

The multi-modal sensor fusion was decisive here. Standard CCTV would have captured entry/exit and maybe the storage meeting. But the concealed presence, the hand-level exchange detail, and the thermal stress indicators — those are what transform this from "two people in a warehouse" to "coordinated covert operation."

**Final recommendation:** This case warrants immediate physical investigation of Zone C, particularly behind the shelving unit where the concealed presence was detected. The deposited bag should be treated as priority evidence. All sensor recordings should be preserved for the full 24-hour window.`,
  ];

  const idx = Math.min(Math.floor(messages.length / 2), responses.length - 1);
  return { content: responses[idx] };
}

export default router;
