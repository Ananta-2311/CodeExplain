import re
from typing import Any, Dict, List, Optional


class JSParserModel:
    """Naive JavaScript parser to extract classes and functions.

    This is a lightweight, regex-based parser intended for UI demo purposes.
    It returns a JSON-serializable structure compatible with the Python ParserModel output.
    """

    CLASS_RE = re.compile(r"^\s*class\s+(?P<name>[A-Za-z_\$][\w\$]*)", re.MULTILINE)
    FUNC_RE = re.compile(r"^\s*function\s+(?P<name>[A-Za-z_\$][\w\$]*)\s*\((?P<args>[^)]*)\)", re.MULTILINE)
    # const foo = () => {}, const foo = function()
    ASSIGNED_FUNC_RE = re.compile(r"^\s*(?:const|let|var)\s+(?P<name>[A-Za-z_\$][\w\$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\s*\((?P<args2>[^)]*)\))", re.MULTILINE)

    def parse(self, source_code: Optional[str]) -> Dict[str, Any]:
        if not isinstance(source_code, str):
            return {"ok": False, "error": "invalid_input", "message": "source_code must be a string"}

        classes: List[Dict[str, Any]] = []
        functions: List[Dict[str, Any]] = []

        for m in self.CLASS_RE.finditer(source_code):
            name = m.group("name")
            start = source_code.count("\n", 0, m.start()) + 1
            classes.append({
                "type": "class",
                "name": name,
                "start": start,
                "end": None,
                "children": [],
                "bases": [],
                "decorators": [],
            })

        def parse_args(arg_str: str) -> List[Dict[str, Any]]:
            args = []
            if not arg_str:
                return args
            for a in [x.strip() for x in arg_str.split(',') if x.strip()]:
                args.append({"name": a, "annotation": None, "default": None})
            return args

        for m in self.FUNC_RE.finditer(source_code):
            name = m.group("name")
            args = parse_args(m.group("args") or "")
            start = source_code.count("\n", 0, m.start()) + 1
            functions.append({
                "type": "function",
                "name": name,
                "args": args,
                "returns": None,
                "decorators": [],
                "start": start,
                "end": None,
                "children": [],
            })

        for m in self.ASSIGNED_FUNC_RE.finditer(source_code):
            name = m.group("name")
            args2 = m.group("args2") or ""
            args = parse_args(args2)
            start = source_code.count("\n", 0, m.start()) + 1
            functions.append({
                "type": "function",
                "name": name,
                "args": args,
                "returns": None,
                "decorators": [],
                "start": start,
                "end": None,
                "children": [],
            })

        module_children: List[Dict[str, Any]] = classes + functions

        return {
            "ok": True,
            "tree": {
                "type": "module",
                "name": None,
                "start": 1,
                "end": None,
                "children": module_children,
            },
        }
