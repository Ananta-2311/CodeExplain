from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from model.parser_model import ParserModel
from model.ai_model import AIModel


router = APIRouter(prefix="/explain", tags=["explain"])

# Initialize models (singleton pattern)
_parser = ParserModel()
_ai_model: AIModel | None = None


def get_ai_model() -> AIModel:
    """Lazy initialization of AI model (only if API key is set)."""
    global _ai_model
    if _ai_model is None:
        try:
            _ai_model = AIModel()
        except ValueError as e:
            raise HTTPException(
                status_code=500,
                detail=f"AI model initialization failed: {str(e)}. Please set OPENAI_API_KEY environment variable.",
            )
    return _ai_model


class ExplainRequest(BaseModel):
    code: str
    detail_level: str = "summary"  # "summary", "brief", or "detailed"


@router.post("")
def explain(req: ExplainRequest):
    """Parse code and generate AI-powered explanation."""
    # Parse the code
    parsed = _parser.parse(req.code)
    
    if not parsed.get("ok"):
        raise HTTPException(
            status_code=400,
            detail={"error": "parse_failed", "details": parsed},
        )
    
    # Generate AI explanation
    try:
        ai_model = get_ai_model()
        explanation_result = ai_model.explain_code(
            ast_data=parsed,
            source_code=req.code,
            detail_level=req.detail_level,
        )
        
        if not explanation_result.get("ok"):
            raise HTTPException(
                status_code=429 if explanation_result.get("error") == "rate_limit_exceeded" else 500,
                detail=explanation_result,
            )
        
        return {
            "ok": True,
            "explanation": explanation_result["explanation"],
            "ast": parsed["tree"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "unexpected_error", "message": str(e)})


