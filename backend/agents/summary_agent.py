from typing import Dict, Any, List
import json
import os
from utils.logger import log_info, log_error
from utils.helpers import clean_ai_response


def generate_investigation_summary(case_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate executive summary and recommendations
    """
    
    try:
        from crewai import Agent, Task
        from pydantic import BaseModel
        import litellm
        from dotenv import load_dotenv
        
        load_dotenv()
        
        # Configure LiteLLM
        litellm.api_base = os.getenv(
            "FEATHERLESS_BASE_URL",
            "https://api.featherless.ai/v1"
        )
        litellm.api_key = os.getenv(
            "FEATHERLESS_API_KEY",
            "mock_key_replace_with_yours"
        )
        
        class InvestigationSummary(BaseModel):
            summary: str
            recommendations: list
            confidence: float
        
        agent = Agent(
            role="Investigation Supervisor",
            goal="Generate investigation summary and recommendations",
            backstory="""You are a senior investigation supervisor with expertise in
            synthesizing complex evidence into actionable intelligence.""",
            llm_name=f"openai/{os.getenv('MODEL_NAME', 'Qwen/Qwen2.5-7B-Instruct')}",
            temperature=0.1,
            verbose=True
        )
        
        case_summary = json.dumps({
            "cause_of_death": case_data.get("cause_of_death", ""),
            "injuries": case_data.get("injuries", [])[:3],
            "timeline_events": len(case_data.get("events", [])),
            "anomalies": len(case_data.get("anomalies", [])),
            "risk_level": case_data.get("risk_level", "")
        }, indent=2)
        
        task = Task(
            description=f"""Based on this investigation data, provide summary and recommendations.
            
            Investigation Summary:
            {case_summary}
            
            Return ONLY this JSON with NO markdown, NO code fences:
            {{
                "summary": "Brief investigation summary (1-2 sentences)",
                "recommendations": ["recommendation1", "recommendation2"],
                "confidence": 0.75
            }}
            """,
            agent=agent,
            output_json=InvestigationSummary,
            expected_output="Valid JSON with summary and recommendations"
        )
        
        result = task.execute()
        
        cleaned = clean_ai_response(str(result.raw))
        data = json.loads(cleaned)
        
        log_info(f"✓ Investigation summary generated")
        
        return {
            "summary": data.get("summary", "Investigation ongoing"),
            "recommendations": data.get("recommendations", []),
            "confidence": data.get("confidence", 0.5)
        }
    
    except Exception as e:
        log_error("Summary generation failed, using fallback", e)
        return _fallback_summary_generation(case_data)


def _fallback_summary_generation(case_data: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback summary generation"""
    
    cause = case_data.get("cause_of_death", "undetermined")
    risk_level = case_data.get("risk_level", "UNKNOWN")
    timeline_count = len(case_data.get("events", []))
    
    summary = f"Investigation findings suggest {cause}. Risk level classified as {risk_level}. "
    summary += f"Timeline includes {timeline_count} documented events with identified anomalies requiring further investigation."
    
    recommendations = []
    
    if risk_level == "HIGH":
        recommendations.extend([
            "Escalate to priority investigation team",
            "Request additional forensic analysis",
            "Conduct extended witness interviews"
        ])
    elif risk_level == "MEDIUM":
        recommendations.extend([
            "Continue standard investigation protocols",
            "Review timeline for inconsistencies",
            "Request specialist pathology review"
        ])
    else:
        recommendations.append("Proceed with standard investigation procedures")
    
    recommendations.append("Document all findings for prosecution support")
    
    log_info(f"✓ Summary fallback generated with {len(recommendations)} recommendations")
    
    return {
        "summary": summary,
        "recommendations": recommendations,
        "confidence": 0.65
    }
