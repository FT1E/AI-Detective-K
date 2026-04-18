// ---------------------------------------------------------------------------
// Shared state, constants, and helpers used across route modules
// ---------------------------------------------------------------------------

// ── In-memory state ──
export const state = {
  recording: false,
  events: [],
  cameraDataStore: [],
};

// ── Subject / Zone data ──
export const SUBJECTS = [
  { id: "S-1", label: "Subject Alpha", desc: "Male, dark jacket, approx 180cm" },
  { id: "S-2", label: "Subject Beta", desc: "Female, red coat, carrying bag" },
  { id: "S-3", label: "Subject Gamma", desc: "Male, hoodie, face partially obscured" },
  { id: "S-4", label: "Subject Delta", desc: "Unknown gender, bulky clothing" },
];

export const ZONES = [
  "Zone A — Entrance",
  "Zone B — Corridor",
  "Zone C — Storage Area",
  "Zone D — Exit",
];

// ── Dummy case data ──
export const DUMMY_CASE_DATA = {
  scene_data: {
    location: "Belmont Industrial Park — Warehouse 14, East Wing",
    time: "23:40",
    date: "2026-04-17",
    environment: "dark, rain, 14°C exterior, 17°C interior",
    objects_detected: [
      "person (S-1, male, dark jacket, 182cm)",
      "person (S-3, male, hoodie, face obscured, 175cm)",
      "concealed heat source (36.2°C behind shelving unit)",
      "dark bag (35x25cm, ambient temp 19.2°C)",
      "broken fire exit seal",
      "shelving unit",
      "stacked crates",
    ],
    thermal_activity: {
      S_1_baseline: "36.4°C (stable throughout)",
      S_3_baseline: "37.1°C (elevated on entry, peaked 37.8°C post-exchange)",
      concealed_source: "36.2°C behind shelving — invisible on RGB",
      deposited_object: "19.2°C — matches ambient, not recently body-carried",
      hand_transfer: "S-3 right hand +0.4°C transient spike at 23:43:30",
    },
    depth_data: {
      S_1_height: "182cm",
      S_3_height: "175cm",
      concealment_pocket: "0.8m gap behind shelving unit, profile matches crouching adult",
      deposited_object_size: "35cm x 25cm x 15cm, ground level",
      hand_movement: "tracked at 1.1m height during 8-second interaction window",
      door_swing: "fire exit door opened at 23:38:15, depth detected arc",
    },
    movement: {
      S_1_entry: "side loading dock door (not main entrance), 23:36:04",
      S_1_path: "avoided 2 camera cones — 12m detour, requires prior knowledge",
      S_1_loitering: "stationary in Storage Bay 3 for 4m 23s, facing shelving",
      S_1_exit: "same loading dock, 7.1 km/h, controlled pace, 36.5°C",
      S_3_entry: "rear fire exit, 23:38:15, irregular stride (stress)",
      S_3_erratic: "7 direction changes in 12 seconds, 4.2x above baseline, no obstacles",
      S_3_exit: "rear fire exit, 9.2 km/h (3.7x baseline), panicked, 37.5°C",
      exit_gap: "98 seconds between S-3 and S-1 departures — staggered",
    },
  },
  evidence: [
    { id: "E-01", time: "23:36:04", type: "entry", subject: "S-1", sensor: "rgb+depth+thermal", detail: "S-1 entered via side loading dock door. Depth: 182cm. Thermal: 36.4°C. Avoided main entrance." },
    { id: "E-02", time: "23:37:22", type: "camera_avoidance", subject: "S-1", sensor: "thermal+depth", detail: "S-1 took 12m detour around 2 primary camera coverage cones. Only detected by thermal peripheral sensor." },
    { id: "E-03", time: "23:38:15", type: "entry", subject: "S-3", sensor: "rgb+depth+thermal", detail: "S-3 entered through rear fire exit. Thermal: 37.1°C (elevated). Irregular stride pattern. Fire exit seal broken." },
    { id: "E-04", time: "23:39:50", type: "loitering", subject: "S-1", sensor: "thermal+depth", detail: "S-1 stationary in Storage Bay 3 for 4m 23s. Near-total darkness — RGB useless. Thermal confirmed living human. Facing shelving unit." },
    { id: "E-05", time: "23:41:08", type: "concealed_presence", subject: "unknown", sensor: "thermal+depth", detail: "36.2°C heat source behind shelving unit. Invisible on RGB. Depth: 0.8m concealment pocket. Profile consistent with crouching adult ~170cm. 0.2°C below S-1 baseline." },
    { id: "E-06", time: "23:43:30", type: "physical_exchange", subject: "S-1+S-3", sensor: "rgb+depth+thermal", detail: "S-1 and S-3 converged <0.4m for 8 seconds. Depth: hand-level movement at 1.1m. Post-contact: S-3 right hand +0.4°C. Immediate separation in opposite directions." },
    { id: "E-07", time: "23:44:15", type: "stress_behavior", subject: "S-3", sensor: "rgb+thermal+depth", detail: "7 direction reversals in 12 seconds (4.2x baseline). Thermal: 37.8°C. Depth confirms no obstacles — purely behavioral. Speed oscillating 3.2-4.1 km/h." },
    { id: "E-08", time: "23:45:02", type: "object_deposited", subject: "S-1", sensor: "depth+rgb+thermal", detail: "New object on ground: 35x25x15cm dark bag. Thermal: 19.2°C (ambient). NOT recently body-carried (would be 30-34°C). Pre-positioned or insulated." },
    { id: "E-09", time: "23:46:30", type: "flight", subject: "S-3", sensor: "rgb+depth+thermal", detail: "S-3 exited via rear fire exit at 9.2 km/h (3.7x baseline). Thermal: 37.5°C. Did not look back. Door left ajar." },
    { id: "E-10", time: "23:48:10", type: "controlled_exit", subject: "S-1", sensor: "rgb+depth+thermal", detail: "S-1 exited via loading dock at 7.1 km/h. Thermal: 36.5°C (near baseline). Controlled, deliberate. 98s after S-3 — staggered departure." },
  ],
  questions_asked: [],
  answers: [],
  hypotheses: [],
};

// ── Crime scene data ──
export const CRIME_SCENE = {
  case_id: "DK-20260418-7742",
  location: "Belmont Industrial Park — Warehouse 14, East Wing",
  time_of_incident: "23:40",
  date: "2026-04-17",
  observation_window: { start: "2026-04-17T23:35:12", end: "2026-04-17T23:48:47" },
  environment: {
    lighting: "No overhead lighting. Emergency exit sign only. Near-total darkness in Zone C.",
    weather: "Light rain, 14°C exterior, 17°C interior",
    visibility: "RGB effective only in Zones A, D (exit signs). Thermal/depth critical for B, C.",
  },
  zones: [
    { id: "zone-a", name: "Loading Dock Entrance", x: 10, y: 60, w: 25, h: 30, lighting: "dim" },
    { id: "zone-b", name: "Main Corridor", x: 35, y: 40, w: 15, h: 45, lighting: "dark" },
    { id: "zone-c", name: "Storage Bay 3", x: 55, y: 20, w: 30, h: 50, lighting: "none" },
    { id: "zone-d", name: "Rear Fire Exit", x: 70, y: 75, w: 20, h: 20, lighting: "exit-sign" },
  ],
  objects: [
    { id: "obj-1", type: "shelving_unit", x: 72, y: 35, w: 8, h: 18, label: "Shelving Unit" },
    { id: "obj-2", type: "deposited_bag", x: 62, y: 52, w: 4, h: 3, label: "Dark Bag", temp: 19.2, appeared_at: "23:45:02" },
    { id: "obj-3", type: "forklift", x: 20, y: 70, w: 8, h: 5, label: "Parked Forklift" },
    { id: "obj-4", type: "crates", x: 58, y: 25, w: 10, h: 8, label: "Stacked Crates" },
  ],
  subjects: [
    {
      id: "S-1", label: "Subject Alpha",
      description: "Male, dark jacket, approx 182cm, athletic build",
      thermal_baseline: 36.4,
      path: [
        { x: 12, y: 75, time: "23:36:04", zone: "zone-a", temp: 36.4, speed: 1.2 },
        { x: 18, y: 68, time: "23:36:30", zone: "zone-a", temp: 36.4, speed: 0.8 },
        { x: 25, y: 55, time: "23:37:22", zone: "zone-a", temp: 36.5, speed: 1.4 },
        { x: 38, y: 48, time: "23:38:00", zone: "zone-b", temp: 36.4, speed: 1.1 },
        { x: 42, y: 42, time: "23:39:10", zone: "zone-b", temp: 36.4, speed: 0.9 },
        { x: 60, y: 38, time: "23:39:50", zone: "zone-c", temp: 36.4, speed: 0.0 },
        { x: 60, y: 38, time: "23:43:20", zone: "zone-c", temp: 36.5, speed: 0.0 },
        { x: 62, y: 40, time: "23:43:30", zone: "zone-c", temp: 36.6, speed: 0.3 },
        { x: 60, y: 38, time: "23:43:38", zone: "zone-c", temp: 36.5, speed: 0.0 },
        { x: 62, y: 50, time: "23:45:02", zone: "zone-c", temp: 36.5, speed: 0.5 },
        { x: 58, y: 55, time: "23:46:00", zone: "zone-c", temp: 36.5, speed: 1.8 },
        { x: 45, y: 60, time: "23:47:00", zone: "zone-b", temp: 36.5, speed: 2.0 },
        { x: 22, y: 72, time: "23:48:10", zone: "zone-a", temp: 36.5, speed: 2.0 },
      ],
    },
    {
      id: "S-3", label: "Subject Gamma",
      description: "Male, hoodie, face obscured, approx 175cm, nervous gait",
      thermal_baseline: 37.1,
      path: [
        { x: 75, y: 88, time: "23:38:15", zone: "zone-d", temp: 37.1, speed: 1.5 },
        { x: 68, y: 78, time: "23:38:45", zone: "zone-d", temp: 37.2, speed: 1.8 },
        { x: 48, y: 55, time: "23:40:00", zone: "zone-b", temp: 37.0, speed: 1.3 },
        { x: 55, y: 42, time: "23:42:00", zone: "zone-c", temp: 37.1, speed: 0.8 },
        { x: 61, y: 40, time: "23:43:28", zone: "zone-c", temp: 37.2, speed: 1.0 },
        { x: 63, y: 40, time: "23:43:30", zone: "zone-c", temp: 37.4, speed: 0.2 },
        { x: 63, y: 42, time: "23:43:38", zone: "zone-c", temp: 37.6, speed: 2.5 },
        { x: 50, y: 50, time: "23:44:00", zone: "zone-b", temp: 37.5, speed: 3.2 },
        { x: 45, y: 55, time: "23:44:08", zone: "zone-b", temp: 37.8, speed: 3.8 },
        { x: 48, y: 50, time: "23:44:12", zone: "zone-b", temp: 37.8, speed: 4.1 },
        { x: 42, y: 58, time: "23:44:15", zone: "zone-b", temp: 37.8, speed: 3.5 },
        { x: 72, y: 82, time: "23:46:00", zone: "zone-d", temp: 37.6, speed: 2.6 },
        { x: 78, y: 90, time: "23:46:30", zone: "zone-d", temp: 37.5, speed: 2.6 },
      ],
    },
  ],
  concealed_presence: {
    x: 74, y: 38, temp: 36.2, detected_at: "23:41:08",
    zone: "zone-c", behind: "obj-1",
    depth_pocket: "0.8m gap behind shelving",
    note: "Invisible on RGB. Only thermal + depth detected this.",
  },
  events: [
    { id: "ev-01", time: "23:36:04", type: "entry_detected", severity: "low", zone: "zone-a", subject: "S-1", summary: "Subject Alpha entered via loading dock side door", detail: "RGB captured silhouette at entrance. Depth sensor measured height: 182cm. Thermal baseline recorded: 36.4°C. Subject avoided main entrance — used manual dock door instead.", sensors: ["rgb", "depth", "thermal"], evidence_type: "movement", confidence: 0.94, oak_data: { bbox: [10, 55, 18, 85], depth_m: 3.2, temp: 36.4 } },
    { id: "ev-02", time: "23:37:22", type: "path_avoidance", severity: "medium", zone: "zone-a", subject: "S-1", summary: "S-1 deliberately avoided 2 primary camera positions", detail: "Trajectory analysis: subject took a 12m detour around camera coverage cones. Path requires prior knowledge of camera placement. Only detected by thermal peripheral sensor at edge of Zone A.", sensors: ["thermal", "depth"], evidence_type: "behavioral", confidence: 0.88, oak_data: { bbox: [22, 50, 30, 65], depth_m: 5.1, temp: 36.5 } },
    { id: "ev-03", time: "23:38:15", type: "entry_detected", severity: "low", zone: "zone-d", subject: "S-3", summary: "Subject Gamma entered through rear fire exit", detail: "Fire exit opened (depth detected door swing). Subject entered with elevated thermal: 37.1°C — above normal baseline, consistent with recent physical exertion or stress. Gait analysis: irregular stride pattern.", sensors: ["rgb", "depth", "thermal"], evidence_type: "movement", confidence: 0.92, oak_data: { bbox: [70, 80, 80, 95], depth_m: 2.8, temp: 37.1 } },
    { id: "ev-04", time: "23:39:50", type: "loitering", severity: "medium", zone: "zone-c", subject: "S-1", summary: "S-1 stationary in Storage Bay 3 for 4m 23s", detail: "Subject stopped moving in near-total darkness (RGB useless). Thermal: consistent 36.4°C confirming living presence. Depth profile unchanged across 340 frames — not an abandoned object. Position: facing shelving unit obj-1.", sensors: ["thermal", "depth"], evidence_type: "behavioral", confidence: 0.91, oak_data: { bbox: [56, 30, 64, 50], depth_m: 1.5, temp: 36.4 } },
    { id: "ev-05", time: "23:41:08", type: "concealed_presence", severity: "high", zone: "zone-c", subject: "Unknown", summary: "Hidden individual detected behind shelving — thermal only", detail: "36.2°C heat source detected behind shelving unit (obj-1). Completely invisible on RGB camera. Depth mapping reveals 0.8m concealment pocket between shelving and wall. Heat signature profile: crouching adult, approximately 170cm. Thermal is 0.2°C below S-1's baseline — possible third individual.", sensors: ["thermal", "depth"], evidence_type: "spatial", confidence: 0.87, oak_data: { bbox: [70, 30, 78, 45], depth_m: 0.8, temp: 36.2, rgb_visible: false } },
    { id: "ev-06", time: "23:43:30", type: "suspicious_interaction", severity: "high", zone: "zone-c", subject: "S-1, S-3", summary: "8-second close-proximity exchange between S-1 and S-3", detail: "Subjects converged to <0.4m separation for exactly 8 seconds. Depth sensors tracked hand-level movement at 1.1m height during contact window. Post-separation thermal: S-3's right hand region showed transient temperature increase (+0.4°C) consistent with receiving a recently body-warmed object. Immediate divergence in opposite directions.", sensors: ["rgb", "depth", "thermal"], evidence_type: "interpersonal", confidence: 0.93, oak_data: { bbox: [58, 35, 66, 48], depth_m: 1.2, temp_s1: 36.6, temp_s3: 37.4, hand_movement: true } },
    { id: "ev-07", time: "23:44:15", type: "erratic_movement", severity: "high", zone: "zone-b", subject: "S-3", summary: "S-3: 7 direction changes in 12 seconds — stress indicator", detail: "Post-exchange, S-3 exhibited erratic movement: 7 direction reversals in 12 seconds (4.2x above pedestrian baseline). Thermal spiked to 37.8°C — physiological stress response. Depth tracking confirms no physical obstacles — movement was purely behavioral. Speed oscillated between 3.2 and 4.1 km/h.", sensors: ["rgb", "thermal", "depth"], evidence_type: "behavioral", confidence: 0.95, oak_data: { bbox: [40, 48, 52, 62], depth_m: 4.5, temp: 37.8, direction_changes: 7 } },
    { id: "ev-08", time: "23:45:02", type: "object_deposited", severity: "medium", zone: "zone-c", subject: "S-1", summary: "Dark bag deposited at ground level in storage area", detail: "Depth map delta: new object appeared (35cm x 25cm x 15cm) at ground level near crates (obj-4). RGB: dark-colored bag/package. Thermal: 19.2°C — matches ambient interior temperature. Object was NOT recently body-carried (would read ~30-34°C). Suggests pre-positioning hours earlier, or insulated container.", sensors: ["depth", "rgb", "thermal"], evidence_type: "physical", confidence: 0.90, oak_data: { bbox: [60, 48, 65, 55], depth_m: 0.3, temp: 19.2, size_cm: [35, 25, 15] } },
    { id: "ev-09", time: "23:46:30", type: "rapid_exit", severity: "medium", zone: "zone-d", subject: "S-3", summary: "S-3 fled at 9.2 km/h through rear fire exit", detail: "Subject Gamma accelerated to 9.2 km/h (3.7x pedestrian baseline) toward rear fire exit. Thermal remained elevated: 37.5°C. Used same exit as entry. Did not look back (head orientation tracked via depth). Door left ajar.", sensors: ["rgb", "depth", "thermal"], evidence_type: "movement", confidence: 0.96, oak_data: { bbox: [72, 82, 82, 96], depth_m: 6.2, temp: 37.5, speed_kmh: 9.2 } },
    { id: "ev-10", time: "23:48:10", type: "rapid_exit", severity: "medium", zone: "zone-a", subject: "S-1", summary: "S-1 exited calmly at 7.1 km/h via loading dock — different exit", detail: "Subject Alpha departed via original entry point (loading dock). Speed: 7.1 km/h — elevated but controlled. Thermal: 36.5°C — near baseline, no stress indicators. Took deliberate route. 98-second gap between S-3 and S-1 exits suggests coordinated staggered departure.", sensors: ["rgb", "depth", "thermal"], evidence_type: "movement", confidence: 0.94, oak_data: { bbox: [15, 68, 25, 82], depth_m: 4.0, temp: 36.5, speed_kmh: 7.1 } },
  ],
  sensor_summary: {
    rgb_detections: 7,
    thermal_detections: 10,
    depth_detections: 10,
    thermal_only_events: 2,
    note: "Concealed presence and camera avoidance only detectable via thermal+depth. Standard CCTV would have missed 3 of 10 events entirely, and 2 more would lack critical detail.",
  },
};

// ── Gemini config ──
export const DETECTIVE_SYSTEM_PROMPT = `You are Detective K, an elite AI crime scene investigator. You analyze multi-modal sensor data (RGB video, thermal imaging, depth mapping) to reconstruct what happened at an incident scene.

Your role:
- Analyze evidence methodically, piece by piece
- Ask pointed follow-up questions to the human investigator to fill gaps
- Suggest specific things to check (camera angles, timestamps, zones, thermal signatures)
- Build hypotheses and rank them by likelihood
- Think out loud — show your reasoning process
- Be specific: reference subject IDs, zones, timestamps, sensor types
- When you spot something suspicious, explain WHY it's suspicious using the sensor data

Style: Professional but engaging. You're a seasoned detective who gets excited when pieces click together. Use short paragraphs. Be direct.

When given case data, start by identifying the most critical findings, then systematically work through the evidence. Ask the investigator 2-3 targeted questions after your initial analysis.`;

// ── Helper: random helpers ──
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Generate timeline event ──
export function generateTimelineEvent(baseTime, offsetSeconds) {
  const timestamp = new Date(baseTime.getTime() + offsetSeconds * 1000);
  const subject = randChoice(SUBJECTS);
  const zone = ZONES[Math.min(Math.floor(offsetSeconds / 30), 3)];

  const eventPool = [
    {
      type: "entry_detected", severity: "low",
      summary: `${subject.label} entered ${zone}`,
      detail: `RGB camera detected individual entering monitored area. Depth sensor measures height at ~${randInt(165, 190)}cm. Thermal baseline recorded at ${randFloat(36.0, 37.2)}°C.`,
      sensors: ["rgb", "depth", "thermal"], evidence_type: "movement",
    },
    {
      type: "loitering", severity: "medium",
      summary: `${subject.label} stationary in ${zone} for ${randInt(2, 8)}m ${randInt(0, 59)}s`,
      detail: `Subject remained stationary beyond normal dwell threshold. Thermal signature consistent at ${randFloat(36.2, 37.0)}°C — confirms living presence, not abandoned object. Depth profile unchanged across ${randInt(40, 200)} frames.`,
      sensors: ["thermal", "depth"], evidence_type: "behavioral",
    },
    {
      type: "erratic_movement", severity: "high",
      summary: `${subject.label} exhibited ${randInt(4, 9)} rapid direction changes in ${zone}`,
      detail: `Trajectory analysis detected ${randInt(4, 9)} direction reversals in ${randInt(8, 20)} seconds — ${randFloat(3.0, 5.5)}x above pedestrian baseline. Thermal shows elevated skin temperature (${randFloat(37.2, 38.1)}°C) indicating physiological stress. Depth tracking confirms no obstacle-driven path changes.`,
      sensors: ["rgb", "thermal", "depth"], evidence_type: "behavioral",
    },
    {
      type: "concealed_presence", severity: "high",
      summary: `Hidden individual detected behind obstruction in ${zone}`,
      detail: `Thermal imaging identified a ${randFloat(35.8, 37.0)}°C heat source behind physical obstruction invisible on RGB feed. Depth mapping confirms obstruction geometry creates a ${randFloat(0.5, 1.5)}m concealment pocket. Heat signature profile consistent with crouching adult.`,
      sensors: ["thermal", "depth"], evidence_type: "spatial",
    },
    {
      type: "suspicious_interaction", severity: "high",
      summary: `Brief exchange between ${SUBJECTS[0].label} and ${SUBJECTS[2].label} in ${zone}`,
      detail: `Two subjects converged to <0.4m for ${randInt(3, 12)} seconds then rapidly separated in opposite directions. Depth sensors tracked hand-level movement during contact. Thermal shows transient heat transfer on one subject's hand region post-interaction.`,
      sensors: ["rgb", "depth", "thermal"], evidence_type: "interpersonal",
    },
    {
      type: "object_deposited", severity: "medium",
      summary: `Object left at ground level in ${zone}`,
      detail: `Depth map delta detected a new object (${randInt(20, 45)}cm x ${randInt(15, 30)}cm) at ground level not present in baseline scan. RGB identifies dark-colored bag. Thermal reads ambient temperature (${randFloat(18.0, 22.0)}°C) — object was not recently body-carried for extended period.`,
      sensors: ["depth", "rgb", "thermal"], evidence_type: "physical",
    },
    {
      type: "rapid_exit", severity: "medium",
      summary: `${subject.label} exited at ${randFloat(6.0, 12.0)} km/h through ${zone}`,
      detail: `Subject velocity measured at ${randFloat(6.0, 12.0)} km/h — ${randFloat(2.5, 4.8)}x above pedestrian baseline for this zone. Depth tracking confirms continuous acceleration toward exit. Thermal shows elevated signature consistent with exertion.`,
      sensors: ["rgb", "depth", "thermal"], evidence_type: "movement",
    },
    {
      type: "path_avoidance", severity: "medium",
      summary: `${subject.label} deliberately avoided camera coverage in ${zone}`,
      detail: `Trajectory analysis shows subject navigated a non-standard path that minimizes exposure to primary RGB cameras. Depth data reveals navigation around ${randInt(2, 4)} obstacles with precision suggesting prior familiarity. Only detected via thermal peripheral coverage.`,
      sensors: ["thermal", "depth"], evidence_type: "behavioral",
    },
  ];

  const event = randChoice(eventPool);
  return {
    ...event,
    timestamp: timestamp.toISOString(),
    subject,
    zone,
    confidence: randFloat(0.78, 0.97, 2),
  };
}

// ── Generate incident report ──
export function generateIncidentReport(collectedEvents) {
  if (!collectedEvents || collectedEvents.length === 0) return null;

  const highEvents = collectedEvents.filter((e) => e.severity === "high");
  const mediumEvents = collectedEvents.filter((e) => e.severity === "medium");

  // Identify key subjects
  const subjectMap = {};
  for (const e of collectedEvents) {
    const sid = e.subject.id;
    if (!subjectMap[sid]) {
      subjectMap[sid] = { subject: e.subject, events: [], zones: new Set() };
    }
    subjectMap[sid].events.push(e);
    subjectMap[sid].zones.add(e.zone);
  }

  // Build subject profiles
  const subjectProfiles = Object.entries(subjectMap).map(([sid, data]) => {
    let severityMax = "low";
    for (const ev of data.events) {
      if (ev.severity === "high") { severityMax = "high"; break; }
      if (ev.severity === "medium") severityMax = "medium";
    }
    return {
      id: sid,
      label: data.subject.label,
      description: data.subject.desc,
      involvement_level: severityMax,
      event_count: data.events.length,
      zones_visited: [...data.zones],
      first_seen: data.events[0].timestamp,
      last_seen: data.events[data.events.length - 1].timestamp,
    };
  });

  const severityOrder = { high: 0, medium: 1, low: 2 };
  subjectProfiles.sort((a, b) => (severityOrder[a.involvement_level] ?? 3) - (severityOrder[b.involvement_level] ?? 3));

  // Evidence chain
  const evidenceChain = collectedEvents.map((e, i) => ({
    sequence: i + 1,
    timestamp: e.timestamp,
    type: e.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    summary: e.summary,
    detail: e.detail,
    sensors_used: e.sensors,
    evidence_type: e.evidence_type,
    subject: e.subject.label,
    zone: e.zone,
    confidence: e.confidence,
    severity: e.severity,
  }));

  // Threat assessment
  let threatLevel, threatLabel;
  if (highEvents.length >= 3) {
    threatLevel = "critical";
    threatLabel = "CRITICAL — Multiple high-severity indicators detected";
  } else if (highEvents.length >= 1) {
    threatLevel = "high";
    threatLabel = "HIGH — Significant anomalous behavior confirmed";
  } else if (mediumEvents.length >= 2) {
    threatLevel = "elevated";
    threatLabel = "ELEVATED — Notable patterns requiring attention";
  } else {
    threatLevel = "moderate";
    threatLabel = "MODERATE — Minor anomalies observed";
  }

  // Sensor coverage
  const sensorContributions = {
    rgb: collectedEvents.filter((e) => e.sensors.includes("rgb")).length,
    thermal: collectedEvents.filter((e) => e.sensors.includes("thermal")).length,
    depth: collectedEvents.filter((e) => e.sensors.includes("depth")).length,
  };

  // Narrative
  const uniqueZones = new Set(collectedEvents.map((e) => e.zone));
  const narrativeParts = [
    `During the observation window, ${collectedEvents.length} distinct events were captured across ${uniqueZones.size} monitored zones. The system identified ${Object.keys(subjectMap).length} unique subjects through multi-modal sensor fusion.`,
  ];
  if (highEvents.length > 0) {
    const highTypes = [...new Set(highEvents.map((e) => e.type.replace(/_/g, " ")))].join(", ");
    narrativeParts.push(`${highEvents.length} high-severity events were flagged, primarily involving ${highTypes}. These detections were corroborated across multiple sensor modalities, increasing confidence.`);
  }
  if (collectedEvents.some((e) => e.type === "suspicious_interaction")) {
    narrativeParts.push("A brief physical interaction between subjects was detected with thermal confirmation of object transfer. The rapid separation pattern post-contact is consistent with covert exchange behavior.");
  }
  if (collectedEvents.some((e) => e.type === "concealed_presence")) {
    narrativeParts.push("Thermal imaging revealed at least one concealed individual not visible on standard RGB cameras. This detection was only possible through multi-modal sensor fusion — standard surveillance would have missed it.");
  }
  if (collectedEvents.some((e) => e.type === "object_deposited")) {
    narrativeParts.push("Depth analysis identified an object deposited and left unattended. Thermal readings indicate the object was not recently body-carried, suggesting premeditated placement.");
  }

  // Key findings
  const keyFindings = [];
  const findingChecks = [
    { type: "concealed_presence", finding: "Concealed individual detected via thermal-only", significance: "This person was invisible to standard RGB surveillance. Only thermal + depth fusion revealed their presence behind an obstruction.", implication: "Suggests deliberate concealment — this location may have been pre-selected." },
    { type: "suspicious_interaction", finding: "Covert exchange pattern identified", significance: "Brief convergence, hand-level activity confirmed by depth sensors, and immediate divergence in opposite directions.", implication: "Pattern is consistent with illicit handoff. Thermal confirmed transient heat transfer on hand region." },
    { type: "path_avoidance", finding: "Deliberate camera avoidance detected", significance: "Subject navigated a path that minimizes RGB camera exposure. Only detected via thermal peripheral coverage.", implication: "Indicates prior reconnaissance of camera positions and planned evasion." },
    { type: "erratic_movement", finding: "Stress-indicative movement pattern", significance: "Rapid directional changes combined with elevated thermal signature indicate physiological stress response.", implication: "Subject may have been acting under duress, or experiencing post-incident flight response." },
    { type: "rapid_exit", finding: "Rapid exit immediately following incident", significance: "Subject accelerated well above pedestrian baseline toward exit point.", implication: "Timing and velocity are consistent with post-incident departure behavior." },
  ];
  for (const check of findingChecks) {
    if (collectedEvents.some((e) => e.type === check.type)) {
      keyFindings.push({ finding: check.finding, significance: check.significance, implication: check.implication });
    }
  }
  if (keyFindings.length === 0) {
    keyFindings.push({ finding: "Abnormal behavioral pattern cluster", significance: "Multiple low-to-medium severity anomalies occurred in close temporal proximity.", implication: "While individual events may be benign, their clustering warrants further investigation." });
  }

  const now = new Date();
  return {
    case_id: `DK-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randInt(1000, 9999)}`,
    generated_at: now.toISOString(),
    observation_window: {
      start: collectedEvents[0].timestamp,
      end: collectedEvents[collectedEvents.length - 1].timestamp,
      event_count: collectedEvents.length,
    },
    threat_assessment: {
      level: threatLevel,
      label: threatLabel,
      high_severity_count: highEvents.length,
      medium_severity_count: mediumEvents.length,
    },
    narrative: narrativeParts.join(" "),
    key_findings: keyFindings,
    subject_profiles: subjectProfiles,
    evidence_chain: evidenceChain,
    sensor_coverage: sensorContributions,
    recommendation: "Based on multi-modal analysis, this incident warrants further investigation. Key evidence includes sensor-corroborated behavioral anomalies that would be undetectable through standard RGB surveillance alone. Thermal and depth data provide critical corroboration that strengthens the evidentiary value of each observation. Recommend cross-referencing subject profiles with historical incident database and reviewing full footage for the flagged time windows.",
  };
}
