import pdfplumber
import json
from pathlib import Path
from typing import Dict, Any
from utils.logger import log_info, log_error


def parse_pdf(file_path: str) -> Dict[str, Any]:
    """
    Parse PDF file and extract text content
    """
    try:
        result = {
            "text": "",
            "pages": 0,
            "extracted_sections": {}
        }
        
        with pdfplumber.open(file_path) as pdf:
            result["pages"] = len(pdf.pages)
            
            # Extract text from all pages
            all_text = []
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                all_text.append(text)
                
                # Extract tables if any
                tables = page.extract_tables()
                if tables:
                    result["extracted_sections"][f"page_{i+1}_tables"] = tables
            
            result["text"] = "\n".join(all_text)
        
        log_info(f"✓ PDF parsed: {file_path} ({result['pages']} pages)")
        return result
    
    except Exception as e:
        log_error("PDF parsing failed", e)
        return {
            "text": "",
            "pages": 0,
            "error": str(e)
        }


def extract_autopsy_data(pdf_text: str) -> Dict[str, Any]:
    """
    Extract key autopsy information from PDF text
    """
    data = {
        "victim_name": "",
        "age": "",
        "gender": "",
        "cause_of_death": "",
        "injuries": [],
        "toxicology": [],
        "notes": pdf_text[:500]  # Store beginning of text
    }
    
    # Simple keyword-based extraction
    lines = pdf_text.lower().split('\n')
    
    for line in lines:
        if 'cause of death' in line:
            parts = line.split(':')
            if len(parts) > 1:
                data["cause_of_death"] = parts[1].strip()
        
        if 'injury' in line or 'wound' in line or 'trauma' in line:
            data["injuries"].append(line.strip())
        
        if 'toxin' in line or 'poison' in line or 'drug' in line:
            data["toxicology"].append(line.strip())
    
    return data
