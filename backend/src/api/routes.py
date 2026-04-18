from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ..config import get_db
from ..services import case_service

router = APIRouter()


@router.get("/cases")
async def list_cases(db: AsyncSession = Depends(get_db)):
    """List all cases"""
    cases = await case_service.list_cases(db)
    return cases


@router.get("/cases/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Get specific case details"""
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.get("/cases/{case_id}/events")
async def get_case_events(case_id: str, db: AsyncSession = Depends(get_db)):
    """Get all events for a case"""
    events = await case_service.get_case_events(db, case_id)
    return events


@router.post("/cases/{case_id}/finalize")
async def finalize_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Seal case for blockchain (Phase 3)"""
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.get("sealed"):
        raise HTTPException(status_code=400, detail="Case already sealed")
    
    sealed_case = await case_service.seal_case(db, case_id)
    return {
        "case_id": case_id,
        "status": "sealed",
        "message": "Case sealed successfully. Ready for blockchain integration (Phase 3)."
    }
