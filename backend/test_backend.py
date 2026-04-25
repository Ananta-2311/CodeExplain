"""
Single backend test module for CodeMuse.

Includes:
  * Parser and language-router unit tests
  * Repository data-flow sanitization and in-memory ORM cascade delete
  * Optional HTTP integration suite against a running API (``--live-api``)

The ``BackendEdgeCaseTests`` class holds fast, offline assertions. Functions
prefixed with ``_integration_test_`` are invoked only by
``run_live_api_integration_suite()`` when you pass ``--live-api`` to this file.

Colored terminal output (install dev deps once: ``pip install -r requirements-dev.txt``)::

    cd backend && pytest test_backend.py -v

Plain unittest (no colors)::

    cd backend && python -m unittest test_backend -v

Run live API checks (server on http://localhost:8000)::

    cd backend && python test_backend.py --live-api
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from model.history_model import Base
from model.lang_router import detect_language, parse_code
from model.parser_model import ParserModel
from model.repository_model import (  # noqa: F401 — registers ORM tables on Base.metadata
    Repository,
    RepositoryChatMessage,
    RepositoryChunk,
    RepositoryFile,
)
from service.repository_service import sanitize_data_flow_graph


class BackendEdgeCaseTests(unittest.TestCase):
    """Offline unit tests: parser, ``detect_language``/``parse_code``, data-flow sanitize, ORM cascade."""

    def test_parser_rejects_non_string_input(self):
        parser = ParserModel()
        result = parser.parse(None)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "invalid_input")

    def test_parser_reports_syntax_error_details(self):
        parser = ParserModel()
        result = parser.parse("def broken(:\n    pass\n")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "syntax_error")
        self.assertIn("message", result)
        self.assertIsNotNone(result.get("lineno"))

    def test_parser_repairs_missing_function_block(self):
        parser = ParserModel()
        result = parser.parse("def hello():\n")
        self.assertTrue(result["ok"])
        self.assertEqual(result["tree"]["children"][0]["type"], "function")
        self.assertEqual(result["tree"]["children"][0]["name"], "hello")

    def test_parser_repairs_missing_class_block(self):
        parser = ParserModel()
        result = parser.parse("class Box:\n")
        self.assertTrue(result["ok"])
        self.assertEqual(result["tree"]["children"][0]["type"], "class")
        self.assertEqual(result["tree"]["children"][0]["name"], "Box")

    def test_parser_marks_async_functions(self):
        parser = ParserModel()
        result = parser.parse("async def run(x):\n    return x\n")
        self.assertTrue(result["ok"])
        node = result["tree"]["children"][0]
        self.assertEqual(node["type"], "async_function")
        self.assertEqual(node["name"], "run")

    def test_detect_language_prefers_hint(self):
        code = "def main():\n    return 1\n"
        lang = detect_language(code, filename="file.java", hint="javascript")
        self.assertEqual(lang, "javascript")

    def test_detect_language_uses_filename_when_hint_unknown(self):
        code = "public class A { }"
        lang = detect_language(code, filename="Program.java", hint="unknown")
        self.assertEqual(lang, "java")

    def test_detect_language_handles_cpp_header_extension(self):
        code = "int add(int a, int b) { return a + b; }"
        lang = detect_language(code, filename="math.hpp")
        self.assertEqual(lang, "cpp")

    def test_detect_language_defaults_to_python_for_ambiguous_code(self):
        lang = detect_language("just some words without syntax markers")
        self.assertEqual(lang, "python")

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

    def test_sanitize_data_flow_graph_returns_empty_for_non_object(self):
        self.assertEqual(sanitize_data_flow_graph(None)["nodes"], [])
        self.assertEqual(sanitize_data_flow_graph("x")["links"], [])
        self.assertEqual(sanitize_data_flow_graph([1, 2])["nodes"], [])

    def test_sanitize_data_flow_graph_drops_self_loops_and_unknown_endpoints(self):
        raw = {
            "nodes": [
                {"id": "only", "label": "Single", "group": "service"},
            ],
            "links": [
                {"source": "only", "target": "only", "label": "loop"},
                {"source": "ghost", "target": "only", "label": "bad"},
            ],
        }
        out = sanitize_data_flow_graph(raw)
        self.assertEqual(len(out["nodes"]), 1)
        self.assertEqual(out["links"], [])

    def test_delete_repository_cascades_files_chunks_and_messages(self):
        engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        repo_id = str(uuid.uuid4())

        with Session() as db:
            r = Repository(
                id=repo_id,
                name="tmp-repo",
                file_tree_json="[]",
                overview_text=None,
                data_flow_graph_json=None,
            )
            db.add(r)
            db.flush()
            rf = RepositoryFile(repo_id=repo_id, path="app.py", content="print(1)")
            db.add(rf)
            db.flush()
            db.add(
                RepositoryChunk(
                    repo_id=repo_id,
                    file_id=rf.id,
                    chunk_index=0,
                    start_line=1,
                    end_line=1,
                    content="x",
                )
            )
            db.add(RepositoryChatMessage(repo_id=repo_id, role="user", content="hi"))
            db.commit()

        with Session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            self.assertIsNotNone(r)
            db.delete(r)
            db.commit()

        with Session() as db:
            self.assertIsNone(db.query(Repository).filter(Repository.id == repo_id).first())
            self.assertEqual(db.query(RepositoryFile).filter(RepositoryFile.repo_id == repo_id).count(), 0)
            self.assertEqual(db.query(RepositoryChunk).filter(RepositoryChunk.repo_id == repo_id).count(), 0)
            self.assertEqual(
                db.query(RepositoryChatMessage).filter(RepositoryChatMessage.repo_id == repo_id).count(),
                0,
            )


# --- Optional HTTP integration (requires running uvicorn on localhost:8000) ---

LIVE_API_BASE = os.getenv("CODEEXPLAIN_TEST_API_URL", "http://localhost:8000")

_INTEGRATION_TEST_CODE = """
def calculate_factorial(n):
    if n <= 1:
        return 1
    return n * calculate_factorial(n - 1)

class MathUtils:
    def __init__(self):
        self.pi = 3.14159

    def area_circle(self, radius):
        return self.pi * radius ** 2

if __name__ == "__main__":
    print(calculate_factorial(5))
    utils = MathUtils()
    print(utils.area_circle(10))
"""


def _integration_test_health():
    """Assert ``GET /health`` returns 200 and ``{"status": "ok"}``."""
    import requests

    r = requests.get(f"{LIVE_API_BASE}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def _integration_test_explain():
    """POST sample code to ``/explain`` and assert overview + explanations exist."""
    import requests

    r = requests.post(
        f"{LIVE_API_BASE}/explain",
        json={
            "code": _INTEGRATION_TEST_CODE,
            "detail_level": "detailed",
            "organize_by_structure": True,
        },
        timeout=120,
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert "overview" in data
    assert "explanations" in data
    return data


def _integration_test_visualize():
    """POST sample code to ``/visualize`` and assert a graph with nodes and links."""
    import requests

    r = requests.post(f"{LIVE_API_BASE}/visualize", json={"code": _INTEGRATION_TEST_CODE}, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert "nodes" in data["graph"]
    assert "links" in data["graph"]
    return data


def _integration_test_suggestions():
    """POST sample code to ``/suggestions`` and assert a suggestions payload."""
    import requests

    r = requests.post(f"{LIVE_API_BASE}/suggestions", json={"code": _INTEGRATION_TEST_CODE}, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data.get("ok") is True
    assert "suggestions" in data
    return data


def _integration_test_history():
    """Exercise explain → save history → list → get by id for the sample snippet."""
    import requests

    explain_response = requests.post(
        f"{LIVE_API_BASE}/explain",
        json={
            "code": _INTEGRATION_TEST_CODE,
            "detail_level": "summary",
            "organize_by_structure": True,
        },
        timeout=120,
    )
    explain_data = explain_response.json()
    save_response = requests.post(
        f"{LIVE_API_BASE}/history",
        json={
            "code": _INTEGRATION_TEST_CODE,
            "response": explain_data,
            "title": "Test Session",
        },
        timeout=30,
    )
    assert save_response.status_code == 200
    saved_item = save_response.json()
    history_id = saved_item["id"]

    list_response = requests.get(f"{LIVE_API_BASE}/history", timeout=30)
    assert list_response.status_code == 200
    history_list = list_response.json()
    assert len(history_list) > 0

    get_response = requests.get(f"{LIVE_API_BASE}/history/{history_id}", timeout=30)
    assert get_response.status_code == 200
    history_detail = get_response.json()
    assert history_detail["code"] == _INTEGRATION_TEST_CODE
    return history_id


def _integration_test_settings():
    """POST settings for ``test_user`` then GET them back and assert theme round-trip."""
    import requests

    save_response = requests.post(
        f"{LIVE_API_BASE}/settings",
        json={
            "user_id": "test_user",
            "theme": "dark",
            "fontSize": 16,
            "language": "python",
            "editorTheme": "vscDarkPlus",
        },
        timeout=30,
    )
    assert save_response.status_code == 200
    saved_settings = save_response.json()
    assert saved_settings["theme"] == "dark"

    get_response = requests.get(f"{LIVE_API_BASE}/settings/test_user", timeout=30)
    assert get_response.status_code == 200
    retrieved_settings = get_response.json()
    assert retrieved_settings["theme"] == "dark"


def run_live_api_integration_suite() -> None:
    """Sequentially run all ``_integration_test_*`` helpers; print progress or exit non-zero on failure."""
    import requests

    print("=" * 60)
    print("CodeMuse live API integration")
    print("Base URL:", LIVE_API_BASE)
    print("=" * 60)
    try:
        _integration_test_health()
        print("✓ /health")
        _integration_test_explain()
        print("✓ /explain")
        _integration_test_visualize()
        print("✓ /visualize")
        _integration_test_suggestions()
        print("✓ /suggestions")
        _integration_test_history()
        print("✓ /history")
        _integration_test_settings()
        print("✓ /settings")
        print("=" * 60)
        print("All live API checks passed.")
        print("=" * 60)
    except requests.exceptions.ConnectionError:
        print("Could not connect. Start the API, e.g.: uvicorn main:app --reload")
        raise SystemExit(1) from None
    except AssertionError as e:
        print("Assertion failed:", e)
        raise SystemExit(1) from None


if __name__ == "__main__":
    if "--live-api" in sys.argv:
        sys.argv = [a for a in sys.argv if a != "--live-api"]
        run_live_api_integration_suite()
    else:
        unittest.main()
