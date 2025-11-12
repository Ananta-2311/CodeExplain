import re
from typing import Any, Dict, List, Optional


class CppParserModel:
    """Naive C++ parser to extract classes, structs, and functions via regex.
    Intended for demo purposes and small snippets.
    """

    CLASS_RE = re.compile(r"^\s*(public\s+|private\s+|protected\s+)?class\s+(?P<name>[A-Za-z_][\w]*)", re.MULTILINE)
    STRUCT_RE = re.compile(r"^\s*(public\s+|private\s+|protected\s+)?struct\s+(?P<name>[A-Za-z_][\w]*)", re.MULTILINE)
    # Match function definitions: return_type function_name(args) { or return_type function_name(args);
    FUNCTION_RE = re.compile(r"^\s*(?:inline\s+|static\s+|virtual\s+|const\s+)*[\w\<\>\[\]\s&*]+\s+(?P<name>[A-Za-z_][\w]*)\s*\((?P<args>[^)]*)\)\s*(?:const\s*)?\{?", re.MULTILINE)
    # Match namespace declarations
    NAMESPACE_RE = re.compile(r"^\s*namespace\s+(?P<name>[A-Za-z_][\w]*)", re.MULTILINE)

    def parse(self, source_code: Optional[str]) -> Dict[str, Any]:
        if not isinstance(source_code, str):
            return {"ok": False, "error": "invalid_input", "message": "source_code must be a string"}

        items: List[Dict[str, Any]] = []

        # Parse classes
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

        # Parse structs (treat as classes)
        for m in self.STRUCT_RE.finditer(source_code):
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
                if '=' in a:
                    a = a.split('=')[0].strip()
                parts = a.split()
                arg_name = parts[-1] if parts else a
                arg_name = arg_name.rstrip('&*')
                args.append({"name": arg_name, "annotation": None, "default": None})
            return args

        # Parse functions
        for m in self.FUNCTION_RE.finditer(source_code):
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

        # Parse namespaces (treat as modules/containers)
        for m in self.NAMESPACE_RE.finditer(source_code):
            name = m.group("name")
            start = source_code.count("\n", 0, m.start()) + 1
            items.append({
                "type": "class",  # Treat namespace as a container like class
                "name": f"namespace {name}",
                "bases": [],
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

