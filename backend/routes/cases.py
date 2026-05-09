from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Case
from schemas.case_schema import CaseCreate, CaseResponse, CaseDetailResponse
from utils.helpers import generate_case_id
from utils.logger import log_info
from datetime import datetime

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseResponse)
async def create_case(case_data: CaseCreate, db: Session = Depends(get_db)):
    """Create a new investigation case"""
    
    case_id = generate_case_id()
    
    case = Case(
        case_id=case_id,
        victim_name=case_data.victim_name,
        incident_location=case_data.incident_location,
        incident_date=case_data.incident_date,
        notes=case_data.notes,
        status="pending",
        risk_level="LOW",
        risk_score=0.0
    )
    
    db.add(case)
    db.commit()
    db.refresh(case)
    
    log_info(f"[OK] Case created: {case_id}")
    
    return case


@router.get("", response_model=list[CaseResponse])
async def list_cases(db: Session = Depends(get_db)):
    """List all investigation cases"""
    
    cases = db.query(Case).order_by(Case.created_at.desc()).all()
    
    return cases


@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case(case_id: str, db: Session = Depends(get_db)):
    """Get case details"""
    
    case = db.query(Case).filter(Case.case_id == case_id).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    return case


@router.put("/{case_id}")
async def update_case_notes(case_id: str, notes: str, db: Session = Depends(get_db)):
    """Update case notes"""
    
    case = db.query(Case).filter(Case.case_id == case_id).first()
    
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case.notes = notes
    case.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(case)
    
    log_info(f"[OK] Case notes updated: {case_id}")
    
    return {"message": "Case updated", "case": case}
