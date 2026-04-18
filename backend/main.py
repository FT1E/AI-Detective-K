
import asyncio
import json
import random
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
# --- OAK camera integration ---
import cv2
import depthai as dai
import base64

app = FastAPI(title="AI Detective K")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state
recording = False
events: list[dict] = []


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

    # Identify key subjects
    subject_ids = {}
    for e in collected_events:
        sid = e["subject"]["id"]
        if sid not in subject_ids:
            subject_ids[sid] = {"subject": e["subject"], "events": [], "zones": set()}
        subject_ids[sid]["events"].append(e)
        subject_ids[sid]["zones"].add(e["zone"])

    # Build subject profiles
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

    # Sort profiles by involvement
    severity_order = {"high": 0, "medium": 1, "low": 2}
    subject_profiles.sort(key=lambda s: severity_order.get(s["involvement_level"], 3))

    # Build evidence chain
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

    # Determine overall threat assessment
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

    # Sensor coverage summary
    all_sensors = set()
    for e in collected_events:
        all_sensors.update(e["sensors"])
    sensor_contributions = {
        "rgb": sum(1 for e in collected_events if "rgb" in e["sensors"]),
        "thermal": sum(1 for e in collected_events if "thermal" in e["sensors"]),
        "depth": sum(1 for e in collected_events if "depth" in e["sensors"]),
    }

    # Build narrative
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

    # Key findings
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
        "case_id": f"DK-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}",
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
    return {"recording": recording, "event_count": len(events)}


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    global recording, events
    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)


            if data.get("action") == "start":
                recording = True
                events = []
                await websocket.send_text(json.dumps({"type": "status", "recording": True}))

                # --- OAK camera pipeline setup ---
                pipeline = dai.Pipeline()
                camRgb = pipeline.create(dai.node.ColorCamera)
                camRgb.setPreviewSize(640, 480)
                camRgb.setInterleaved(False)
                camRgb.setColorOrder(dai.ColorCameraProperties.ColorOrder.BGR)
                xoutRgb = pipeline.create(dai.node.XLinkOut)
                xoutRgb.setStreamName("video")
                camRgb.preview.link(xoutRgb.input)

                # Run camera in a thread to avoid blocking
                def camera_loop():
                    with dai.Device(pipeline) as device:
                        qRgb = device.getOutputQueue(name="video", maxSize=4, blocking=False)
                        while recording:
                            inRgb = qRgb.tryGet()
                            if inRgb is not None:
                                frame = inRgb.getCvFrame()
                                # Encode frame as JPEG
                                _, jpeg = cv2.imencode('.jpg', frame)
                                jpg_bytes = jpeg.tobytes()
                                jpg_b64 = base64.b64encode(jpg_bytes).decode('utf-8')
                                # Send frame to frontend
                                asyncio.run(async_send_frame(jpg_b64))
                            else:
                                # If no frame, sleep briefly
                                import time
                                time.sleep(0.03)

                # Async helper to send frame
                async def async_send_frame(jpg_b64):
                    await websocket.send_text(json.dumps({
                        "type": "frame",
                        "data": jpg_b64
                    }))

                import threading
                cam_thread = threading.Thread(target=camera_loop, daemon=True)
                cam_thread.start()

                # Keep backend loop alive while recording
                while recording:
                    await asyncio.sleep(0.1)


            elif data.get("action") == "stop":
                recording = False
                report = generate_incident_report(events)
                await websocket.send_text(json.dumps({
                    "type": "status",
                    "recording": False,
                }))
                if report:
                    await websocket.send_text(json.dumps({
                        "type": "report",
                        "data": report,
                    }))

    except WebSocketDisconnect:
        recording = False


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
