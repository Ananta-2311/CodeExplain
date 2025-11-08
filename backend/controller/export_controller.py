from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any, Dict, Optional
import json
import secrets
import hashlib

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    code: str
    explanation_data: Dict[str, Any]
    format: str = "markdown"  # "markdown" or "pdf"


def generate_markdown(code: str, explanation_data: Dict[str, Any]) -> str:
    """Generate Markdown export of code explanation."""
    md = []
    md.append("# Code Explanation Report\n\n")
    md.append(f"Generated: {explanation_data.get('generated_at', 'N/A')}\n\n")
    
    # Overview
    if explanation_data.get("overview"):
        md.append("## Overview\n\n")
        md.append(f"{explanation_data['overview']}\n\n")
    
    # Code
    md.append("## Source Code\n\n")
    md.append("```python\n")
    md.append(code)
    md.append("\n```\n\n")
    
    # Structured Explanations
    explanations = explanation_data.get("explanations", {})
    if explanations:
        md.append("## Code Structure\n\n")
        
        def add_explanation(name: str, data: Dict[str, Any], level: int = 0):
            indent = "  " * level
            node_type = data.get("type", "unknown")
            icon = "📦" if node_type == "class" else "⚙️"
            
            md.append(f"{indent}- {icon} **{name}** ({node_type})\n")
            
            if data.get("explanation"):
                md.append(f"{indent}  - {data['explanation']}\n")
            
            if data.get("start_line") and data.get("end_line"):
                md.append(f"{indent}  - Lines: {data['start_line']}-{data['end_line']}\n")
            
            if data.get("children"):
                for child_name, child_data in data["children"].items():
                    add_explanation(child_name, child_data, level + 1)
        
        for name, data in explanations.items():
            add_explanation(name, data)
        md.append("\n")
    
    # Suggestions (if available - could be in explanation_data or fetched separately)
    suggestions = explanation_data.get("suggestions", [])
    if not suggestions and isinstance(explanation_data.get("suggestions_data"), list):
        suggestions = explanation_data.get("suggestions_data", [])
    
    if suggestions:
        md.append("## Improvement Suggestions\n\n")
        for idx, sug in enumerate(suggestions, 1):
            priority = sug.get("priority", "medium")
            category = sug.get("category", "other")
            md.append(f"### {idx}. {sug.get('title', 'Suggestion')}\n\n")
            md.append(f"**Priority:** {priority} | **Category:** {category}\n\n")
            md.append(f"{sug.get('description', '')}\n\n")
            
            if sug.get("current_code"):
                md.append("**Current Code:**\n\n")
                md.append("```python\n")
                md.append(sug["current_code"])
                md.append("\n```\n\n")
            
            if sug.get("recommended_code"):
                md.append("**Recommended Code:**\n\n")
                md.append("```python\n")
                md.append(sug["recommended_code"])
                md.append("\n```\n\n")
        md.append("\n")
    
    return "".join(md)


@router.post("/markdown")
def export_markdown(req: ExportRequest):
    """Export code explanation as Markdown."""
    try:
        md_content = generate_markdown(req.code, req.explanation_data)
        return Response(
            content=md_content,
            media_type="text/markdown",
            headers={"Content-Disposition": 'attachment; filename="code_explanation.md"'}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "export_failed", "message": str(e)}
        )


@router.post("/pdf")
def export_pdf(req: ExportRequest):
    """Export code explanation as PDF (returns Markdown for now - PDF generation requires additional libraries)."""
    # For now, return Markdown. In production, use libraries like reportlab or weasyprint
    try:
        md_content = generate_markdown(req.code, req.explanation_data)
        # Return as text/plain with .md extension suggestion
        return Response(
            content=md_content,
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="code_explanation.md"'}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "export_failed", "message": str(e)}
        )

