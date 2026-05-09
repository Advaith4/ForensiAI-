from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Case, AIResult
from schemas.result_schema import ReportResponse
from services.report_generator import ReportGenerator
from utils.logger import log_info

router = APIRouter(prefix="/cases", tags=["results"])


@router.get("/{case_id}/results")
async def get_analysis_results(case_id: str, db: Session = Depends(get_db)):
    """
    Get analysis results for a case
    
    Returns:
    - processing: If analysis is still running
    - complete: If analysis is done with full results
    """
    
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.status == "processing":
        return {
            "status": "processing",
            "case_id": case_id,
            "message": "Analysis pipeline is still running. Please check back soon."
        }
    
    if case.status == "failed":
        return {
            "status": "failed",
            "case_id": case_id,
            "message": "Analysis pipeline encountered an error."
        }
    
    if case.status == "completed":
        # Check if AI results exist
        ai_results = db.query(AIResult).filter(
            AIResult.case_id == case_id
        ).all()
        
        if not ai_results:
            return {
                "status": "processing",
                "case_id": case_id,
                "message": "Analysis pipeline is still processing results..."
            }
        
        return {
            "status": "complete",
            "case_id": case_id,
            "results_ready": True
        }
    
    return {
        "status": case.status,
        "case_id": case_id
    }


@router.get("/{case_id}/report", response_model=dict)
async def get_case_report(case_id: str, db: Session = Depends(get_db)):
    """
    Generate and return final investigation report
    
    Combines:
    - Case information
    - AI analysis results
    - Timeline reconstruction
    - Risk assessment
    """
    
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    if case.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Case analysis not completed. Current status: {case.status}"
        )
    
    report = ReportGenerator.generate_report(case_id, db)
    
    log_info(f"✓ Report generated for {case_id}")
    
    return report
