from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pathlib import Path
import json
from database import get_db
from models import Case, Evidence, AIResult, TimelineEvent, RiskFlag
from schemas.tod_schema import TODInputSchema
from utils.logger import log_info, log_error
from services.pdf_parser import parse_pdf, extract_autopsy_data
from services.csv_parser import parse_and_normalize
from services.timeline_engine import TimelineEngine
from services.risk_engine import RiskEngine
from services.tod_calculator import TODCalculator
from services.report_generator import ReportGenerator
from agents.autopsy_agent import analyze_autopsy_report
from agents.correlation_agent import analyze_correlations
from agents.summary_agent import generate_investigation_summary
from datetime import datetime

router = APIRouter(prefix="/cases", tags=["analysis"])


async def process_case_analysis(
    case_id: str,
    tod_input: dict,
    db: Session
):
    """Background task: Execute full forensic analysis pipeline"""
    
    try:
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if not case:
            return
        
        # Update status
        case.status = "processing"
        db.commit()
        
        log_info(f"▶ Starting analysis pipeline for {case_id}")
        
        # ========== PHASE 1: Parse Evidence ==========
        log_info(f"[1/8] Parsing evidence files...")
        
        evidence_files = db.query(Evidence).filter(
            Evidence.case_id == case_id
        ).all()
        
        parsed_evidence = {
            "autopsy": {},
            "events": [],
            "metadata": {}
        }
        
        for evidence in evidence_files:
            if not Path(evidence.file_path).exists():
                continue
            
            try:
                if evidence.file_type == "autopsy":
                    # Parse autopsy PDF
                    pdf_data = parse_pdf(evidence.file_path)
                    parsed_evidence["autopsy"] = extract_autopsy_data(pdf_data["text"])
                    evidence.processed = True
                
                elif evidence.file_type in ["cctv", "gps", "metadata"]:
                    # Parse CSV/metadata
                    events = parse_and_normalize(evidence.file_path, evidence.file_type)
                    parsed_evidence["events"].extend(events)
                    evidence.processed = True
                
                db.commit()
            
            except Exception as e:
                log_error(f"Failed to parse {evidence.file_name}", e)
                continue
        
        # ========== PHASE 2: Normalize Data ==========
        log_info(f"[2/8] Normalizing data...")
        
        all_events = parsed_evidence["events"]
        
        # ========== PHASE 3: Time of Death Engine ==========
        log_info(f"[3/8] Calculating time of death...")
        
        tod_result = TODCalculator.estimate_tod(
            body_temperature=tod_input.get("body_temperature"),
            ambient_temperature=tod_input.get("ambient_temperature"),
            rigor_stage=tod_input.get("rigor_stage")
        )
        
        if tod_result["estimated_hours_since_death"] > 0:
            all_events.insert(0, {
                "timestamp": datetime.utcnow().isoformat(),
                "source": "tod_calculation",
                "event": f"Estimated death: {tod_result['estimated_death_window']}",
                "severity": "high",
                "metadata": tod_result
            })
        
        # ========== PHASE 4: Timeline Reconstruction ==========
        log_info(f"[4/8] Reconstructing timeline...")
        
        timeline = TimelineEngine.reconstruct_timeline(all_events)
        
        # Store timeline in database
        for event in timeline:
            timeline_event = TimelineEvent(
                case_id=case_id,
                timestamp=event.get("timestamp", ""),
                source=event.get("source", ""),
                event=event.get("event", ""),
                severity=event.get("severity", "low"),
                metadata_json=event.get("metadata", {})
            )
            db.add(timeline_event)
        db.commit()
        
        log_info(f"[4/8] ✓ Timeline: {len(timeline)} events")
        
        # ========== PHASE 5: Autopsy Agent ==========
        log_info(f"[5/8] Autopsy analysis...")
        
        autopsy_text = parsed_evidence["autopsy"].get("notes", "")
        autopsy_result = analyze_autopsy_report(autopsy_text or "Standard autopsy findings")
        
        ai_result = AIResult(
            case_id=case_id,
            agent_name="autopsy_agent",
            result_json=autopsy_result
        )
        db.add(ai_result)
        
        parsed_evidence["autopsy"] = autopsy_result
        
        # ========== PHASE 6: Correlation Agent ==========
        log_info(f"[6/8] Correlation analysis...")
        
        evidence_for_correlation = {
            "events": timeline,
            "autopsy": parsed_evidence["autopsy"],
            "witnesses": {}
        }
        
        correlation_result = analyze_correlations(evidence_for_correlation)
        
        ai_result = AIResult(
            case_id=case_id,
            agent_name="correlation_agent",
            result_json=correlation_result
        )
        db.add(ai_result)
        
        parsed_evidence["anomalies"] = correlation_result.get("anomalies", [])
        
        # ========== PHASE 7: Risk Engine ==========
        log_info(f"[7/8] Risk assessment...")
        
        risk_engine = RiskEngine()
        evidence_for_risk = {
            "events": timeline,
            "autopsy": parsed_evidence["autopsy"],
            "anomalies": parsed_evidence.get("anomalies", []),
            "witnesses": {}
        }
        
        risk_assessment = risk_engine.evaluate_risk(evidence_for_risk)
        
        # Store risk flags
        for flag in risk_assessment["flags"]:
            risk_flag = RiskFlag(
                case_id=case_id,
                flag_name=flag["flag"],
                description=flag["description"],
                score=flag["score"]
            )
            db.add(risk_flag)
        
        # Update case risk
        case.risk_level = risk_assessment["risk_level"]
        case.risk_score = risk_assessment["risk_score"]
        
        db.commit()
        
        log_info(f"[7/8] ✓ Risk: {risk_assessment['risk_level']} ({risk_assessment['risk_score']})")
        
        # ========== PHASE 8: Summary Agent ==========
        log_info(f"[8/8] Generating summary...")
        
        summary_data = {
            "cause_of_death": autopsy_result.get("cause_of_death", ""),
            "injuries": autopsy_result.get("injuries", []),
            "events": timeline,
            "anomalies": parsed_evidence.get("anomalies", []),
            "risk_level": risk_assessment["risk_level"]
        }
        
        summary_result = generate_investigation_summary(summary_data)
        
        ai_result = AIResult(
            case_id=case_id,
            agent_name="summary_agent",
            result_json=summary_result
        )
        db.add(ai_result)
        
        # ========== Finalize ==========
        case.status = "completed"
        case.updated_at = datetime.utcnow()
        db.commit()
        
        log_info(f"✓ Analysis pipeline complete for {case_id}")
    
    except Exception as e:
        log_error(f"Analysis pipeline failed for {case_id}", e)
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if case:
            case.status = "failed"
            db.commit()


@router.post("/{case_id}/analyze")
async def analyze_case(
    case_id: str,
    tod_input: TODInputSchema,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Trigger forensic analysis pipeline
    
    Pipeline:
    1. Parse evidence files
    2. Normalize data
    3. Time of Death calculation
    4. Timeline reconstruction
    5. Autopsy agent analysis
    6. Correlation agent analysis
    7. Risk engine assessment
    8. Summary agent generation
    """
    
    # Verify case exists
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Check for evidence
    evidence_count = db.query(Evidence).filter(
        Evidence.case_id == case_id
    ).count()
    
    if evidence_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No evidence files uploaded for this case"
        )
    
    # Start background analysis
    background_tasks.add_task(
        process_case_analysis,
        case_id,
        tod_input.dict(),
        db
    )
    
    log_info(f"✓ Analysis pipeline started for {case_id}")
    
    return {
        "status": "processing",
        "case_id": case_id,
        "message": "Forensic analysis pipeline started. Poll /results endpoint for completion."
    }
