from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Set, Optional, Tuple
from model.parser_model import ParserModel
import ast


router = APIRouter(prefix="/visualize", tags=["visualize"])

# Initialize parser (singleton pattern)
_parser = ParserModel()


class VisualizeRequest(BaseModel):
    code: str


class ASTAnalyzer:
    """Analyzes AST to extract data flow relationships, function calls, and dependencies."""
    
    def __init__(self, source_code: str):
        self.source_code = source_code
        self.function_definitions: Dict[str, Dict[str, Any]] = {}  # name -> info
        self.class_definitions: Dict[str, Dict[str, Any]] = {}  # name -> info
        self.variable_definitions: Dict[str, Dict[str, Any]] = {}  # name -> info
        self.function_calls: List[Tuple[str, str, int]] = []  # (caller, callee, line)
        self.variable_usages: List[Tuple[str, str, int]] = []  # (function, variable, line)
        self.inheritance_relations: List[Tuple[str, str]] = []  # (child, parent)
        self.imports: List[Dict[str, Any]] = []
        self.current_context: List[str] = []  # Stack of current function/class names
    
    def analyze(self) -> Dict[str, Any]:
        """Main analysis entry point."""
        try:
            tree = ast.parse(self.source_code)
            self._visit_module(tree)
            
            return {
                "nodes": self._build_nodes(),
                "links": self._build_edges(),  # Using 'links' for compatibility with D3.js/force-graph
                "imports": self.imports,
            }
        except SyntaxError as exc:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "syntax_error",
                    "message": str(exc),
                    "line": exc.lineno,
                }
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "analysis_error",
                    "message": str(exc),
                }
            )
    
    def _visit_module(self, node: ast.Module):
        """Visit module and analyze all top-level definitions and statements."""
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                self._visit_function_def(item, None)
            elif isinstance(item, ast.AsyncFunctionDef):
                self._visit_function_def(item, None, is_async=True)
            elif isinstance(item, ast.ClassDef):
                self._visit_class_def(item, None)
            elif isinstance(item, (ast.Import, ast.ImportFrom)):
                self._visit_import(item)
            elif isinstance(item, (ast.Assign, ast.AnnAssign)):
                self._visit_variable_def(item, None)
    
    def _visit_class_def(self, node: ast.ClassDef, parent_context: Optional[str]):
        """Visit class definition and extract inheritance and methods."""
        class_name = node.name
        full_name = f"{parent_context}.{class_name}" if parent_context else class_name
        
        # Track class
        self.class_definitions[full_name] = {
            "name": class_name,
            "full_name": full_name,
            "bases": [self._expr_to_str(base) for base in node.bases],
            "decorators": [self._expr_to_str(d) for d in node.decorator_list],
            "line": node.lineno,
            "type": "class",
        }
        
        # Track inheritance relationships
        for base in node.bases:
            if isinstance(base, ast.Name):
                self.inheritance_relations.append((full_name, base.id))
            elif isinstance(base, ast.Attribute):
                # Handle qualified names like "BaseClass"
                base_name = self._expr_to_str(base)
                self.inheritance_relations.append((full_name, base_name))
        
        # Analyze class body
        old_context = self.current_context.copy()
        self.current_context.append(full_name)
        
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                self._visit_function_def(item, full_name)
            elif isinstance(item, ast.AsyncFunctionDef):
                self._visit_function_def(item, full_name, is_async=True)
            elif isinstance(item, (ast.Assign, ast.AnnAssign)):
                self._visit_variable_def(item, full_name)
        
        self.current_context = old_context
    
    def _visit_function_def(self, node: ast.FunctionDef, parent_context: Optional[str], is_async: bool = False):
        """Visit function definition and analyze its body for calls and variable usage."""
        func_name = node.name
        full_name = f"{parent_context}.{func_name}" if parent_context else func_name
        
        # Track function
        self.function_definitions[full_name] = {
            "name": func_name,
            "full_name": full_name,
            "args": [arg.arg for arg in node.args.args],
            "returns": self._expr_to_str(node.returns) if node.returns else None,
            "decorators": [self._expr_to_str(d) for d in node.decorator_list],
            "line": node.lineno,
            "type": "async_function" if is_async else "function",
            "is_method": parent_context is not None and parent_context in self.class_definitions,
        }
        
        # Analyze function body
        old_context = self.current_context.copy()
        self.current_context.append(full_name)
        
        for stmt in node.body:
            self._visit_statement(stmt, full_name)
        
        self.current_context = old_context
    
    def _visit_statement(self, stmt: ast.stmt, context: str):
        """Visit a statement and extract calls, variable usage, etc."""
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            self._visit_call(stmt.value, context)
        elif isinstance(stmt, ast.Call):
            self._visit_call(stmt, context)
        elif isinstance(stmt, ast.Assign):
            self._visit_variable_def(stmt, context)
            # Also check for calls in the assignment value
            if isinstance(stmt.value, ast.Call):
                self._visit_call(stmt.value, context)
        elif isinstance(stmt, ast.Return) and stmt.value:
            if isinstance(stmt.value, ast.Call):
                self._visit_call(stmt.value, context)
        elif isinstance(stmt, (ast.For, ast.While, ast.If)):
            # Recursively visit nested statements
            for nested in getattr(stmt, 'body', []):
                self._visit_statement(nested, context)
            for nested in getattr(stmt, 'orelse', []):
                self._visit_statement(nested, context)
        elif isinstance(stmt, ast.FunctionDef):
            # Nested function
            self._visit_function_def(stmt, context)
        elif isinstance(stmt, ast.AsyncFunctionDef):
            self._visit_function_def(stmt, context, is_async=True)
    
    def _visit_call(self, node: ast.Call, caller_context: str):
        """Visit a function call and track the relationship."""
        callee_name = self._get_callable_name(node.func)
        if callee_name:
            self.function_calls.append((caller_context, callee_name, node.lineno))
    
    def _visit_variable_def(self, node: ast.stmt, context: Optional[str]):
        """Visit variable definition."""
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    var_name = target.id
                    full_var_name = f"{context}.{var_name}" if context else var_name
                    self.variable_definitions[full_var_name] = {
                        "name": var_name,
                        "full_name": full_var_name,
                        "value": self._expr_to_str(node.value),
                        "line": node.lineno,
                        "context": context,
                        "type": "variable",
                    }
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                var_name = node.target.id
                full_var_name = f"{context}.{var_name}" if context else var_name
                self.variable_definitions[full_var_name] = {
                    "name": var_name,
                    "full_name": full_var_name,
                    "value": self._expr_to_str(node.value) if node.value else None,
                    "annotation": self._expr_to_str(node.target.annotation) if hasattr(node.target, 'annotation') else None,
                    "line": node.lineno,
                    "context": context,
                    "type": "variable",
                }
    
    def _visit_import(self, node: ast.stmt):
        """Visit import statement."""
        if isinstance(node, ast.Import):
            for alias in node.names:
                self.imports.append({
                    "module": alias.name,
                    "alias": alias.asname or alias.name,
                    "type": "import",
                    "line": node.lineno,
                })
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            for alias in node.names:
                self.imports.append({
                    "module": module,
                    "name": alias.name,
                    "alias": alias.asname or alias.name,
                    "type": "import_from",
                    "line": node.lineno,
                })
    
    def _get_callable_name(self, node: ast.expr) -> Optional[str]:
        """Extract the name of a callable from an AST expression."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            # Handle method calls like obj.method()
            attr = self._expr_to_str(node)
            return attr
        return None
    
    def _expr_to_str(self, expr: ast.AST) -> str:
        """Convert AST expression to string representation."""
        try:
            return ast.unparse(expr)  # type: ignore[attr-defined]
        except Exception:
            if isinstance(expr, ast.Name):
                return expr.id
            return expr.__class__.__name__
    
    def _build_nodes(self) -> List[Dict[str, Any]]:
        """Build node list for graph visualization."""
        nodes: List[Dict[str, Any]] = []
        node_ids: Set[str] = set()
        
        # Add function nodes
        for full_name, info in self.function_definitions.items():
            node_id = full_name
            if node_id not in node_ids:
                nodes.append({
                    "id": node_id,
                    "label": info["name"],
                    "full_name": full_name,
                    "type": info["type"],
                    "group": "function",
                    "line": info["line"],
                    "is_method": info.get("is_method", False),
                })
                node_ids.add(node_id)
        
        # Add class nodes
        for full_name, info in self.class_definitions.items():
            node_id = full_name
            if node_id not in node_ids:
                nodes.append({
                    "id": node_id,
                    "label": info["name"],
                    "full_name": full_name,
                    "type": "class",
                    "group": "class",
                    "line": info["line"],
                    "bases": info["bases"],
                })
                node_ids.add(node_id)
        
        # Add variable nodes (only top-level and class-level, not function-local)
        for full_name, info in self.variable_definitions.items():
            # Only include module-level and class-level variables, not function-local
            if info["context"] is None or info["context"] in self.class_definitions:
                node_id = full_name
                if node_id not in node_ids:
                    nodes.append({
                        "id": node_id,
                        "label": info["name"],
                        "full_name": full_name,
                        "type": "variable",
                        "group": "variable",
                        "line": info["line"],
                    })
                    node_ids.add(node_id)
        
        return nodes
    
    def _build_edges(self) -> List[Dict[str, Any]]:
        """Build edge list for graph visualization."""
        edges: List[Dict[str, Any]] = []
        edge_keys: Set[str] = set()
        
        # Function call edges
        for caller, callee, line in self.function_calls:
            edge_key = f"{caller}->{callee}"
            if edge_key not in edge_keys:
                edges.append({
                    "source": caller,
                    "target": callee,
                    "type": "calls",
                    "label": "calls",
                    "line": line,
                })
                edge_keys.add(edge_key)
        
        # Inheritance edges
        for child, parent in self.inheritance_relations:
            edge_key = f"{child}->{parent}"
            if edge_key not in edge_keys:
                edges.append({
                    "source": child,
                    "target": parent,
                    "type": "inherits",
                    "label": "inherits",
                })
                edge_keys.add(edge_key)
        
        # Containment edges (functions in classes, nested functions)
        for func_name, func_info in self.function_definitions.items():
            # Extract parent from full_name (e.g., "MyClass.method" -> parent is "MyClass")
            parts = func_name.split(".")
            if len(parts) > 1:
                parent = ".".join(parts[:-1])
                edge_key = f"{parent}->{func_name}"
                if edge_key not in edge_keys and parent in self.class_definitions:
                    edges.append({
                        "source": parent,
                        "target": func_name,
                        "type": "contains",
                        "label": "contains",
                    })
                    edge_keys.add(edge_key)
        
        return edges


@router.post("")
def visualize(req: VisualizeRequest):
    """Generate data flow visualization graph from code AST.
    
    Analyzes the code to extract:
    - Function definitions and their calls
    - Class definitions and inheritance
    - Variable definitions (module/class level)
    - Import dependencies
    
    Returns a graph structure with nodes and edges suitable for D3.js rendering.
    """
    try:
        analyzer = ASTAnalyzer(req.code)
        graph_data = analyzer.analyze()
        
        return {
            "ok": True,
            "graph": graph_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "visualization_error",
                "message": f"Failed to generate visualization: {str(e)}",
            }
        )

