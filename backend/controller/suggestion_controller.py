from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from model.parser_model import ParserModel
from model.ai_model import AIModel
import json


router = APIRouter(prefix="/suggestions", tags=["suggestions"])

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
                detail={
                    "error": "ai_initialization_failed",
                    "message": str(e),
                    "hint": "Please set OPENAI_API_KEY environment variable in .env file or environment.",
                },
            )
    return _ai_model


class SuggestionRequest(BaseModel):
    code: str
    focus_areas: Optional[List[str]] = None


class SuggestionGenerator:
    """Generates code improvement suggestions using OpenAI."""
    
    def __init__(self, ai_model: AIModel):
        self.ai_model = ai_model
    
    def generate_suggestions(
        self,
        source_code: str,
        ast_data: Dict[str, Any],
        focus_areas: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Generate improvement suggestions from code and AST.
        
        Returns suggestions categorized by:
        - refactoring: Code structure improvements
        - complexity: Reducing cyclomatic complexity
        - security: Security best practices
        - performance: Performance optimizations
        """
        if not ast_data.get("ok"):
            return {
                "ok": False,
                "error": "invalid_ast",
                "message": "AST parsing failed",
            }
        
        if not self.ai_model.rate_limiter.acquire():
            wait = self.ai_model.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }
        
        try:
            ast_json = json.dumps(ast_data["tree"], indent=2)
            
            focus_text = ""
            if focus_areas:
                focus_text = f"\n\nFocus on these areas: {', '.join(focus_areas)}"
            
            system_prompt = (
                "You are an expert code reviewer and software engineering consultant. "
                "Analyze the provided Python code and its AST structure to generate "
                "actionable improvement suggestions. Focus on:\n"
                "1. **Refactoring**: Better code structure, DRY principles, design patterns\n"
                "2. **Complexity Reduction**: Simplify logic, reduce nesting, improve readability\n"
                "3. **Security**: Secure coding practices, input validation, vulnerability prevention\n"
                "4. **Performance**: Optimizations for speed and efficiency\n"
                f"{focus_text}\n\n"
                "For each suggestion, provide:\n"
                "- A clear title\n"
                "- Description of the issue or improvement opportunity\n"
                "- Priority level: 'high', 'medium', or 'low'\n"
                "- Category: 'refactoring', 'complexity', 'security', or 'performance'\n"
                "- If applicable, provide a code snippet showing the recommended improvement\n"
                "Return your response as a JSON object with this structure:\n"
                "{\n"
                '  "suggestions": [\n'
                "    {\n"
                '      "title": "Suggestion title",\n'
                '      "description": "Detailed description",\n'
                '      "priority": "high|medium|low",\n'
                '      "category": "refactoring|complexity|security|performance",\n'
                '      "current_code": "Optional: current code snippet (if applicable)",\n'
                '      "recommended_code": "Optional: recommended code snippet (if applicable)",\n'
                "      \"line_numbers\": \"Optional: line range like '5-10' (if applicable)\"\n"
                "    }\n"
                "  ]\n"
                "}\n"
                "Provide 3-8 suggestions. Be specific and actionable."
            )
            
            user_prompt = (
                "Here is the Python code and its AST structure:\n\n"
                f"Source Code:\n```python\n{source_code}\n```\n\n"
                f"AST Structure:\n```json\n{ast_json}\n```\n\n"
                "Analyze this code and provide improvement suggestions."
            )
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            
            response = self.ai_model.client.chat.completions.create(
                model=self.ai_model.model,
                messages=messages,
                max_tokens=min(self.ai_model.max_tokens_per_request, 3000),
                temperature=0.4,
                response_format={"type": "json_object"},
            )
            
            response_text = response.choices[0].message.content.strip()
            
            try:
                suggestions_data = json.loads(response_text)
                
                suggestions = suggestions_data.get("suggestions", [])
                
                categorized = {
                    "refactoring": [],
                    "complexity": [],
                    "security": [],
                    "performance": [],
                    "other": [],
                }
                
                for suggestion in suggestions:
                    category = suggestion.get("category", "other").lower()
                    if category not in categorized:
                        category = "other"
                    categorized[category].append(suggestion)
                
                # Remove empty categories
                categorized = {k: v for k, v in categorized.items() if v}
                
                return {
                    "ok": True,
                    "suggestions": suggestions,
                    "categorized": categorized,
                    "total_count": len(suggestions),
                }
            
            except json.JSONDecodeError as e:
                # If JSON parsing fails, try to extract suggestions from text
                fallback_suggestion = {
                    "title": "Analysis Result",
                    "description": response_text,
                    "priority": "medium",
                    "category": "other",
                }
                return {
                    "ok": True,
                    "suggestions": [fallback_suggestion],
                    "categorized": {"other": [fallback_suggestion]},
                    "total_count": 1,
                    "warning": "Response was not in expected JSON format",
                }
        
        except HTTPException:
            raise
        except Exception as e:
            return {
                "ok": False,
                "error": "suggestion_generation_failed",
                "message": f"Failed to generate suggestions: {str(e)}",
            }


@router.post("")
def get_suggestions(req: SuggestionRequest):
    """Analyze code and generate improvement suggestions.
    
    Analyzes the provided Python code using AI to generate suggestions for:
    - Code refactoring
    - Complexity reduction
    - Security improvements
    - Performance optimizations
    
    Returns categorized suggestions with code snippets where applicable.
    """
    # Step 1: Parse the code into AST
    try:
        parsed = _parser.parse(req.code)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "parsing_error",
                "message": f"Unexpected error during parsing: {str(e)}",
                "type": type(e).__name__,
            },
        )
    
    if not parsed.get("ok"):
        error_type = parsed.get("error", "unknown_error")
        if error_type == "syntax_error":
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "syntax_error",
                    "message": parsed.get("message", "Invalid Python syntax"),
                    "line": parsed.get("lineno"),
                    "hint": "Please check your Python code for syntax errors.",
                },
            )
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "parse_failed",
                    "message": parsed.get("message", "Failed to parse code"),
                },
            )
    
    # Step 2: Generate suggestions
    try:
        ai_model = get_ai_model()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "ai_model_error",
                "message": f"Failed to initialize AI model: {str(e)}",
            },
        )
    
    try:
        generator = SuggestionGenerator(ai_model)
        result = generator.generate_suggestions(
            source_code=req.code,
            ast_data=parsed,
            focus_areas=req.focus_areas,
        )
        
        if not result.get("ok"):
            error_type = result.get("error")
            if error_type == "rate_limit_exceeded":
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "rate_limit_exceeded",
                        "message": result.get("message", "API rate limit exceeded"),
                        "hint": "Please wait a moment before trying again.",
                    },
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "suggestion_generation_failed",
                        "message": result.get("message", "Failed to generate suggestions"),
                        "details": result,
                    },
                )
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "unexpected_error",
                "message": f"Unexpected error during suggestion generation: {str(e)}",
                "type": type(e).__name__,
            },
        )

