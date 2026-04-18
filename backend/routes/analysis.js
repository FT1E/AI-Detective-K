import { Router } from "express";
import { CRIME_SCENE, DUMMY_CASE_DATA, generateIncidentReport } from "../shared.js";

const router = Router();

function buildCrimeSceneAnalysis(scene) {
  const subjectsById = {};
  for (const s of scene.subjects) {
    subjectsById[s.id] = { id: s.id, label: s.label, desc: s.description };
  }
  const zonesById = {};
  for (const z of scene.zones) {
    zonesById[z.id] = z.name;
  }

  function resolveSubject(subjectValue) {
    const tokens = subjectValue.split(",").map((t) => t.trim());
    const known = tokens.filter((t) => subjectsById[t]).map((t) => subjectsById[t]);

    if (known.length === 1 && tokens.length === 1) return known[0];
    if (known.length > 0) {
      return {
        id: known.map((s) => s.id).join("+"),
        label: known.map((s) => s.label).join(" + "),
        desc: "Coordinated activity involving multiple subjects",
      };
    }
    return { id: "UNKNOWN", label: "Unknown Subject", desc: "Unidentified signature detected through thermal/depth evidence" };
  }

  const timelineEvents = scene.events.map((event) => ({
    type: event.type,
    severity: event.severity,
    summary: event.summary,
    detail: event.detail,
    sensors: event.sensors,
    evidence_type: event.evidence_type,
    timestamp: `${scene.date}T${event.time}`,
    subject: resolveSubject(event.subject),
    zone: zonesById[event.zone] || event.zone,
    confidence: event.confidence,
  }));

  return {
    events: timelineEvents,
    report: generateIncidentReport(timelineEvents),
    case_data: DUMMY_CASE_DATA,
  };
}

router.get("/analysis/demo", (_req, res) => {
  res.json(buildCrimeSceneAnalysis(CRIME_SCENE));
});

export default router;
