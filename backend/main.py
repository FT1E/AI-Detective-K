
import asyncio
import json
import random
import threading
import time
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import cv2
import depthai as dai
import base64

from src.config import AsyncSessionLocal
from src.services import case_service, hash_service
from src.services.flare_service import flare_service
from src.api.routes import router as api_router

app = FastAPI(title="AI Detective K")
app.include_router(api_router, prefix="/api", tags=["cases"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

recording = False
current_case_id: str | None = None


SUBJECTS = [
    {"id": "S-1", "label": "Subject Alpha", "desc": "Male, dark jacket, approx 180cm"},
    {"id": "S-2", "label": "Subject Beta", "desc": "Female, red coat, carrying bag"},
    {"id": "S-3", "label": "Subject Gamma", "desc": "Male, hoodie, face partially obscured"},
    {"id": "S-4", "label": "Subject Delta", "desc": "Unknown gender, bulky clothing"},
]

ZONES = ["Zone A — Entrance", "Zone B — Corridor", "Zone C — Storage Area", "Zone D — Exit"]


def generate_timeline_event(base_time: datetime, offset_seconds: int):
    """Generate a single event in a coherent incident timeline."""
    timestamp = base_time + timedelta(seconds=offset_seconds)
    subject = random.choice(SUBJECTS)
    zone = ZONES[min(offset_seconds // 30, 3)]  # progress through zones over time

    event_pool = [
        {
            "type": "entry_detected",
            "severity": "low",
            "summary": f"{subject['label']} entered {zone}",
            "detail": f"RGB camera detected individual entering monitored area. Depth sensor measures height at ~{random.randint(165, 190)}cm. Thermal baseline recorded at {round(random.uniform(36.0, 37.2), 1)}°C.",
            "sensors": ["rgb", "depth", "thermal"],
            "evidence_type": "movement",
        },
        {
            "type": "loitering",
            "severity": "medium",
            "summary": f"{subject['label']} stationary in {zone} for {random.randint(2, 8)}m {random.randint(0, 59)}s",
            "detail": f"Subject remained stationary beyond normal dwell threshold. Thermal signature consistent at {round(random.uniform(36.2, 37.0), 1)}°C — confirms living presence, not abandoned object. Depth profile unchanged across {random.randint(40, 200)} frames.",
            "sensors": ["thermal", "depth"],
            "evidence_type": "behavioral",
        },
        {
            "type": "erratic_movement",
            "severity": "high",
            "summary": f"{subject['label']} exhibited {random.randint(4, 9)} rapid direction changes in {zone}",
            "detail": f"Trajectory analysis detected {random.randint(4, 9)} direction reversals in {random.randint(8, 20)} seconds — {round(random.uniform(3.0, 5.5), 1)}x above pedestrian baseline. Thermal shows elevated skin temperature ({round(random.uniform(37.2, 38.1), 1)}°C) indicating physiological stress. Depth tracking confirms no obstacle-driven path changes.",
            "sensors": ["rgb", "thermal", "depth"],
            "evidence_type": "behavioral",
        },
        {
            "type": "concealed_presence",
            "severity": "high",
            "summary": f"Hidden individual detected behind obstruction in {zone}",
            "detail": f"Thermal imaging identified a {round(random.uniform(35.8, 37.0), 1)}°C heat source behind physical obstruction invisible on RGB feed. Depth mapping confirms obstruction geometry creates a {round(random.uniform(0.5, 1.5), 1)}m concealment pocket. Heat signature profile consistent with crouching adult.",
            "sensors": ["thermal", "depth"],
            "evidence_type": "spatial",
        },
        {
            "type": "suspicious_interaction",
            "severity": "high",
            "summary": f"Brief exchange between {SUBJECTS[0]['label']} and {SUBJECTS[2]['label']} in {zone}",
            "detail": f"Two subjects converged to <0.4m for {random.randint(3, 12)} seconds then rapidly separated in opposite directions. Depth sensors tracked hand-level movement during contact. Thermal shows transient heat transfer on one subject's hand region post-interaction.",
            "sensors": ["rgb", "depth", "thermal"],
            "evidence_type": "interpersonal",
        },
        {
            "type": "object_deposited",
            "severity": "medium",
            "summary": f"Object left at ground level in {zone}",
            "detail": f"Depth map delta detected a new object ({random.randint(20, 45)}cm x {random.randint(15, 30)}cm) at ground level not present in baseline scan. RGB identifies dark-colored bag. Thermal reads ambient temperature ({round(random.uniform(18.0, 22.0), 1)}°C) — object was not recently body-carried for extended period.",
            "sensors": ["depth", "rgb", "thermal"],
            "evidence_type": "physical",
        },
        {
            "type": "rapid_exit",
            "severity": "medium",
            "summary": f"{subject['label']} exited at {round(random.uniform(6.0, 12.0), 1)} km/h through {zone}",
            "detail": f"Subject velocity measured at {round(random.uniform(6.0, 12.0), 1)} km/h — {round(random.uniform(2.5, 4.8), 1)}x above pedestrian baseline for this zone. Depth tracking confirms continuous acceleration toward exit. Thermal shows elevated signature consistent with exertion.",
            "sensors": ["rgb", "depth", "thermal"],
            "evidence_type": "movement",
        },
        {
            "type": "path_avoidance",
            "severity": "medium",
            "summary": f"{subject['label']} deliberately avoided camera coverage in {zone}",
            "detail": f"Trajectory analysis shows subject navigated a non-standard path that minimizes exposure to primary RGB cameras. Depth data reveals navigation around {random.randint(2, 4)} obstacles with precision suggesting prior familiarity. Only detected via thermal peripheral coverage.",
            "sensors": ["thermal", "depth"],
            "evidence_type": "behavioral",
        },
    ]

    event = random.choice(event_pool)
    return {
        **event,
        "timestamp": timestamp.isoformat(),
        "subject": subject,
        "zone": zone,
        "confidence": round(random.uniform(0.78, 0.97), 2),
    }


def generate_incident_report(collected_events: list[dict]) -> dict:
    """Generate a full post-crime investigation report from collected events."""
    if not collected_events:
        return None

    high_events = [e for e in collected_events if e["severity"] == "high"]
    medium_events = [e for e in collected_events if e["severity"] == "medium"]

    subject_ids = {}
    for e in collected_events:
        sid = e["subject"]["id"]
        if sid not in subject_ids:
            subject_ids[sid] = {"subject": e["subject"], "events": [], "zones": set()}
        subject_ids[sid]["events"].append(e)
        subject_ids[sid]["zones"].add(e["zone"])

    subject_profiles = []
    for sid, data in subject_ids.items():
        severity_max = "low"
        for ev in data["events"]:
            if ev["severity"] == "high":
                severity_max = "high"
                break
            if ev["severity"] == "medium":
                severity_max = "medium"
        subject_profiles.append({
            "id": sid,
            "label": data["subject"]["label"],
            "description": data["subject"]["desc"],
            "involvement_level": severity_max,
            "event_count": len(data["events"]),
            "zones_visited": list(data["zones"]),
            "first_seen": data["events"][0]["timestamp"],
            "last_seen": data["events"][-1]["timestamp"],
        })

    severity_order = {"high": 0, "medium": 1, "low": 2}
    subject_profiles.sort(key=lambda s: severity_order.get(s["involvement_level"], 3))

    evidence_chain = []
    for i, e in enumerate(collected_events):
        evidence_chain.append({
            "sequence": i + 1,
            "timestamp": e["timestamp"],
            "type": e["type"].replace("_", " ").title(),
            "summary": e["summary"],
            "detail": e["detail"],
            "sensors_used": e["sensors"],
            "evidence_type": e["evidence_type"],
            "subject": e["subject"]["label"],
            "zone": e["zone"],
            "confidence": e["confidence"],
            "severity": e["severity"],
        })

    if len(high_events) >= 3:
        threat_level = "critical"
        threat_label = "CRITICAL — Multiple high-severity indicators detected"
    elif len(high_events) >= 1:
        threat_level = "high"
        threat_label = "HIGH — Significant anomalous behavior confirmed"
    elif len(medium_events) >= 2:
        threat_level = "elevated"
        threat_label = "ELEVATED — Notable patterns requiring attention"
    else:
        threat_level = "moderate"
        threat_label = "MODERATE — Minor anomalies observed"

    sensor_contributions = {
        "rgb": sum(1 for e in collected_events if "rgb" in e["sensors"]),
        "thermal": sum(1 for e in collected_events if "thermal" in e["sensors"]),
        "depth": sum(1 for e in collected_events if "depth" in e["sensors"]),
    }

    narrative_parts = []
    narrative_parts.append(
        f"During the observation window, {len(collected_events)} distinct events were captured across {len(set(e['zone'] for e in collected_events))} monitored zones. "
        f"The system identified {len(subject_ids)} unique subjects through multi-modal sensor fusion."
    )
    if high_events:
        narrative_parts.append(
            f"{len(high_events)} high-severity events were flagged, primarily involving "
            f"{', '.join(set(e['type'].replace('_', ' ') for e in high_events))}. "
            f"These detections were corroborated across multiple sensor modalities, increasing confidence."
        )
    if any(e["type"] == "suspicious_interaction" for e in collected_events):
        narrative_parts.append(
            "A brief physical interaction between subjects was detected with thermal confirmation of object transfer. "
            "The rapid separation pattern post-contact is consistent with covert exchange behavior."
        )
    if any(e["type"] == "concealed_presence" for e in collected_events):
        narrative_parts.append(
            "Thermal imaging revealed at least one concealed individual not visible on standard RGB cameras. "
            "This detection was only possible through multi-modal sensor fusion — standard surveillance would have missed it."
        )
    if any(e["type"] == "object_deposited" for e in collected_events):
        narrative_parts.append(
            "Depth analysis identified an object deposited and left unattended. "
            "Thermal readings indicate the object was not recently body-carried, suggesting premeditated placement."
        )

    key_findings = []
    if any(e["type"] == "concealed_presence" for e in collected_events):
        key_findings.append({
            "finding": "Concealed individual detected via thermal-only",
            "significance": "This person was invisible to standard RGB surveillance. Only thermal + depth fusion revealed their presence behind an obstruction.",
            "implication": "Suggests deliberate concealment — this location may have been pre-selected.",
        })
    if any(e["type"] == "suspicious_interaction" for e in collected_events):
        key_findings.append({
            "finding": "Covert exchange pattern identified",
            "significance": "Brief convergence, hand-level activity confirmed by depth sensors, and immediate divergence in opposite directions.",
            "implication": "Pattern is consistent with illicit handoff. Thermal confirmed transient heat transfer on hand region.",
        })
    if any(e["type"] == "path_avoidance" for e in collected_events):
        key_findings.append({
            "finding": "Deliberate camera avoidance detected",
            "significance": "Subject navigated a path that minimizes RGB camera exposure. Only detected via thermal peripheral coverage.",
            "implication": "Indicates prior reconnaissance of camera positions and planned evasion.",
        })
    if any(e["type"] == "erratic_movement" for e in collected_events):
        key_findings.append({
            "finding": "Stress-indicative movement pattern",
            "significance": "Rapid directional changes combined with elevated thermal signature indicate physiological stress response.",
            "implication": "Subject may have been acting under duress, or experiencing post-incident flight response.",
        })
    if any(e["type"] == "rapid_exit" for e in collected_events):
        key_findings.append({
            "finding": "Rapid exit immediately following incident",
            "significance": "Subject accelerated well above pedestrian baseline toward exit point.",
            "implication": "Timing and velocity are consistent with post-incident departure behavior.",
        })
    if not key_findings:
        key_findings.append({
            "finding": "Abnormal behavioral pattern cluster",
            "significance": "Multiple low-to-medium severity anomalies occurred in close temporal proximity.",
            "implication": "While individual events may be benign, their clustering warrants further investigation.",
        })

    return {
        "generated_at": datetime.now().isoformat(),
        "observation_window": {
            "start": collected_events[0]["timestamp"],
            "end": collected_events[-1]["timestamp"],
            "event_count": len(collected_events),
        },
        "threat_assessment": {
            "level": threat_level,
            "label": threat_label,
            "high_severity_count": len(high_events),
            "medium_severity_count": len(medium_events),
        },
        "narrative": " ".join(narrative_parts),
        "key_findings": key_findings,
        "subject_profiles": subject_profiles,
        "evidence_chain": evidence_chain,
        "sensor_coverage": sensor_contributions,
        "recommendation": (
            "Based on multi-modal analysis, this incident warrants further investigation. "
            "Key evidence includes sensor-corroborated behavioral anomalies that would be undetectable "
            "through standard RGB surveillance alone. Thermal and depth data provide critical corroboration "
            "that strengthens the evidentiary value of each observation. Recommend cross-referencing subject "
            "profiles with historical incident database and reviewing full footage for the flagged time windows."
        ),
    }


@app.get("/api/status")
async def status():
    return {"recording": recording, "case_id": current_case_id}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    global recording, current_case_id
    session_events: list[dict] = []

    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)

            if data.get("action") == "start":
                recording = True
                session_events = []

                async with AsyncSessionLocal() as db:
                    current_case_id = await case_service.create_case(db)

                # Touch Point 1: record case creation on blockchain
                blockchain_tx_hash = None
                try:
                    bc_tx = await flare_service.create_case(
                        case_id=current_case_id,
                        metadata={"sensors": ["rgb", "thermal", "depth"], "location": "Crime Scene Investigation"},
                    )
                    blockchain_tx_hash = bc_tx["tx_hash"]
                    async with AsyncSessionLocal() as db:
                        await case_service.save_blockchain_record(db, current_case_id, "case_created", bc_tx)
                    print(f"[Blockchain] Case created: {blockchain_tx_hash}")
                except Exception as e:
                    print(f"[Blockchain] create_case skipped: {e}")

                await websocket.send_text(json.dumps({
                    "type": "status",
                    "recording": True,
                    "case_id": current_case_id,
                    **({"blockchain_tx": blockchain_tx_hash} if blockchain_tx_hash else {}),
                }))

                # OAK camera pipeline
                pipeline = dai.Pipeline()
                camRgb = pipeline.create(dai.node.ColorCamera)
                camRgb.setPreviewSize(640, 480)
                camRgb.setInterleaved(False)
                camRgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
                xoutRgb = pipeline.create(dai.node.XLinkOut)
                xoutRgb.setStreamName("video")
                camRgb.preview.link(xoutRgb.input)

                loop = asyncio.get_running_loop()

                async def send_frame(jpg_b64: str) -> None:
                    await websocket.send_text(json.dumps({"type": "frame", "data": jpg_b64}))

                def camera_loop() -> None:
                    with dai.Device(pipeline) as device:
                        q = device.getOutputQueue(name="video", maxSize=4, blocking=False)
                        while recording:
                            frame_in = q.tryGet()
                            if frame_in is not None:
                                frame = frame_in.getCvFrame()
                                _, jpeg = cv2.imencode(".jpg", frame)
                                b64 = base64.b64encode(jpeg.tobytes()).decode("utf-8")
                                asyncio.run_coroutine_threadsafe(send_frame(b64), loop)
                            else:
                                time.sleep(0.03)

                threading.Thread(target=camera_loop, daemon=True).start()

                base_time = datetime.now()
                event_offset = 0

                # Event generation loop — waits up to 8s for a "stop" message,
                # otherwise generates one event per tick and persists it to DB.
                while recording:
                    try:
                        raw = await asyncio.wait_for(websocket.receive_text(), timeout=8.0)
                        inner = json.loads(raw)
                        if inner.get("action") == "stop":
                            recording = False

                            # Touch Point 2: hash all events and record scene capture
                            try:
                                async with AsyncSessionLocal() as db:
                                    events_data = await case_service.get_case_events(db, current_case_id)
                                events_hash = hash_service.hash_events(events_data)
                                bc_tx = await flare_service.record_scene_capture(
                                    case_id=current_case_id,
                                    events_hash=events_hash,
                                    event_count=len(events_data),
                                    sensors=["rgb", "thermal", "depth"],
                                )
                                async with AsyncSessionLocal() as db:
                                    await case_service.save_blockchain_record(db, current_case_id, "scene_captured", bc_tx)
                                print(f"[Blockchain] Scene captured: {bc_tx['tx_hash']}")
                            except Exception as e:
                                print(f"[Blockchain] record_scene_capture skipped: {e}")

                            report = generate_incident_report(session_events)
                            if report:
                                report["case_id"] = current_case_id

                                # Touch Point 3: hash report and record on blockchain
                                blockchain_info = {"verified": False}
                                try:
                                    report_hash = hash_service.hash_dict(report)
                                    bc_tx = await flare_service.record_report_generation(
                                        case_id=current_case_id,
                                        report_hash=report_hash,
                                        threat_level=report["threat_assessment"]["level"],
                                        subject_count=len(report["subject_profiles"]),
                                    )
                                    blockchain_info = {
                                        "tx_hash": bc_tx["tx_hash"],
                                        "block_number": bc_tx["block_number"],
                                        "verified": True,
                                    }
                                    async with AsyncSessionLocal() as db:
                                        await case_service.save_blockchain_record(db, current_case_id, "report_generated", bc_tx)
                                    print(f"[Blockchain] Report recorded: {bc_tx['tx_hash']}")
                                except Exception as e:
                                    print(f"[Blockchain] record_report_generation skipped: {e}")
                                    blockchain_info = {"verified": False, "error": str(e)}

                                report["blockchain"] = blockchain_info
                                async with AsyncSessionLocal() as db:
                                    await case_service.save_report(db, current_case_id, report)

                            await websocket.send_text(json.dumps({"type": "status", "recording": False}))
                            if report:
                                await websocket.send_text(json.dumps({"type": "report", "data": report}))
                            break
                    except asyncio.TimeoutError:
                        if recording:
                            event = generate_timeline_event(base_time, event_offset)
                            event_offset += random.randint(8, 20)
                            session_events.append(event)
                            async with AsyncSessionLocal() as db:
                                await case_service.add_event(db, current_case_id, event)
                            await websocket.send_text(json.dumps({"type": "event", "data": event}))

    except WebSocketDisconnect:
        recording = False



# --- Gemini Detective Chat ---

DUMMY_CASE_DATA = {
    "scene_data": {
        "location": "Belmont Industrial Park — Warehouse 14, East Wing",
        "time": "23:40",
        "date": "2026-04-17",
        "environment": "dark, rain, 14°C exterior, 17°C interior",
        "objects_detected": [
            "person (S-1, male, dark jacket, 182cm)",
            "person (S-3, male, hoodie, face obscured, 175cm)",
            "concealed heat source (36.2°C behind shelving unit)",
            "dark bag (35x25cm, ambient temp 19.2°C)",
            "broken fire exit seal",
            "shelving unit",
            "stacked crates",
        ],
        "thermal_activity": {
            "S-1_baseline": "36.4°C (stable throughout)",
            "S-3_baseline": "37.1°C (elevated on entry, peaked 37.8°C post-exchange)",
            "concealed_source": "36.2°C behind shelving — invisible on RGB",
            "deposited_object": "19.2°C — matches ambient, not recently body-carried",
            "hand_transfer": "S-3 right hand +0.4°C transient spike at 23:43:30",
        },
        "depth_data": {
            "S-1_height": "182cm",
            "S-3_height": "175cm",
            "concealment_pocket": "0.8m gap behind shelving unit, profile matches crouching adult",
            "deposited_object_size": "35cm x 25cm x 15cm, ground level",
            "hand_movement": "tracked at 1.1m height during 8-second interaction window",
            "door_swing": "fire exit door opened at 23:38:15, depth detected arc",
        },
        "movement": {
            "S-1_entry": "side loading dock door (not main entrance), 23:36:04",
            "S-1_path": "avoided 2 camera cones — 12m detour, requires prior knowledge",
            "S-1_loitering": "stationary in Storage Bay 3 for 4m 23s, facing shelving",
            "S-1_exit": "same loading dock, 7.1 km/h, controlled pace, 36.5°C",
            "S-3_entry": "rear fire exit, 23:38:15, irregular stride (stress)",
            "S-3_erratic": "7 direction changes in 12 seconds, 4.2x above baseline, no obstacles",
            "S-3_exit": "rear fire exit, 9.2 km/h (3.7x baseline), panicked, 37.5°C",
            "exit_gap": "98 seconds between S-3 and S-1 departures — staggered",
        },
    },
    "evidence": [
        {"id": "E-01", "time": "23:36:04", "type": "entry", "subject": "S-1", "sensor": "rgb+depth+thermal",
         "detail": "S-1 entered via side loading dock door. Depth: 182cm. Thermal: 36.4°C. Avoided main entrance."},
        {"id": "E-02", "time": "23:37:22", "type": "camera_avoidance", "subject": "S-1", "sensor": "thermal+depth",
         "detail": "S-1 took 12m detour around 2 primary camera coverage cones. Only detected by thermal peripheral sensor."},
        {"id": "E-03", "time": "23:38:15", "type": "entry", "subject": "S-3", "sensor": "rgb+depth+thermal",
         "detail": "S-3 entered through rear fire exit. Thermal: 37.1°C (elevated). Irregular stride pattern. Fire exit seal broken."},
        {"id": "E-04", "time": "23:39:50", "type": "loitering", "subject": "S-1", "sensor": "thermal+depth",
         "detail": "S-1 stationary in Storage Bay 3 for 4m 23s. Near-total darkness — RGB useless. Thermal confirmed living human. Facing shelving unit."},
        {"id": "E-05", "time": "23:41:08", "type": "concealed_presence", "subject": "unknown", "sensor": "thermal+depth",
         "detail": "36.2°C heat source behind shelving unit. Invisible on RGB. Depth: 0.8m concealment pocket. Profile consistent with crouching adult ~170cm. 0.2°C below S-1 baseline."},
        {"id": "E-06", "time": "23:43:30", "type": "physical_exchange", "subject": "S-1+S-3", "sensor": "rgb+depth+thermal",
         "detail": "S-1 and S-3 converged <0.4m for 8 seconds. Depth: hand-level movement at 1.1m. Post-contact: S-3 right hand +0.4°C. Immediate separation in opposite directions."},
        {"id": "E-07", "time": "23:44:15", "type": "stress_behavior", "subject": "S-3", "sensor": "rgb+thermal+depth",
         "detail": "7 direction reversals in 12 seconds (4.2x baseline). Thermal: 37.8°C. Depth confirms no obstacles — purely behavioral. Speed oscillating 3.2-4.1 km/h."},
        {"id": "E-08", "time": "23:45:02", "type": "object_deposited", "subject": "S-1", "sensor": "depth+rgb+thermal",
         "detail": "New object on ground: 35x25x15cm dark bag. Thermal: 19.2°C (ambient). NOT recently body-carried (would be 30-34°C). Pre-positioned or insulated."},
        {"id": "E-09", "time": "23:46:30", "type": "flight", "subject": "S-3", "sensor": "rgb+depth+thermal",
         "detail": "S-3 exited via rear fire exit at 9.2 km/h (3.7x baseline). Thermal: 37.5°C. Did not look back. Door left ajar."},
        {"id": "E-10", "time": "23:48:10", "type": "controlled_exit", "subject": "S-1", "sensor": "rgb+depth+thermal",
         "detail": "S-1 exited via loading dock at 7.1 km/h. Thermal: 36.5°C (near baseline). Controlled, deliberate. 98s after S-3 — staggered departure."},
    ],
    "questions_asked": [],
    "answers": [],
    "hypotheses": [],
}


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class InvestigateRequest(BaseModel):
    case_data: dict | None = None
    messages: list[ChatMessage] = []


@app.post("/api/investigate")
async def investigate(req: InvestigateRequest):
    case_data = req.case_data or DUMMY_CASE_DATA

    if not GEMINI_API_KEY:
        # Fallback: return a static detective response when no API key
        return _fallback_response(case_data, req.messages)

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=DETECTIVE_SYSTEM_PROMPT,
    )

    # Build conversation history
    gemini_history = []
    for msg in req.messages:
        gemini_history.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [msg.content],
        })

    chat = model.start_chat(history=gemini_history)

    # Build the prompt
    if not req.messages:
        # First message — send the full case data
        prompt = f"""New case file has been opened. Here is the complete sensor data from the incident:

```json
{json.dumps(case_data, indent=2)}
```

Analyze this case. Start with your initial assessment, identify the most critical findings, and ask me 2-3 targeted questions to guide the investigation."""
    else:
        # Continuation — the last user message is the prompt
        prompt = req.messages[-1].content
        # Remove it from history since we'll send it as the new message
        if gemini_history and gemini_history[-1]["role"] == "user":
            gemini_history.pop()
            chat = model.start_chat(history=gemini_history)

    async def generate():
        try:
            response = chat.send_message(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk.text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


def _fallback_response(case_data, messages):
    """Static detective responses when Gemini API key is not configured."""
    scene = case_data.get('scene_data', {})
    if not messages:
        content = f"""## Initial Case Assessment

**Location:** {scene.get('location', 'Unknown')} | **Time:** {scene.get('time', 'Unknown')} | **Conditions:** {scene.get('environment', 'Unknown')}

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

3. **Exit pattern** — S-3 fled at 9.2 km/h with elevated thermal (stress), while S-1 left calmly at 7.1 km/h via a different exit. This asymmetry suggests S-1 was in control of the situation. Do we have any exterior sensor coverage to track their departure directions?"""
    else:
        responses = [
            """Good observation. Let me dig deeper into that.

The thermal data supports your thinking here. If we cross-reference the timeline, there's a 2-minute gap between S-1's arrival in the storage area (23:39:50) and the concealed presence detection (23:41:08). That's enough time for S-1 to have positioned themselves — but the 0.2°C temperature difference is nagging at me.

**New hypothesis:** There may have been a third person already in position before our observation window began. The lower thermal reading could indicate they'd been stationary long enough to cool slightly from physical activity.

**I'd recommend checking:**
- Depth baseline scans from 23:00-23:35 for Zone C — any anomalies would confirm pre-positioning
- Thermal sweep of the entire storage area — are there any other heat signatures we haven't flagged?

What are your thoughts on the deposited object? The ambient temperature reading is the piece that bothers me most.""",

            """That's a critical connection. Let me update my working theory.

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
3. Cross-reference S-1's entry path with historical traffic patterns — has this exact route been used before?""",

            """We're building a strong picture now. Let me synthesize everything.

**Working Theory (Confidence: 78%):**
This was a coordinated operation involving at least 2, possibly 3 individuals. The warehouse was pre-scouted (camera avoidance confirms this). An item was pre-staged in the storage area. S-1 acted as the primary operator — calm, deliberate, familiar with the space. S-3 was secondary — showed signs of stress throughout, possibly coerced or inexperienced.

The multi-modal sensor fusion was decisive here. Standard CCTV would have captured entry/exit and maybe the storage meeting. But the concealed presence, the hand-level exchange detail, and the thermal stress indicators — those are what transform this from "two people in a warehouse" to "coordinated covert operation."

**Final recommendation:** This case warrants immediate physical investigation of Zone C, particularly behind the shelving unit where the concealed presence was detected. The deposited bag should be treated as priority evidence. All sensor recordings should be preserved for the full 24-hour window.""",
        ]
        idx = min(len(messages) // 2, len(responses) - 1)
        content = responses[idx]

    return {"content": content}


@app.get("/api/case/dummy")
async def get_dummy_case():
    return DUMMY_CASE_DATA


# --- Pre-built crime scene with simulated OAK sensor data ---

CRIME_SCENE = {
    "case_id": "DK-20260418-7742",
    "location": "Belmont Industrial Park — Warehouse 14, East Wing",
    "time_of_incident": "23:40",
    "date": "2026-04-17",
    "observation_window": {"start": "2026-04-17T23:35:12", "end": "2026-04-17T23:48:47"},
    "environment": {
        "lighting": "No overhead lighting. Emergency exit sign only. Near-total darkness in Zone C.",
        "weather": "Light rain, 14°C exterior, 17°C interior",
        "visibility": "RGB effective only in Zones A, D (exit signs). Thermal/depth critical for B, C.",
    },
    "zones": [
        {"id": "zone-a", "name": "Loading Dock Entrance", "x": 10, "y": 60, "w": 25, "h": 30, "lighting": "dim"},
        {"id": "zone-b", "name": "Main Corridor", "x": 35, "y": 40, "w": 15, "h": 45, "lighting": "dark"},
        {"id": "zone-c", "name": "Storage Bay 3", "x": 55, "y": 20, "w": 30, "h": 50, "lighting": "none"},
        {"id": "zone-d", "name": "Rear Fire Exit", "x": 70, "y": 75, "w": 20, "h": 20, "lighting": "exit-sign"},
    ],
    "objects": [
        {"id": "obj-1", "type": "shelving_unit", "x": 72, "y": 35, "w": 8, "h": 18, "label": "Shelving Unit"},
        {"id": "obj-2", "type": "deposited_bag", "x": 62, "y": 52, "w": 4, "h": 3, "label": "Dark Bag", "temp": 19.2, "appeared_at": "23:45:02"},
        {"id": "obj-3", "type": "forklift", "x": 20, "y": 70, "w": 8, "h": 5, "label": "Parked Forklift"},
        {"id": "obj-4", "type": "crates", "x": 58, "y": 25, "w": 10, "h": 8, "label": "Stacked Crates"},
    ],
    "subjects": [
        {
            "id": "S-1", "label": "Subject Alpha",
            "description": "Male, dark jacket, approx 182cm, athletic build",
            "thermal_baseline": 36.4,
            "path": [
                {"x": 12, "y": 75, "time": "23:36:04", "zone": "zone-a", "temp": 36.4, "speed": 1.2},
                {"x": 18, "y": 68, "time": "23:36:30", "zone": "zone-a", "temp": 36.4, "speed": 0.8},
                {"x": 25, "y": 55, "time": "23:37:22", "zone": "zone-a", "temp": 36.5, "speed": 1.4},
                {"x": 38, "y": 48, "time": "23:38:00", "zone": "zone-b", "temp": 36.4, "speed": 1.1},
                {"x": 42, "y": 42, "time": "23:39:10", "zone": "zone-b", "temp": 36.4, "speed": 0.9},
                {"x": 60, "y": 38, "time": "23:39:50", "zone": "zone-c", "temp": 36.4, "speed": 0.0},
                {"x": 60, "y": 38, "time": "23:43:20", "zone": "zone-c", "temp": 36.5, "speed": 0.0},
                {"x": 62, "y": 40, "time": "23:43:30", "zone": "zone-c", "temp": 36.6, "speed": 0.3},
                {"x": 60, "y": 38, "time": "23:43:38", "zone": "zone-c", "temp": 36.5, "speed": 0.0},
                {"x": 62, "y": 50, "time": "23:45:02", "zone": "zone-c", "temp": 36.5, "speed": 0.5},
                {"x": 58, "y": 55, "time": "23:46:00", "zone": "zone-c", "temp": 36.5, "speed": 1.8},
                {"x": 45, "y": 60, "time": "23:47:00", "zone": "zone-b", "temp": 36.5, "speed": 2.0},
                {"x": 22, "y": 72, "time": "23:48:10", "zone": "zone-a", "temp": 36.5, "speed": 2.0},
            ],
        },
        {
            "id": "S-3", "label": "Subject Gamma",
            "description": "Male, hoodie, face obscured, approx 175cm, nervous gait",
            "thermal_baseline": 37.1,
            "path": [
                {"x": 75, "y": 88, "time": "23:38:15", "zone": "zone-d", "temp": 37.1, "speed": 1.5},
                {"x": 68, "y": 78, "time": "23:38:45", "zone": "zone-d", "temp": 37.2, "speed": 1.8},
                {"x": 48, "y": 55, "time": "23:40:00", "zone": "zone-b", "temp": 37.0, "speed": 1.3},
                {"x": 55, "y": 42, "time": "23:42:00", "zone": "zone-c", "temp": 37.1, "speed": 0.8},
                {"x": 61, "y": 40, "time": "23:43:28", "zone": "zone-c", "temp": 37.2, "speed": 1.0},
                {"x": 63, "y": 40, "time": "23:43:30", "zone": "zone-c", "temp": 37.4, "speed": 0.2},
                {"x": 63, "y": 42, "time": "23:43:38", "zone": "zone-c", "temp": 37.6, "speed": 2.5},
                {"x": 50, "y": 50, "time": "23:44:00", "zone": "zone-b", "temp": 37.5, "speed": 3.2},
                {"x": 45, "y": 55, "time": "23:44:08", "zone": "zone-b", "temp": 37.8, "speed": 3.8},
                {"x": 48, "y": 50, "time": "23:44:12", "zone": "zone-b", "temp": 37.8, "speed": 4.1},
                {"x": 42, "y": 58, "time": "23:44:15", "zone": "zone-b", "temp": 37.8, "speed": 3.5},
                {"x": 72, "y": 82, "time": "23:46:00", "zone": "zone-d", "temp": 37.6, "speed": 2.6},
                {"x": 78, "y": 90, "time": "23:46:30", "zone": "zone-d", "temp": 37.5, "speed": 2.6},
            ],
        },
    ],
    "concealed_presence": {
        "x": 74, "y": 38, "temp": 36.2, "detected_at": "23:41:08",
        "zone": "zone-c", "behind": "obj-1",
        "depth_pocket": "0.8m gap behind shelving",
        "note": "Invisible on RGB. Only thermal + depth detected this.",
    },
    "events": [
        {
            "id": "ev-01", "time": "23:36:04", "type": "entry_detected", "severity": "low",
            "zone": "zone-a", "subject": "S-1",
            "summary": "Subject Alpha entered via loading dock side door",
            "detail": "RGB captured silhouette at entrance. Depth sensor measured height: 182cm. Thermal baseline recorded: 36.4°C. Subject avoided main entrance — used manual dock door instead.",
            "sensors": ["rgb", "depth", "thermal"], "evidence_type": "movement", "confidence": 0.94,
            "oak_data": {"bbox": [10, 55, 18, 85], "depth_m": 3.2, "temp": 36.4},
        },
        {
            "id": "ev-02", "time": "23:37:22", "type": "path_avoidance", "severity": "medium",
            "zone": "zone-a", "subject": "S-1",
            "summary": "S-1 deliberately avoided 2 primary camera positions",
            "detail": "Trajectory analysis: subject took a 12m detour around camera coverage cones. Path requires prior knowledge of camera placement. Only detected by thermal peripheral sensor at edge of Zone A.",
            "sensors": ["thermal", "depth"], "evidence_type": "behavioral", "confidence": 0.88,
            "oak_data": {"bbox": [22, 50, 30, 65], "depth_m": 5.1, "temp": 36.5},
        },
        {
            "id": "ev-03", "time": "23:38:15", "type": "entry_detected", "severity": "low",
            "zone": "zone-d", "subject": "S-3",
            "summary": "Subject Gamma entered through rear fire exit",
            "detail": "Fire exit opened (depth detected door swing). Subject entered with elevated thermal: 37.1°C — above normal baseline, consistent with recent physical exertion or stress. Gait analysis: irregular stride pattern.",
            "sensors": ["rgb", "depth", "thermal"], "evidence_type": "movement", "confidence": 0.92,
            "oak_data": {"bbox": [70, 80, 80, 95], "depth_m": 2.8, "temp": 37.1},
        },
        {
            "id": "ev-04", "time": "23:39:50", "type": "loitering", "severity": "medium",
            "zone": "zone-c", "subject": "S-1",
            "summary": "S-1 stationary in Storage Bay 3 for 4m 23s",
            "detail": "Subject stopped moving in near-total darkness (RGB useless). Thermal: consistent 36.4°C confirming living presence. Depth profile unchanged across 340 frames — not an abandoned object. Position: facing shelving unit obj-1.",
            "sensors": ["thermal", "depth"], "evidence_type": "behavioral", "confidence": 0.91,
            "oak_data": {"bbox": [56, 30, 64, 50], "depth_m": 1.5, "temp": 36.4},
        },
        {
            "id": "ev-05", "time": "23:41:08", "type": "concealed_presence", "severity": "high",
            "zone": "zone-c", "subject": "Unknown",
            "summary": "Hidden individual detected behind shelving — thermal only",
            "detail": "36.2°C heat source detected behind shelving unit (obj-1). Completely invisible on RGB camera. Depth mapping reveals 0.8m concealment pocket between shelving and wall. Heat signature profile: crouching adult, approximately 170cm. Thermal is 0.2°C below S-1's baseline — possible third individual.",
            "sensors": ["thermal", "depth"], "evidence_type": "spatial", "confidence": 0.87,
            "oak_data": {"bbox": [70, 30, 78, 45], "depth_m": 0.8, "temp": 36.2, "rgb_visible": False},
        },
        {
            "id": "ev-06", "time": "23:43:30", "type": "suspicious_interaction", "severity": "high",
            "zone": "zone-c", "subject": "S-1, S-3",
            "summary": "8-second close-proximity exchange between S-1 and S-3",
            "detail": "Subjects converged to <0.4m separation for exactly 8 seconds. Depth sensors tracked hand-level movement at 1.1m height during contact window. Post-separation thermal: S-3's right hand region showed transient temperature increase (+0.4°C) consistent with receiving a recently body-warmed object. Immediate divergence in opposite directions.",
            "sensors": ["rgb", "depth", "thermal"], "evidence_type": "interpersonal", "confidence": 0.93,
            "oak_data": {"bbox": [58, 35, 66, 48], "depth_m": 1.2, "temp_s1": 36.6, "temp_s3": 37.4, "hand_movement": True},
        },
        {
            "id": "ev-07", "time": "23:44:15", "type": "erratic_movement", "severity": "high",
            "zone": "zone-b", "subject": "S-3",
            "summary": "S-3: 7 direction changes in 12 seconds — stress indicator",
            "detail": "Post-exchange, S-3 exhibited erratic movement: 7 direction reversals in 12 seconds (4.2x above pedestrian baseline). Thermal spiked to 37.8°C — physiological stress response. Depth tracking confirms no physical obstacles — movement was purely behavioral. Speed oscillated between 3.2 and 4.1 km/h.",
            "sensors": ["rgb", "thermal", "depth"], "evidence_type": "behavioral", "confidence": 0.95,
            "oak_data": {"bbox": [40, 48, 52, 62], "depth_m": 4.5, "temp": 37.8, "direction_changes": 7},
        },
        {
            "id": "ev-08", "time": "23:45:02", "type": "object_deposited", "severity": "medium",
            "zone": "zone-c", "subject": "S-1",
            "summary": "Dark bag deposited at ground level in storage area",
            "detail": "Depth map delta: new object appeared (35cm x 25cm x 15cm) at ground level near crates (obj-4). RGB: dark-colored bag/package. Thermal: 19.2°C — matches ambient interior temperature. Object was NOT recently body-carried (would read ~30-34°C). Suggests pre-positioning hours earlier, or insulated container.",
            "sensors": ["depth", "rgb", "thermal"], "evidence_type": "physical", "confidence": 0.90,
            "oak_data": {"bbox": [60, 48, 65, 55], "depth_m": 0.3, "temp": 19.2, "size_cm": [35, 25, 15]},
        },
        {
            "id": "ev-09", "time": "23:46:30", "type": "rapid_exit", "severity": "medium",
            "zone": "zone-d", "subject": "S-3",
            "summary": "S-3 fled at 9.2 km/h through rear fire exit",
            "detail": "Subject Gamma accelerated to 9.2 km/h (3.7x pedestrian baseline) toward rear fire exit. Thermal remained elevated: 37.5°C. Used same exit as entry. Did not look back (head orientation tracked via depth). Door left ajar.",
            "sensors": ["rgb", "depth", "thermal"], "evidence_type": "movement", "confidence": 0.96,
            "oak_data": {"bbox": [72, 82, 82, 96], "depth_m": 6.2, "temp": 37.5, "speed_kmh": 9.2},
        },
        {
            "id": "ev-10", "time": "23:48:10", "type": "rapid_exit", "severity": "medium",
            "zone": "zone-a", "subject": "S-1",
            "summary": "S-1 exited calmly at 7.1 km/h via loading dock — different exit",
            "detail": "Subject Alpha departed via original entry point (loading dock). Speed: 7.1 km/h — elevated but controlled. Thermal: 36.5°C — near baseline, no stress indicators. Took deliberate route. 98-second gap between S-3 and S-1 exits suggests coordinated staggered departure.",
            "sensors": ["rgb", "depth", "thermal"], "evidence_type": "movement", "confidence": 0.94,
            "oak_data": {"bbox": [15, 68, 25, 82], "depth_m": 4.0, "temp": 36.5, "speed_kmh": 7.1},
        },
    ],
    "sensor_summary": {
        "rgb_detections": 7,
        "thermal_detections": 10,
        "depth_detections": 10,
        "thermal_only_events": 2,
        "note": "Concealed presence and camera avoidance only detectable via thermal+depth. Standard CCTV would have missed 3 of 10 events entirely, and 2 more would lack critical detail."
    },
}


def build_crime_scene_analysis(scene: dict) -> dict:
    subjects_by_id = {
        subject["id"]: {
            "id": subject["id"],
            "label": subject["label"],
            "desc": subject["description"],
        }
        for subject in scene["subjects"]
    }
    zones_by_id = {zone["id"]: zone["name"] for zone in scene["zones"]}

    def resolve_subject(subject_value: str) -> dict:
        tokens = [token.strip() for token in subject_value.split(",")]
        known_subjects = [subjects_by_id[token] for token in tokens if token in subjects_by_id]

        if len(known_subjects) == 1 and len(tokens) == 1:
            return known_subjects[0]

        if known_subjects:
            return {
                "id": "+".join(subject["id"] for subject in known_subjects),
                "label": " + ".join(subject["label"] for subject in known_subjects),
                "desc": "Coordinated activity involving multiple subjects",
            }

        return {
            "id": "UNKNOWN",
            "label": "Unknown Subject",
            "desc": "Unidentified signature detected through thermal/depth evidence",
        }

    timeline_events = []
    for event in scene["events"]:
        timeline_events.append({
            "type": event["type"],
            "severity": event["severity"],
            "summary": event["summary"],
            "detail": event["detail"],
            "sensors": event["sensors"],
            "evidence_type": event["evidence_type"],
            "timestamp": f"{scene['date']}T{event['time']}",
            "subject": resolve_subject(event["subject"]),
            "zone": zones_by_id.get(event["zone"], event["zone"]),
            "confidence": event["confidence"],
        })

    return {
        "events": timeline_events,
        "report": generate_incident_report(timeline_events),
        "case_data": DUMMY_CASE_DATA,
    }


@app.get("/api/analysis/demo")
async def get_demo_analysis():
    return build_crime_scene_analysis(CRIME_SCENE)


@app.get("/api/case/scene")
async def get_crime_scene():
    return CRIME_SCENE


# --- Vision Sync Trigger ---
# Receives video/sensor data from the frontend and kicks off processing.

@app.post("/api/vision-sync")
async def vision_sync():
    # TODO: accept uploaded file + mode + metadata
    # TODO: store the file / forward to processing pipeline
    # TODO: return a job/session ID so frontend can track progress
    return {"status": "pending", "message": "Vision sync endpoint not yet implemented"}


if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
