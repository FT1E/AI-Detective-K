from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import json

from ..models.database import Case, Event, Report


async def create_case(db: AsyncSession) -> str:
    """Create a new case and return case_id in format DK-YYYYMMDD-XXXXXX"""
    now = datetime.now()
    date_part = now.strftime("%Y%m%d")
    
    # Get count of cases created today to generate sequence number
    result = await db.execute(
        select(Case).where(Case.case_id.like(f"DK-{date_part}-%"))
    )
    existing_cases = result.scalars().all()
    sequence = len(existing_cases) + 1
    
    case_id = f"DK-{date_part}-{sequence:06d}"
    
    new_case = Case(
        case_id=case_id,
        status="active",
        created_at=now
    )
    db.add(new_case)
    await db.commit()
    await db.refresh(new_case)
    
    return case_id


async def add_event(db: AsyncSession, case_id: str, event_data: dict) -> None:
    """Add an event to a case"""
    event = Event(
        case_id=case_id,
        timestamp=datetime.fromisoformat(event_data["timestamp"]),
        event_type=event_data.get("type", "unknown"),
        data=event_data,
        sensor_data={
            "sensors": event_data.get("sensors", []),
            "confidence": event_data.get("confidence", 0.0)
        }
    )
    db.add(event)
    await db.commit()


async def get_case_events(db: AsyncSession, case_id: str) -> List[dict]:
    """Get all events for a case ordered by timestamp"""
    result = await db.execute(
        select(Event)
        .where(Event.case_id == case_id)
        .order_by(Event.timestamp)
    )
    events = result.scalars().all()
    return [event.data for event in events]


async def save_report(db: AsyncSession, case_id: str, report_data: dict) -> None:
    """Save report and update case status"""
    # Save report
    report = Report(
        case_id=case_id,
        report_data=report_data,
        generated_at=datetime.now(),
        threat_level=report_data.get("threat_assessment", {}).get("level", "unknown"),
        subject_count=len(report_data.get("subject_profiles", []))
    )
    db.add(report)
    
    # Update case
    await db.execute(
        update(Case)
        .where(Case.case_id == case_id)
        .values(
            status="completed",
            threat_level=report.threat_level,
            ended_at=datetime.now()
        )
    )
    
    await db.commit()


async def list_cases(db: AsyncSession) -> List[dict]:
    """List all cases"""
    result = await db.execute(select(Case).order_by(Case.created_at.desc()))
    cases = result.scalars().all()
    
    return [
        {
            "case_id": case.case_id,
            "status": case.status,
            "threat_level": case.threat_level,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "ended_at": case.ended_at.isoformat() if case.ended_at else None,
            "sealed": case.sealed
        }
        for case in cases
    ]


async def get_case(db: AsyncSession, case_id: str) -> Optional[dict]:
    """Get specific case details"""
    result = await db.execute(select(Case).where(Case.case_id == case_id))
    case = result.scalar_one_or_none()
    
    if not case:
        return None
    
    return {
        "case_id": case.case_id,
        "status": case.status,
        "threat_level": case.threat_level,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "ended_at": case.ended_at.isoformat() if case.ended_at else None,
        "sealed": case.sealed,
        "blockchain_tx_hash": case.blockchain_tx_hash
    }


async def seal_case(db: AsyncSession, case_id: str) -> dict:
    """Seal a case (prepare for blockchain in Phase 3)"""
    await db.execute(
        update(Case)
        .where(Case.case_id == case_id)
        .values(sealed=True, status="sealed")
    )
    await db.commit()
    
    return await get_case(db, case_id)
