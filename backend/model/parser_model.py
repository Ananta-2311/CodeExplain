import ast
from typing import Any, Dict, List, Optional


class ParserModel:
    """AST-based parser that extracts a hierarchical code structure.

    Produces a JSON-serializable dict with classes, functions, variables, and imports,
    preserving source order and nesting (e.g., methods inside classes, inner functions).
    """

    def parse(self, source_code: Optional[str]) -> Dict[str, Any]:
        if not isinstance(source_code, str):
            return {
                "ok": False,
                "error": "invalid_input",
                "message": "source_code must be a string",
            }

        try:
            tree = ast.parse(source_code)
        except SyntaxError as exc:
            return {
                "ok": False,
                "error": "syntax_error",
                "message": str(exc),
                "lineno": getattr(exc, "lineno", None),
                "offset": getattr(exc, "offset", None),
                "text": getattr(exc, "text", None),
            }
        except Exception as exc:  # defensive catch for very large/edge inputs
            return {"ok": False, "error": "parse_failure", "message": str(exc)}

        module_info = {
            "type": "module",
            "name": None,
            "start": 1,
            "end": self._get_end_lineno(tree) or None,
            "children": self._extract_body(tree.body),
        }

        return {"ok": True, "tree": module_info}

    # ---------------------------- Helpers ---------------------------------
    def _extract_body(self, body: List[ast.stmt]) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for node in body:
            handler = self._handler_for_node(node)
            if handler is not None:
                items.append(handler(node))
        return items

    def _handler_for_node(self, node: ast.AST):
        if isinstance(node, ast.ClassDef):
            return self._handle_class
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return self._handle_function
        if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
            return self._handle_variable
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return self._handle_import
        return None

    # Class -----------------------------------------------------------------
    def _handle_class(self, node: ast.ClassDef) -> Dict[str, Any]:
        bases = [self._expr_to_str(b) for b in node.bases] if getattr(node, "bases", None) else []
        decorators = [self._expr_to_str(d) for d in node.decorator_list] if getattr(node, "decorator_list", None) else []
        return {
            "type": "class",
            "name": node.name,
            "bases": bases,
            "decorators": decorators,
            "start": getattr(node, "lineno", None),
            "end": self._get_end_lineno(node),
            "children": self._extract_body(node.body),
        }

    # Function --------------------------------------------------------------
    def _handle_function(self, node: ast.AST) -> Dict[str, Any]:
        assert isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        args = self._format_args(node.args)
        returns = self._expr_to_str(node.returns) if getattr(node, "returns", None) else None
        decorators = [self._expr_to_str(d) for d in node.decorator_list] if getattr(node, "decorator_list", None) else []
        return {
            "type": "async_function" if isinstance(node, ast.AsyncFunctionDef) else "function",
            "name": node.name,
            "args": args,
            "returns": returns,
            "decorators": decorators,
            "start": getattr(node, "lineno", None),
            "end": self._get_end_lineno(node),
            "children": self._extract_body(node.body),
        }

    def _format_args(self, args: ast.arguments) -> List[Dict[str, Any]]:
        def arg_to_dict(a: ast.arg, default: Optional[str] = None) -> Dict[str, Any]:
            return {
                "name": a.arg,
                "annotation": self._expr_to_str(a.annotation) if getattr(a, "annotation", None) else None,
                "default": default,
            }

        result: List[Dict[str, Any]] = []
        pos_defaults = [self._expr_to_str(d) for d in getattr(args, "defaults", [])]
        # Map defaults to last N positional args
        pos_args = list(getattr(args, "posonlyargs", [])) + list(getattr(args, "args", []))
        defaults_map: Dict[int, Optional[str]] = {}
        if pos_defaults:
            for i, dv in enumerate(pos_defaults):
                defaults_map[len(pos_args) - len(pos_defaults) + i] = dv

        for i, a in enumerate(pos_args):
            result.append(arg_to_dict(a, defaults_map.get(i)))

        if getattr(args, "vararg", None):
            result.append({
                "name": f"*{args.vararg.arg}",
                "annotation": self._expr_to_str(args.vararg.annotation) if getattr(args.vararg, "annotation", None) else None,
                "default": None,
            })

        kw_defaults = [self._expr_to_str(d) if d is not None else None for d in getattr(args, "kw_defaults", [])]
        for i, a in enumerate(getattr(args, "kwonlyargs", [])):
            result.append(arg_to_dict(a, kw_defaults[i] if i < len(kw_defaults) else None))

        if getattr(args, "kwarg", None):
            result.append({
                "name": f"**{args.kwarg.arg}",
                "annotation": self._expr_to_str(args.kwarg.annotation) if getattr(args.kwarg, "annotation", None) else None,
                "default": None,
            })
        return result

    # Variables -------------------------------------------------------------
    def _handle_variable(self, node: ast.AST) -> Dict[str, Any]:
        if isinstance(node, ast.Assign):
            targets = [self._target_to_str(t) for t in node.targets]
            value = self._expr_to_str(node.value)
            kind = "assign"
        elif isinstance(node, ast.AnnAssign):
            targets = [self._target_to_str(node.target)]
            value = self._expr_to_str(node.value) if node.value is not None else None
            kind = "ann_assign"
        else:  # ast.AugAssign
            targets = [self._target_to_str(node.target)]
            value = f"{self._target_to_str(node.target)} {self._op_to_str(node.op)}= {self._expr_to_str(node.value)}"
            kind = "aug_assign"

        return {
            "type": "variable",
            "kind": kind,
            "targets": targets,
            "value": value,
            "start": getattr(node, "lineno", None),
            "end": self._get_end_lineno(node),
        }

    # Imports ---------------------------------------------------------------
    def _handle_import(self, node: ast.AST) -> Dict[str, Any]:
        if isinstance(node, ast.Import):
            items = [{"name": n.name, "asname": n.asname} for n in node.names]
            return {
                "type": "import",
                "module": None,
                "names": items,
                "start": getattr(node, "lineno", None),
                "end": self._get_end_lineno(node),
            }
        else:
            assert isinstance(node, ast.ImportFrom)
            items = [{"name": n.name, "asname": n.asname} for n in node.names]
            return {
                "type": "import_from",
                "module": node.module,
                "level": getattr(node, "level", 0),
                "names": items,
                "start": getattr(node, "lineno", None),
                "end": self._get_end_lineno(node),
            }

    # --------------------------- Utilities --------------------------------
    def _get_end_lineno(self, node: ast.AST) -> Optional[int]:
        return getattr(node, "end_lineno", None)

    def _expr_to_str(self, expr: Optional[ast.AST]) -> Optional[str]:
        if expr is None:
            return None
        try:
            return ast.unparse(expr)  # type: ignore[attr-defined]
        except Exception:
            return expr.__class__.__name__

    def _target_to_str(self, target: ast.AST) -> str:
        try:
            return ast.unparse(target)  # type: ignore[attr-defined]
        except Exception:
            if isinstance(target, ast.Name):
                return target.id
            return target.__class__.__name__

    def _op_to_str(self, op: ast.AST) -> str:
        return op.__class__.__name__.replace("Add", "+").replace("Sub", "-")

