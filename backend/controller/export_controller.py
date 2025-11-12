from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any, Dict, Optional
import json
import secrets
import hashlib
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.colors import HexColor

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    code: str
    explanation_data: Dict[str, Any]
    format: str = "markdown"


def generate_markdown(code: str, explanation_data: Dict[str, Any]) -> str:
    """Generate Markdown export of code explanation."""
    md = []
    md.append("# Code Explanation Report\n\n")
    md.append(f"Generated: {explanation_data.get('generated_at', 'N/A')}\n\n")
    
    if explanation_data.get("overview"):
        md.append("## Overview\n\n")
        md.append(f"{explanation_data['overview']}\n\n")
    
    md.append("## Source Code\n\n")
    md.append("```python\n")
    md.append(code)
    md.append("\n```\n\n")
    
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


def generate_pdf(code: str, explanation_data: Dict[str, Any]) -> bytes:
    """Generate PDF export of code explanation."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch)
    
    story = []
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=HexColor('#0066cc'),
        spaceAfter=30,
        alignment=TA_CENTER,
    )
    heading1_style = ParagraphStyle(
        'CustomHeading1',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=HexColor('#1a1a1a'),
        spaceAfter=12,
        spaceBefore=20,
    )
    heading2_style = ParagraphStyle(
        'CustomHeading2',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#333333'),
        spaceAfter=10,
        spaceBefore=16,
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=11,
        textColor=HexColor('#1a1a1a'),
        leading=14,
        spaceAfter=12,
    )
    code_style = ParagraphStyle(
        'CodeStyle',
        parent=styles['Code'],
        fontSize=9,
        textColor=HexColor('#1a1a1a'),
        fontName='Courier',
        leading=11,
        leftIndent=20,
        rightIndent=20,
        spaceAfter=12,
        backColor=HexColor('#f5f5f5'),
    )
    
    story.append(Paragraph("Code Explanation Report", title_style))
    story.append(Spacer(1, 0.2*inch))
    
    generated_at = explanation_data.get('generated_at', 'N/A')
    story.append(Paragraph(f"<i>Generated: {generated_at}</i>", normal_style))
    story.append(Spacer(1, 0.3*inch))
    
    if explanation_data.get("overview"):
        story.append(Paragraph("Overview", heading1_style))
        overview_text = explanation_data['overview'].replace('\n', '<br/>')
        story.append(Paragraph(overview_text, normal_style))
        story.append(Spacer(1, 0.2*inch))
    
    story.append(Paragraph("Source Code", heading1_style))
    story.append(Preformatted(code, code_style))
    story.append(Spacer(1, 0.2*inch))
    
    explanations = explanation_data.get("explanations", {})
    if explanations:
        story.append(Paragraph("Code Structure", heading1_style))
        
        def add_explanation_pdf(name: str, data: Dict[str, Any], level: int = 0):
            node_type = data.get("type", "unknown")
            indent = "&nbsp;" * (level * 4)
            
            element_text = f"{indent}<b>{name}</b> ({node_type})"
            story.append(Paragraph(element_text, heading2_style))
            
            if data.get("explanation"):
                exp_text = data['explanation'].replace('\n', '<br/>')
                story.append(Paragraph(exp_text, normal_style))
            
            if data.get("start_line") and data.get("end_line"):
                story.append(Paragraph(f"<i>Lines: {data['start_line']}-{data['end_line']}</i>", normal_style))
            
            story.append(Spacer(1, 0.1*inch))
            
            if data.get("children"):
                for child_name, child_data in data["children"].items():
                    add_explanation_pdf(child_name, child_data, level + 1)
        
        for name, data in explanations.items():
            add_explanation_pdf(name, data)
        story.append(Spacer(1, 0.2*inch))
    
    suggestions = explanation_data.get("suggestions", [])
    if not suggestions and isinstance(explanation_data.get("suggestions_data"), list):
        suggestions = explanation_data.get("suggestions_data", [])
    
    if suggestions:
        story.append(PageBreak())
        story.append(Paragraph("Improvement Suggestions", heading1_style))
        
        for idx, sug in enumerate(suggestions, 1):
            priority = sug.get("priority", "medium")
            category = sug.get("category", "other")
            title = sug.get('title', 'Suggestion')
            
            story.append(Paragraph(f"{idx}. {title}", heading2_style))
            story.append(Paragraph(f"<b>Priority:</b> {priority} | <b>Category:</b> {category}", normal_style))
            
            description = sug.get('description', '').replace('\n', '<br/>')
            story.append(Paragraph(description, normal_style))
            story.append(Spacer(1, 0.1*inch))
            
            if sug.get("current_code"):
                story.append(Paragraph("<b>Current Code:</b>", normal_style))
                story.append(Preformatted(sug["current_code"], code_style))
            
            if sug.get("recommended_code"):
                story.append(Paragraph("<b>Recommended Code:</b>", normal_style))
                story.append(Preformatted(sug["recommended_code"], code_style))
            
            story.append(Spacer(1, 0.2*inch))
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


@router.post("/pdf")
def export_pdf(req: ExportRequest):
    """Export code explanation as PDF."""
    try:
        pdf_content = generate_pdf(req.code, req.explanation_data)
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="code_explanation.pdf"'}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "export_failed", "message": str(e)}
        )

