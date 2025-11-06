from __future__ import annotations

import re
from typing import Any, Dict, Optional, Tuple

from model.parser_model import ParserModel as PythonParserModel
from model.js_parser_model import JSParserModel
from model.java_parser_model import JavaParserModel


def detect_language(source_code: str, filename: Optional[str] = None, hint: Optional[str] = None) -> str:
    if hint:
        h = hint.strip().lower()
        if h in ("py", "python"): return "python"
        if h in ("js", "javascript", "node"): return "javascript"
        if h in ("java",): return "java"

    if filename:
        fn = filename.lower()
        if fn.endswith('.py'): return "python"
        if fn.endswith('.js') or fn.endswith('.mjs') or fn.endswith('.cjs') or fn.endswith('.ts'): return "javascript"
        if fn.endswith('.java'): return "java"

    # Token heuristics
    code = source_code[:1000]
    if re.search(r"\bdef\s+\w+\s*\(", code) or re.search(r"\bclass\s+\w+\s*:\s*", code):
        return "python"
    if re.search(r"\bfunction\s+\w+\s*\(", code) or re.search(r"=>\s*\{?", code) or re.search(r"\bclass\s+\w+\s*\{", code):
        return "javascript"
    if re.search(r"\bpublic\s+(class|interface)\b", code) or re.search(r"\bstatic\s+void\s+main\b", code):
        return "java"

    return "python"


def get_parser(lang: str):
    lang = (lang or "python").lower()
    if lang == "python":
        return PythonParserModel()
    if lang == "javascript":
        return JSParserModel()
    if lang == "java":
        return JavaParserModel()
    return PythonParserModel()


def parse_code(source_code: str, filename: Optional[str] = None, hint: Optional[str] = None) -> Dict[str, Any]:
    lang = detect_language(source_code, filename, hint)
    parser = get_parser(lang)
    result = parser.parse(source_code)
    # annotate language
    if isinstance(result, dict) and result.get("ok") and isinstance(result.get("tree"), dict):
        result["tree"]["language"] = lang
    return result
