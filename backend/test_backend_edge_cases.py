"""Edge-case tests for backend parser and language router modules."""

import os
import sys
import unittest

# Ensure backend root is importable when pytest uses importlib collection mode.
sys.path.insert(0, os.path.dirname(__file__))

from model.lang_router import detect_language, parse_code
from model.parser_model import ParserModel
from service.repository_service import sanitize_data_flow_graph


class BackendEdgeCaseTests(unittest.TestCase):
    """Covers parser resilience and language inference fallbacks."""

    # Test 1: verify non-string input is rejected with a clear error payload.
    def test_parser_rejects_non_string_input(self):
        parser = ParserModel()
        result = parser.parse(None)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "invalid_input")

    # Test 2: verify syntax errors return structured details (line/offset/message).
    def test_parser_reports_syntax_error_details(self):
        parser = ParserModel()
        result = parser.parse("def broken(:\n    pass\n")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "syntax_error")
        self.assertIn("message", result)
        self.assertIsNotNone(result.get("lineno"))

    # Test 3: verify parser auto-repairs an empty function body by injecting pass.
    def test_parser_repairs_missing_function_block(self):
        parser = ParserModel()
        result = parser.parse("def hello():\n")
        self.assertTrue(result["ok"])
        self.assertEqual(result["tree"]["children"][0]["type"], "function")
        self.assertEqual(result["tree"]["children"][0]["name"], "hello")

    # Test 4: verify parser auto-repairs an empty class body by injecting pass.
    def test_parser_repairs_missing_class_block(self):
        parser = ParserModel()
        result = parser.parse("class Box:\n")
        self.assertTrue(result["ok"])
        self.assertEqual(result["tree"]["children"][0]["type"], "class")
        self.assertEqual(result["tree"]["children"][0]["name"], "Box")

    # Test 5: verify async function is tagged as async_function in parsed tree.
    def test_parser_marks_async_functions(self):
        parser = ParserModel()
        result = parser.parse("async def run(x):\n    return x\n")
        self.assertTrue(result["ok"])
        node = result["tree"]["children"][0]
        self.assertEqual(node["type"], "async_function")
        self.assertEqual(node["name"], "run")

    # Test 6: verify hints override filename/code heuristics during language detection.
    def test_detect_language_prefers_hint(self):
        code = "def main():\n    return 1\n"
        lang = detect_language(code, filename="file.java", hint="javascript")
        self.assertEqual(lang, "javascript")

    # Test 7: verify unsupported hint falls back to filename extension mapping.
    def test_detect_language_uses_filename_when_hint_unknown(self):
        code = "public class A { }"
        lang = detect_language(code, filename="Program.java", hint="unknown")
        self.assertEqual(lang, "java")

    # Test 8: verify cpp header extensions map to cpp parser language.
    def test_detect_language_handles_cpp_header_extension(self):
        code = "int add(int a, int b) { return a + b; }"
        lang = detect_language(code, filename="math.hpp")
        self.assertEqual(lang, "cpp")

    # Test 9: verify default fallback is python for ambiguous/plain text code.
    def test_detect_language_defaults_to_python_for_ambiguous_code(self):
        lang = detect_language("just some words without syntax markers")
        self.assertEqual(lang, "python")

    # Test 10: verify parse_code annotates returned tree with inferred language.
    def test_parse_code_adds_language_annotation(self):
        result = parse_code("function greet(){ return 1; }", filename="app.js")
        self.assertTrue(result["ok"])
        self.assertEqual(result["tree"]["language"], "javascript")

    def test_sanitize_data_flow_graph_keeps_valid_nodes_and_links(self):
        raw = {
            "nodes": [
                {"id": "web_ui", "label": "Browser UI", "group": "entry"},
                {"id": "api_layer", "label": "HTTP API", "group": "api"},
                {"id": "bad_group", "label": "X", "group": "not_a_real_group"},
            ],
            "links": [
                {"source": "web_ui", "target": "api_layer", "label": "JSON"},
                {"source": "missing", "target": "api_layer", "label": "skip"},
            ],
        }
        out = sanitize_data_flow_graph(raw)
        self.assertEqual(len(out["nodes"]), 3)
        self.assertEqual(out["nodes"][2]["group"], "other")
        self.assertEqual(len(out["links"]), 1)
        self.assertEqual(out["links"][0]["source"], "web_ui")


if __name__ == "__main__":
    unittest.main()
