from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models import Case, TimelineEvent, AIResult, RiskFlag
from utils.logger import log_info


class ReportGenerator:
    """Generate final investigation report from all analysis"""
    
    @staticmethod
    def generate_report(case_id: str, db: Session) -> Dict[str, Any]:
        """
        Generate comprehensive investigation report
        
        Combines:
        - Case information
        - AI analysis results
        - Timeline reconstruction
        - Risk assessment
        - Recommendations
        """
        
        # Fetch case
        case = db.query(Case).filter(Case.case_id == case_id).first()
        if not case:
            return {"error": "Case not found"}
        
        # Fetch timeline events
        timeline_events = db.query(TimelineEvent).filter(
            TimelineEvent.case_id == case_id
        ).all()
        
        # Fetch AI results
        ai_results = db.query(AIResult).filter(
            AIResult.case_id == case_id
        ).all()
        
        # Fetch risk flags
        risk_flags = db.query(RiskFlag).filter(
            RiskFlag.case_id == case_id
        ).all()
        
        # Extract autopsy data
        autopsy_result = next(
            (r for r in ai_results if r.agent_name == "autopsy_agent"),
            None
        )
        autopsy_data = autopsy_result.result_json if autopsy_result else {}
        
        # Extract correlation data
        correlation_result = next(
            (r for r in ai_results if r.agent_name == "correlation_agent"),
            None
        )
        correlation_data = correlation_result.result_json if correlation_result else {}
        
        # Extract summary
        summary_result = next(
            (r for r in ai_results if r.agent_name == "summary_agent"),
            None
        )
        summary_data = summary_result.result_json if summary_result else {}
        
        # Build report
        report = {
            "case_id": case.case_id,
            "victim_name": case.victim_name,
            "incident_location": case.incident_location,
            "incident_date": case.incident_date,
            "status": case.status,
            "summary": summary_data.get("summary", "Investigation in progress"),
            "cause_of_death": autopsy_data.get("cause_of_death", "Under investigation"),
            "injuries": autopsy_data.get("injuries", []),
            "toxicology": autopsy_data.get("toxins", []),
            "timeline": [
                {
                    "timestamp": e.timestamp,
                    "source": e.source,
                    "event": e.event,
                    "severity": e.severity
                }
                for e in timeline_events
            ],
            "anomalies": correlation_data.get("anomalies", []),
            "suspicious_patterns": correlation_data.get("suspicious_patterns", []),
            "risk_level": case.risk_level,
            "risk_score": case.risk_score,
            "flags": [
                {
                    "name": f.flag_name,
                    "description": f.description,
                    "score": f.score
                }
                for f in risk_flags
            ],
            "recommendations": summary_data.get("recommendations", []),
            "case_notes": case.notes,
            "generated_at": str(case.updated_at)
        }
        
        log_info(f"✓ Report generated for case {case_id}")
        
        return report
