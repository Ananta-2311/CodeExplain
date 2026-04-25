"""Python ``ast`` parser that turns source into a nested JSON tree for AI and UI.

Walks ``ast.parse`` output (with optional repair for empty def/class bodies) and
emits a stable JSON tree: module, classes, functions, variables, imports, and
nested bodies—used by explain, visualize, and suggestions flows.
"""

import ast
import re
from typing import Any, Dict, List, Optional


class ParserModel:
    """AST-based parser that extracts a hierarchical code structure.

    Produces a JSON-serializable dict with classes, functions, variables, and imports,
    preserving source order and nesting (e.g., methods inside classes, inner functions).
    """

    def parse(self, source_code: Optional[str]) -> Dict[str, Any]:
        """Parse ``source_code`` into ``{ok, tree}`` or an error dict (syntax/invalid input)."""
        if not isinstance(source_code, str):
            return {
                "ok": False,
                "error": "invalid_input",
                "message": "source_code must be a string",
            }

        try:
            tree = ast.parse(source_code)
        except SyntaxError as exc:
            repaired = self._try_repair_missing_block(source_code, exc)
            if repaired is not None:
                try:
                    tree = ast.parse(repaired)
                except SyntaxError:
                    return {
                        "ok": False,
                        "error": "syntax_error",
                        "message": str(exc),
                        "lineno": getattr(exc, "lineno", None),
                        "offset": getattr(exc, "offset", None),
                        "text": getattr(exc, "text", None),
                    }
            else:
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

    def _try_repair_missing_block(self, source_code: str, exc: SyntaxError) -> Optional[str]:
        """Best-effort repair for empty def/class blocks.

        If Python code has `def ...:` or `class ...:` with no indented body, inject `pass`
        under the offending line so we can still generate a structural explanation.
        """
        message = str(exc).lower()
        if "expected an indented block after function definition" not in message and \
           "expected an indented block after class definition" not in message:
            return None

        lineno = getattr(exc, "lineno", None)
        if not isinstance(lineno, int) or lineno <= 0:
            return None

        lines = source_code.splitlines()
        candidate_idxs = [lineno - 1, lineno - 2]
        idx = None
        header = ""
        for candidate in candidate_idxs:
            if 0 <= candidate < len(lines):
                maybe_header = lines[candidate]
                # Guard: only repair def/class headers.
                if re.match(r"^\s*(def|class)\b.*:\s*(#.*)?$", maybe_header):
                    idx = candidate
                    header = maybe_header
                    break
        if idx is None:
            return None

        indent = len(header) - len(header.lstrip(" "))
        pass_line = (" " * (indent + 4)) + "pass"
        repaired_lines = lines[: idx + 1] + [pass_line] + lines[idx + 1 :]
        return "\n".join(repaired_lines) + ("\n" if source_code.endswith("\n") else "")

    # ---------------------------- Helpers ---------------------------------
    def _extract_body(self, body: List[ast.stmt]) -> List[Dict[str, Any]]:
        """Convert a sequence of AST statements into structured child nodes."""
        items: List[Dict[str, Any]] = []
        for node in body:
            handler = self._handler_for_node(node)
            if handler is not None:
                items.append(handler(node))
        return items

    def _handler_for_node(self, node: ast.AST):
        """Pick the serializer for a top-level statement, or ``None`` if ignored."""
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
        """Serialize a class definition including bases, decorators, and nested body."""
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
        """Serialize a function or async function including args, return type, and body."""
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
        """Flatten ``ast.arguments`` into JSON-friendly arg descriptors (incl. *args/**kwargs)."""

        def arg_to_dict(a: ast.arg, default: Optional[str] = None) -> Dict[str, Any]:
            """Serialize one parameter (name, optional type annotation, default repr)."""
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
        """Serialize assignment, annotated assignment, or augmented assignment."""
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
        """Serialize ``import`` or ``from ... import``."""
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
        """Best-effort end line for a node (Python 3.8+ ``end_lineno``)."""
        return getattr(node, "end_lineno", None)

    def _expr_to_str(self, expr: Optional[ast.AST]) -> Optional[str]:
        """Pretty-print an expression with ``ast.unparse``, falling back to a type name."""
        if expr is None:
            return None
        try:
            return ast.unparse(expr)  # type: ignore[attr-defined]
        except Exception:
            return expr.__class__.__name__

    def _target_to_str(self, target: ast.AST) -> str:
        """String form of an assignment target (name, attribute, subscript, etc.)."""
        try:
            return ast.unparse(target)  # type: ignore[attr-defined]
        except Exception:
            if isinstance(target, ast.Name):
                return target.id
            return target.__class__.__name__

    def _op_to_str(self, op: ast.AST) -> str:
        """Map a subset of aug-assign operators to a single-character symbol."""
        return op.__class__.__name__.replace("Add", "+").replace("Sub", "-")

