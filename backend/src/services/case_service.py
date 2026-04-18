from datetime import datetime
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.database import BlockchainRecord, Case, Event, Report


async def create_case(db: AsyncSession) -> str:
    """Create a new case and return its case_id (format: DK-YYYYMMDD-XXXXXX)."""
    now = datetime.now()
    date_part = now.strftime("%Y%m%d")

    result = await db.execute(
        select(Case).where(Case.case_id.like(f"DK-{date_part}-%"))
    )
    sequence = len(result.scalars().all()) + 1
    case_id = f"DK-{date_part}-{sequence:06d}"

    db.add(Case(
        case_id=case_id,
        investigator="AI-Detective-K",
        status="active",
        created_at=now,
    ))
    await db.commit()
    return case_id


async def add_event(db: AsyncSession, case_id: str, event_data: dict) -> None:
    """Persist an event to the database."""
    db.add(Event(
        case_id=case_id,
        timestamp=datetime.fromisoformat(event_data["timestamp"]),
        event_type=event_data.get("type", "unknown"),
        severity=event_data.get("severity", "low"),
        summary=event_data.get("summary", ""),
        detail=event_data.get("detail"),
        sensors={"sensors": event_data.get("sensors", [])},
        subject_id=event_data.get("subject", {}).get("id"),
        zone=event_data.get("zone"),
        confidence=event_data.get("confidence"),
    ))
    await db.commit()


async def get_case_events(db: AsyncSession, case_id: str) -> List[dict]:
    """Return all events for a case ordered by timestamp."""
    result = await db.execute(
        select(Event).where(Event.case_id == case_id).order_by(Event.timestamp)
    )
    return [
        {
            "event_type": e.event_type,
            "severity": e.severity,
            "summary": e.summary,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "sensors": e.sensors,
            "subject_id": e.subject_id,
            "zone": e.zone,
            "confidence": e.confidence,
        }
        for e in result.scalars().all()
    ]


async def save_report(db: AsyncSession, case_id: str, report_data: dict) -> None:
    """Save the generated report and mark case as completed."""
    threat = report_data.get("threat_assessment", {})
    db.add(Report(
        case_id=case_id,
        generated_at=datetime.now(),
        threat_assessment=threat,
        narrative=report_data.get("narrative"),
        key_findings=report_data.get("key_findings"),
        subject_profiles=report_data.get("subject_profiles"),
        evidence_chain=report_data.get("evidence_chain"),
        recommendation=report_data.get("recommendation"),
    ))
    await db.execute(
        update(Case)
        .where(Case.case_id == case_id)
        .values(
            status="completed",
            threat_level=threat.get("level"),
            ended_at=datetime.now(),
        )
    )
    await db.commit()


async def save_blockchain_record(
    db: AsyncSession, case_id: str, event_type: str, tx_data: dict
) -> None:
    """Persist a blockchain transaction record."""
    db.add(BlockchainRecord(
        record_type=event_type,
        related_id=case_id,
        tx_hash=tx_data["tx_hash"],
        block_number=tx_data["block_number"],
        record_metadata=tx_data,
    ))
    await db.commit()


async def list_cases(db: AsyncSession) -> List[dict]:
    """List all cases, newest first."""
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    return [
        {
            "case_id": c.case_id,
            "status": c.status,
            "threat_level": c.threat_level,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            "sealed": c.sealed,
        }
        for c in result.scalars().all()
    ]


async def get_case(db: AsyncSession, case_id: str) -> Optional[dict]:
    """Get details for a single case."""
    result = await db.execute(select(Case).where(Case.case_id == case_id))
    c = result.scalar_one_or_none()
    if not c:
        return None
    return {
        "case_id": c.case_id,
        "status": c.status,
        "threat_level": c.threat_level,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "ended_at": c.ended_at.isoformat() if c.ended_at else None,
        "sealed": c.sealed,
        "blockchain_tx_hash": c.blockchain_case_tx_id,
    }


async def seal_case(db: AsyncSession, case_id: str, tx_hash: str = None) -> dict:
    """Seal a case and optionally record the blockchain tx hash."""
    await db.execute(
        update(Case)
        .where(Case.case_id == case_id)
        .values(sealed=True, status="sealed", blockchain_case_tx_id=tx_hash)
    )
    await db.commit()
    return await get_case(db, case_id)
