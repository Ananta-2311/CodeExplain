import re
from typing import Any, Dict, List, Optional


class JavaParserModel:
    """Naive Java parser to extract classes and methods via regex.
    Intended for demo purposes and small snippets.
    """

    CLASS_RE = re.compile(r"^\s*(public\s+|private\s+|protected\s+)?(final\s+|abstract\s+)?class\s+(?P<name>[A-Za-z_][\w]*)", re.MULTILINE)
    INTERFACE_RE = re.compile(r"^\s*(public\s+|private\s+|protected\s+)?interface\s+(?P<name>[A-Za-z_][\w]*)", re.MULTILINE)
    METHOD_RE = re.compile(r"^\s*(public|private|protected)?\s*(static\s+)?[\w\<\>\[\]]+\s+(?P<name>[A-Za-z_][\w]*)\s*\((?P<args>[^)]*)\)\s*\{", re.MULTILINE)

    def parse(self, source_code: Optional[str]) -> Dict[str, Any]:
        if not isinstance(source_code, str):
            return {"ok": False, "error": "invalid_input", "message": "source_code must be a string"}

        items: List[Dict[str, Any]] = []

        for m in self.CLASS_RE.finditer(source_code):
            name = m.group("name")
            start = source_code.count("\n", 0, m.start()) + 1
            items.append({
                "type": "class",
                "name": name,
                "bases": [],
                "decorators": [],
                "start": start,
                "end": None,
                "children": [],
            })

        for m in self.INTERFACE_RE.finditer(source_code):
            name = m.group("name")
            start = source_code.count("\n", 0, m.start()) + 1
            items.append({
                "type": "class",
                "name": name,
                "bases": [],
                "decorators": [],
                "start": start,
                "end": None,
                "children": [],
            })

        def parse_args(arg_str: str) -> List[Dict[str, Any]]:
            args = []
            if not arg_str:
                return args
            for a in [x.strip() for x in arg_str.split(',') if x.strip()]:
                # Java args like: int x, String y
                parts = a.split()
                arg_name = parts[-1] if parts else a
                args.append({"name": arg_name, "annotation": None, "default": None})
            return args

        for m in self.METHOD_RE.finditer(source_code):
            name = m.group("name")
            args = parse_args(m.group("args") or "")
            start = source_code.count("\n", 0, m.start()) + 1
            items.append({
                "type": "function",
                "name": name,
                "args": args,
                "returns": None,
                "decorators": [],
                "start": start,
                "end": None,
                "children": [],
            })

        return {
            "ok": True,
            "tree": {
                "type": "module",
                "name": None,
                "start": 1,
                "end": None,
                "children": items,
            },
        }
