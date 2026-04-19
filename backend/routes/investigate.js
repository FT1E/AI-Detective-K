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
    if (Array.isArray(summary.pairs) && summary.pairs.length > 0) {
      lines.push("- Inter-object distances (min across frames):");
      for (const p of summary.pairs.slice(0, 10)) {
        const range =
          p.maxDist !== p.minDist
            ? `${p.minDist.toFixed(2)}–${p.maxDist.toFixed(2)}m`
            : `${p.minDist.toFixed(2)}m`;
        lines.push(`  · ${p.nameA} ↔ ${p.nameB}: ${range}`);
      }
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

function parseJsonFromText(text) {
  if (!text || typeof text !== "string") return null;

  const trimmed = text.trim();
  const fenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(fenced);
  } catch {
    const firstObject = fenced.indexOf("{");
    const lastObject = fenced.lastIndexOf("}");
    if (firstObject !== -1 && lastObject > firstObject) {
      try {
        return JSON.parse(fenced.slice(firstObject, lastObject + 1));
      } catch {
        // no-op
      }
    }

    const firstArray = fenced.indexOf("[");
    const lastArray = fenced.lastIndexOf("]");
    if (firstArray !== -1 && lastArray > firstArray) {
      try {
        return JSON.parse(fenced.slice(firstArray, lastArray + 1));
      } catch {
        // no-op
      }
    }
  }

  return null;
}

async function generateJson(parts, fallbackValue) {
  if (!genai) return fallbackValue;

  try {
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction:
        `${DETECTIVE_SYSTEM_PROMPT}\n\nWhen the user asks for JSON, return only valid JSON with no markdown wrappers.`,
    });

    const result = await model.generateContent(parts);
    const text = result?.response?.text?.() || "";
    const parsed = parseJsonFromText(text);
    return parsed ?? fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function sanitizeAnnotations(annotations) {
  if (!Array.isArray(annotations)) return [];

  return annotations
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const x = Number(item.x);
      const y = Number(item.y);
      const w = Number(item.w);
      const h = Number(item.h);
      if ([x, y, w, h].some((v) => Number.isNaN(v))) return null;
      if (w <= 0 || h <= 0) return null;
      return {
        id: item.id || `ann_${idx + 1}`,
        label:
          typeof item.label === "string" && item.label.trim()
            ? item.label.trim()
            : `Region ${idx + 1}`,
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0, Math.min(1, w)),
        h: Math.max(0, Math.min(1, h)),
      };
    })
    .filter(Boolean);
}

function normalizeQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions
    .map((question, qi) => {
      const questionText =
        typeof question?.question === "string" ? question.question.trim() : "";
      if (!questionText) return null;

      const choicesRaw = Array.isArray(question.choices) ? question.choices : [];
      let choices = choicesRaw
        .map((choice, ci) => {
          if (typeof choice === "string") {
            return {
              id: `q${qi + 1}_c${ci + 1}`,
              text: choice,
            };
          }
          if (!choice || typeof choice !== "object") return null;
          const text =
            choice.text || choice.label || choice.title || `Choice ${ci + 1}`;
          return {
            id: choice.id || `q${qi + 1}_c${ci + 1}`,
            text,
          };
        })
        .filter(Boolean);

      if (choices.length === 0) {
        choices = [
          { id: `q${qi + 1}_c1`, text: "Very likely" },
          { id: `q${qi + 1}_c2`, text: "Possible" },
          { id: `q${qi + 1}_c3`, text: "Unlikely" },
        ];
      }

      return {
        id: question.id || `q${qi + 1}`,
        question: questionText,
        choices,
      };
    })
    .filter(Boolean);
}

function fallbackVideoAnalysis(cameraContext) {
  const summary = cameraContext?.summary || {};
  const classes = Array.isArray(summary.classes) ? summary.classes : [];
  const objects = classes.map((c) => c.name).filter(Boolean);
  const topEvents = (cameraContext?.events || []).slice(0, 5).map((e) => e.summary);

  return {
    scene_description:
      objects.length > 0
        ? `Camera observed ${objects.join(", ")} across ${summary.totalFrames || 0} frames.`
        : "Camera feed has limited object detections.",
    objects_detected: objects,
    key_observations:
      topEvents.length > 0 ? topEvents : ["No prominent event spikes were detected."],
  };
}

function fallbackAnnotationAnalysis(capturedFrame, annotations) {
  if (!capturedFrame) {
    return {
      annotation_findings: ["No captured frame provided for annotation analysis."],
      highlighted_regions: [],
    };
  }

  if (!annotations.length) {
    return {
      annotation_findings: [
        "Captured frame available but no manual annotations were added.",
      ],
      highlighted_regions: [],
    };
  }

  return {
    annotation_findings: annotations.map(
      (a) => `${a.label} at [x=${a.x.toFixed(2)}, y=${a.y.toFixed(2)}, w=${a.w.toFixed(2)}, h=${a.h.toFixed(2)}]`,
    ),
    highlighted_regions: annotations,
  };
}

function fallbackQuestions(videoAnalysis, annotationAnalysis) {
  const objects = Array.isArray(videoAnalysis?.objects_detected)
    ? videoAnalysis.objects_detected
    : [];
  const focusObject = objects[0] || "primary subject";
  const hasAnnotations =
    Array.isArray(annotationAnalysis?.highlighted_regions) &&
    annotationAnalysis.highlighted_regions.length > 0;

  return [
    {
      id: "q1",
      question: `How suspicious is the behavior around ${focusObject}?`,
      choices: ["Highly suspicious", "Needs more evidence", "Likely normal"],
    },
    {
      id: "q2",
      question: hasAnnotations
        ? "Which annotated region should be prioritized in the final report?"
        : "Should we prioritize motion pattern anomalies over object proximity?",
      choices: ["Yes, prioritize", "Balanced weighting", "No, deprioritize"],
    },
    {
      id: "q3",
      question: "What confidence level should the top scenario target?",
      choices: [">= 80%", "60-79%", "< 60%"],
    },
  ];
}

function normalizeThreatLevel(value) {
  const level = String(value || "moderate").toLowerCase();
  if (["critical", "high", "elevated", "moderate"].includes(level)) {
    return level;
  }
  if (level === "low") return "moderate";
  return "moderate";
}

function fallbackFinalReport(cameraContext, analysisContext, answers) {
  const video = analysisContext?.video_analysis || fallbackVideoAnalysis(cameraContext);
  const annotation =
    analysisContext?.annotation_analysis ||
    fallbackAnnotationAnalysis(null, []);
  const answerHints = Array.isArray(answers)
    ? answers.map((a) => `${a.question}: ${a.answer || "Skipped"}`)
    : [];

  const scenarios = [
    {
      title: "Coordinated movement around key object",
      probability: 72,
      justification:
        "Object co-occurrence and event timing suggest intentional movement rather than random presence.",
    },
    {
      title: "Routine scene activity",
      probability: 48,
      justification:
        "Detected objects and spacing can be explained by normal scene flow without direct conflict.",
    },
  ];

  return {
    scene_description:
      video.scene_description ||
      "Scene contains several detected objects with moderate event density.",
    objects_detected: video.objects_detected || [],
    threat_level: "moderate",
    scenarios,
    recommendation:
      "Collect additional temporal context and verify key regions highlighted in annotations.",
    answer_considerations: answerHints,
    annotation_notes: annotation.annotation_findings || [],
  };
}

function composeNarrative(finalData) {
  const sceneDescription =
    finalData?.scene_description || "No scene description was produced.";
  const objects = Array.isArray(finalData?.objects_detected)
    ? finalData.objects_detected
    : [];
  const scenarios = Array.isArray(finalData?.scenarios) ? finalData.scenarios : [];

  const objectLine =
    objects.length > 0 ? objects.join(", ") : "No dominant objects detected.";

  const scenarioLines =
    scenarios.length > 0
      ? scenarios
          .sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0))
          .map((scenario, idx) => {
            const probability = Number(scenario.probability || 0);
            return `${idx + 1}. ${scenario.title} (${probability}%): ${scenario.justification}`;
          })
          .join("\n")
      : "1. No ranked scenarios were generated.";

  return `Scene description: ${sceneDescription}\n\nObjects detected: ${objectLine}\n\nProbable scenarios (ranked):\n${scenarioLines}`;
}

function buildReportPayload(finalData, cameraContext) {
  const scenarios = Array.isArray(finalData?.scenarios) ? finalData.scenarios : [];
  const threatLevel = normalizeThreatLevel(finalData?.threat_level);
  const threatLabel =
    threatLevel === "critical"
      ? "Critical Risk"
      : threatLevel === "high"
        ? "High Risk"
        : threatLevel === "elevated"
          ? "Elevated Risk"
          : "Moderate Risk";

  return {
    case_id: `CASE-${Date.now().toString(36).toUpperCase()}`,
    observation_window: {
      event_count: Array.isArray(cameraContext?.events)
        ? cameraContext.events.length
        : 0,
    },
    threat_assessment: {
      level: threatLevel,
      label: threatLabel,
    },
    narrative: composeNarrative(finalData),
    key_findings: scenarios.map((scenario) => ({
      finding: `${scenario.title} (${Number(scenario.probability || 0)}%)`,
      significance: scenario.justification || "",
    })),
    recommendation:
      finalData?.recommendation ||
      "Review top-ranked scenarios and validate against additional footage.",
    capturedSummary: cameraContext?.summary || null,
    capturedEvents: Array.isArray(cameraContext?.events)
      ? cameraContext.events
      : [],
    scene_description: finalData?.scene_description || "",
    objects_detected: Array.isArray(finalData?.objects_detected)
      ? finalData.objects_detected
      : [],
    scenarios,
  };
}

router.post("/investigate/workflow/start", async (req, res) => {
  const {
    camera_context: cameraContext = null,
    captured_frame: capturedFrame = null,
    annotations = [],
  } = req.body || {};

  const safeAnnotations = sanitizeAnnotations(annotations);
  const cameraText = buildContextText(cameraContext);

  const videoFallback = fallbackVideoAnalysis(cameraContext);
  const videoAnalysis = await generateJson(
    [
      {
        text:
          `Analyze this camera summary and timeline data and return strict JSON with keys: scene_description (string), objects_detected (array of strings), key_observations (array of strings).\n\n${cameraText}`,
      },
    ],
    videoFallback,
  );

  const annotationFallback = fallbackAnnotationAnalysis(capturedFrame, safeAnnotations);
  let annotationAnalysis = annotationFallback;

  const capturedRgb = stripBase64Prefix(capturedFrame?.rgb_base64 || "");
  if (capturedRgb || safeAnnotations.length > 0) {
    annotationAnalysis = await generateJson(
      [
        {
          text:
            `Analyze this captured frame and investigator annotations. Return strict JSON with keys: annotation_findings (array of strings), highlighted_regions (array of objects with label and short_note).\nAnnotations: ${JSON.stringify(safeAnnotations)}`,
        },
        ...(capturedRgb
          ? [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: capturedRgb,
                },
              },
            ]
          : []),
      ],
      annotationFallback,
    );
  }

  const questionsFallback = fallbackQuestions(videoAnalysis, annotationAnalysis);
  const questionsRaw = await generateJson(
    [
      {
        text:
          `Create 3 to 5 follow-up multiple-choice questions to guide a crime-scene investigation. Use this context:\nVideo analysis: ${JSON.stringify(videoAnalysis)}\nAnnotation analysis: ${JSON.stringify(annotationAnalysis)}\n\nReturn strict JSON with this shape: {"questions":[{"id":"q1","question":"...","choices":[{"id":"q1_c1","text":"..."},{"id":"q1_c2","text":"..."},{"id":"q1_c3","text":"..."}]}]}`,
      },
    ],
    { questions: questionsFallback },
  );

  const normalizedQuestions = normalizeQuestions(
    Array.isArray(questionsRaw) ? questionsRaw : questionsRaw?.questions,
  );

  res.json({
    analysis_context: {
      video_analysis: videoAnalysis,
      annotation_analysis: annotationAnalysis,
      generated_at: new Date().toISOString(),
    },
    questions:
      normalizedQuestions.length > 0
        ? normalizedQuestions
        : normalizeQuestions(questionsFallback),
  });
});

router.post("/investigate/workflow/finalize", async (req, res) => {
  const {
    camera_context: cameraContext = null,
    analysis_context: analysisContext = null,
    questions = [],
    answers = [],
  } = req.body || {};

  const fallback = fallbackFinalReport(cameraContext, analysisContext, answers);
  const finalRaw = await generateJson(
    [
      {
        text:
          `You are producing a final crime-scene report. Combine all contexts and return strict JSON with keys: scene_description (string), objects_detected (array of strings), threat_level (one of low/moderate/elevated/high/critical), scenarios (array of {title, probability, justification}), recommendation (string).\n\nCamera context: ${JSON.stringify(cameraContext)}\nAnalysis context: ${JSON.stringify(analysisContext)}\nQuestions: ${JSON.stringify(questions)}\nAnswers: ${JSON.stringify(answers)}\n\nEnsure scenarios are logical and ranked by probability.`,
      },
    ],
    fallback,
  );

  const finalData = {
    ...fallback,
    ...(finalRaw && typeof finalRaw === "object" ? finalRaw : {}),
  };

  const report = buildReportPayload(finalData, cameraContext);

  res.json({
    report,
    scene_description: report.scene_description,
    objects_detected: report.objects_detected,
    scenarios: report.scenarios,
  });
});

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
