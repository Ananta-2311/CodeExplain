from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from model.lang_router import parse_code
from model.ai_model import AIModel


router = APIRouter(prefix="/explain", tags=["explain"])

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


class ExplainRequest(BaseModel):
    code: str
    detail_level: str = "summary"
    organize_by_structure: bool = True
    language: Optional[str] = None
    filename: Optional[str] = None


def _extract_explainable_nodes(node: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Recursively extract classes and functions from AST tree."""
    nodes: List[Dict[str, Any]] = []
    
    node_type = node.get("type")
    if node_type in ("class", "function", "async_function"):
        nodes.append(node)
    
    for child in node.get("children", []):
        nodes.extend(_extract_explainable_nodes(child))
    
    return nodes


def _organize_explanations_by_structure(
    tree: Dict[str, Any],
    explanations: Dict[str, str],
    source_code: str,
) -> Dict[str, Any]:
    """Organize explanations by code structure (module -> classes -> functions)."""
    result: Dict[str, Any] = {
        "overview": explanations.get("module", "No overview available"),
        "structure": {},
    }
    
    def build_structure(node: Dict[str, Any], parent_path: str = "") -> Dict[str, Any]:
        """Recursively build structured explanation tree."""
        node_type = node.get("type")
        node_name = node.get("name", "")
        
        if node_type == "module":
            current_path = "module"
        elif parent_path:
            current_path = f"{parent_path}.{node_name}"
        else:
            current_path = node_name
        
        node_info: Dict[str, Any] = {
            "type": node_type,
            "name": node_name,
            "explanation": explanations.get(current_path, None),
            "start_line": node.get("start"),
            "end_line": node.get("end"),
        }
        
        if node_type == "class":
            node_info["bases"] = node.get("bases", [])
            node_info["decorators"] = node.get("decorators", [])
        elif node_type in ("function", "async_function"):
            node_info["args"] = node.get("args", [])
            node_info["returns"] = node.get("returns")
            node_info["decorators"] = node.get("decorators", [])
        
        children_explanations: Dict[str, Any] = {}
        for child in node.get("children", []):
            child_type = child.get("type")
            if child_type in ("class", "function", "async_function"):
                child_info = build_structure(child, current_path)
                child_name = child.get("name", "unnamed")
                children_explanations[child_name] = child_info
        
        if children_explanations:
            node_info["children"] = children_explanations
        
        return node_info
    
    structure = build_structure(tree)
    result["structure"] = structure.get("children", {}) if structure.get("type") == "module" else structure
    
    return result


@router.post("")
def explain(req: ExplainRequest):
    """Parse code and generate AI-powered explanation, organized by structure.

    Accepts raw Python code, parses it into AST, and generates explanations
    organized by classes and functions. Handles syntax and API errors gracefully.
    """
    try:
        parsed = parse_code(req.code, filename=req.filename, hint=req.language)
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
                    "offset": parsed.get("offset"),
                    "text": parsed.get("text"),
                    "hint": "Please check your Python code for syntax errors.",
                },
            )
        elif error_type == "invalid_input":
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_input",
                    "message": parsed.get("message", "Invalid input provided"),
                },
            )
        else:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "parse_failed",
                    "message": parsed.get("message", "Failed to parse code"),
                    "details": parsed,
                },
            )
    
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
        overview_result = ai_model.explain_code(
            ast_data=parsed,
            source_code=req.code,
            detail_level=req.detail_level,
        )
        
        if not overview_result.get("ok"):
            error_type = overview_result.get("error")
            if error_type == "rate_limit_exceeded":
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "rate_limit_exceeded",
                        "message": overview_result.get("message", "API rate limit exceeded"),
                        "hint": "Please wait a moment before trying again.",
                    },
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "ai_generation_failed",
                        "message": overview_result.get("message", "Failed to generate explanation"),
                        "details": overview_result,
                    },
                )
        
        overview = overview_result["explanation"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "unexpected_error",
                "message": f"Unexpected error during AI generation: {str(e)}",
                "type": type(e).__name__,
            },
        )
    
    explanations: Dict[str, str] = {"module": overview}
    
    if req.organize_by_structure:
        try:
            explainable_nodes = _extract_explainable_nodes(parsed["tree"])
            
            def get_node_paths(node: Dict[str, Any], parent_path: str = "") -> Dict[str, str]:
                """Build mapping of node names to their full paths."""
                paths: Dict[str, str] = {}
                node_type = node.get("type")
                node_name = node.get("name", "")
                
                if node_type == "module":
                    current_path = "module"
                elif parent_path:
                    current_path = f"{parent_path}.{node_name}"
                else:
                    current_path = node_name
                
                if node_type in ("class", "function", "async_function"):
                    paths[node_name] = current_path
                
                for child in node.get("children", []):
                    paths.update(get_node_paths(child, current_path))
                
                return paths
            
            node_paths = get_node_paths(parsed["tree"])
            
            for node in explainable_nodes:
                node_type = node.get("type")
                node_name = node.get("name", "unnamed")
                
                path = node_paths.get(node_name, node_name)
                
                node_result = ai_model.explain_ast_node(
                    node=node,
                    source_code=req.code,
                    detail_level=req.detail_level,
                )
                
                if node_result.get("ok"):
                    explanations[path] = node_result["explanation"]
                else:
                    explanations[path] = f"[Explanation unavailable: {node_result.get('message', 'Unknown error')}]"
            
            organized = _organize_explanations_by_structure(
                parsed["tree"],
                explanations,
                req.code,
            )
            
            return {
                "ok": True,
                "overview": organized.get("overview"),
                "explanations": organized.get("structure"),
                "ast": parsed["tree"],
            }
        
        except HTTPException:
            raise
        except Exception as e:
            return {
                "ok": True,
                "overview": overview,
                "explanations": None,
                "ast": parsed["tree"],
                "warning": f"Could not organize explanations: {str(e)}",
            }
    else:
        return {
            "ok": True,
            "explanation": overview,
            "ast": parsed["tree"],
        }


