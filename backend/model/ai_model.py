"""OpenAI client wrapper, rate limiting, and prompt helpers for explanations."""

import os
import time
import json
from typing import Any, Dict, List, Optional
from collections import deque
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class RateLimiter:
    """Simple token bucket rate limiter for API calls."""

    def __init__(self, max_calls: int = 60, time_window: float = 60.0):
        """Configure max calls allowed per rolling ``time_window`` (seconds)."""
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = deque()

    def acquire(self) -> bool:
        """Check if a call is allowed and record it."""
        now = time.time()
        while self.calls and self.calls[0] < now - self.time_window:
            self.calls.popleft()
        if len(self.calls) >= self.max_calls:
            return False
        self.calls.append(now)
        return True

    def wait_time(self) -> float:
        """Return seconds until the next call is allowed."""
        if len(self.calls) < self.max_calls:
            return 0.0
        oldest = self.calls[0]
        return self.time_window - (time.time() - oldest)


class AIModel:
    """OpenAI integration for generating code explanations from AST data."""

    def __init__(self):
        """Load API credentials from the environment and construct an ``OpenAI`` client."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENAI_API_KEY environment variable is not set. "
                "Please set it in a .env file or environment."
            )
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.rate_limiter = RateLimiter(max_calls=60, time_window=60.0)
        # Rough token estimation: 1 token ≈ 4 characters
        self.max_tokens_per_request = int(os.getenv("MAX_TOKENS_PER_REQUEST", "8000"))
        self.max_context_tokens = int(os.getenv("MAX_CONTEXT_TOKENS", "16000"))

    def explain_code(
        self,
        ast_data: Dict[str, Any],
        source_code: Optional[str] = None,
        detail_level: str = "summary",
    ) -> Dict[str, Any]:
        """Generate code explanation from structured AST data.

        Args:
            ast_data: Output from ParserModel.parse()
            source_code: Optional original source code for context
            detail_level: "summary" (one-line), "brief" (paragraph), or "detailed" (full)

        Returns:
            Dict with "ok", "explanation", and optional "error" fields
        """
        if not ast_data.get("ok"):
            return {
                "ok": False,
                "error": "invalid_ast",
                "message": "AST parsing failed",
                "details": ast_data,
            }

        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }

        try:
            ast_json = json.dumps(ast_data["tree"], indent=2)
            context_parts = self._prepare_context(ast_json, source_code)
            explanation = self._generate_explanation(context_parts, detail_level)

            return {"ok": True, "explanation": explanation}

        except Exception as exc:
            return {
                "ok": False,
                "error": "generation_failed",
                "message": str(exc),
            }

    def _prepare_context(
        self, ast_json: str, source_code: Optional[str]
    ) -> List[Dict[str, str]]:
        """Prepare context chunks, splitting if too large."""
        chunks: List[Dict[str, str]] = []
        base_prompt = "Here is the AST structure of Python code:\n\n"

        ast_tokens = len(ast_json) // 4
        code_tokens = len(source_code) // 4 if source_code else 0

        total_tokens = (
            len(base_prompt) // 4 + ast_tokens + (len(source_code) if source_code else 0) // 4
        )

        if total_tokens <= self.max_context_tokens:
            context_text = base_prompt + ast_json
            if source_code:
                context_text += f"\n\nOriginal source code:\n\n```python\n{source_code}\n```"
            chunks.append({"role": "user", "content": context_text})
        else:
            if ast_tokens > self.max_context_tokens:
                ast_obj = json.loads(ast_json)
                children = ast_obj.get("children", [])
                chunk_size = max(1, len(children) // (
                    (ast_tokens // self.max_context_tokens) + 1
                ))

                for i in range(0, len(children), chunk_size):
                    chunk_obj = {
                        "type": ast_obj["type"],
                        "children": children[i : i + chunk_size],
                    }
                    chunk_text = base_prompt + json.dumps(chunk_obj, indent=2)
                    chunks.append({"role": "user", "content": chunk_text})
            else:
                chunks.append({"role": "user", "content": base_prompt + ast_json})

        return chunks

    def _generate_explanation(
        self, context_parts: List[Dict[str, str]], detail_level: str
    ) -> str:
        """Generate explanation using OpenAI API."""
        detail_instructions = {
            "summary": "Provide a one-line summary of what this code does.",
            "brief": "Provide a brief paragraph explanation (2-3 sentences) of the code structure and purpose.",
            "detailed": "Provide a detailed explanation including: purpose, structure breakdown, key components, and any notable patterns.",
        }
        instruction = detail_instructions.get(detail_level, detail_instructions["summary"])

        system_prompt = (
            "You are a code explanation assistant. "
            "Given the AST (Abstract Syntax Tree) structure of Python code, "
            f"{instruction} "
            "Be concise and technical."
        )

        messages = [{"role": "system", "content": system_prompt}] + context_parts

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=min(self.max_tokens_per_request, 1000 if detail_level == "summary" else 2000),
            temperature=0.3,
        )

        return response.choices[0].message.content.strip()

    def explain_ast_node(
        self,
        node: Dict[str, Any],
        source_code: Optional[str] = None,
        detail_level: str = "summary",
    ) -> Dict[str, Any]:
        """Generate explanation for a single AST node (class, function, etc.).

        Args:
            node: Single AST node dict (from parser)
            source_code: Optional original source code for context
            detail_level: "summary", "brief", or "detailed"

        Returns:
            Dict with "ok", "explanation", and optional "error" fields
        """
        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }

        try:
            node_json = json.dumps(node, indent=2)
            node_type = node.get("type", "unknown")
            node_name = node.get("name", "unnamed")

            context = f"Here is a {node_type} named '{node_name}' from Python code:\n\n{node_json}"
            if source_code:
                start_line = node.get("start")
                end_line = node.get("end")
                if start_line and end_line and source_code:
                    lines = source_code.split("\n")
                    relevant_code = "\n".join(lines[start_line - 1 : end_line])
                    context += f"\n\nRelevant source code:\n\n```python\n{relevant_code}\n```"

            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are a code explanation assistant. "
                        f"Explain this {node_type} in technical detail. "
                        f"Focus on what it does, its parameters/attributes, and its purpose."
                    ),
                },
                {"role": "user", "content": context},
            ]

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=min(self.max_tokens_per_request, 500 if detail_level == "summary" else 1000),
                temperature=0.3,
            )

            return {"ok": True, "explanation": response.choices[0].message.content.strip()}

        except Exception as exc:
            return {
                "ok": False,
                "error": "generation_failed",
                "message": str(exc),
            }

    def generate_project_overview(self, repo_context: str) -> Dict[str, Any]:
        """Produce a structured markdown overview from repository file excerpts."""
        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }
        if not repo_context.strip():
            return {"ok": False, "error": "empty_context", "message": "No repository context provided."}

        system = (
            "You are a senior software architect. Given excerpts from repository files, "
            "write a clear project overview in Markdown with these sections exactly:\n"
            "## Project summary\n## Main purpose\n## Architecture overview\n"
            "## Important folders and files\n## Key modules\n## How files connect\n"
            "## Main entry points\n## Technologies detected\n## Beginner-friendly explanation\n"
            "Ground every claim in the provided excerpts. If unknown, say so briefly."
        )
        user = f"Repository excerpts:\n\n{repo_context}"

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=min(self.max_tokens_per_request, 3500),
                temperature=0.35,
            )
            text = response.choices[0].message.content.strip()
            return {"ok": True, "overview": text}
        except Exception as exc:
            return {"ok": False, "error": "generation_failed", "message": str(exc)}

    def summarize_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Short natural-language summary of a single file."""
        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }
        snippet = content[:8000]
        system = "You summarize source files in 2–4 sentences for a developer."
        user = f"File: {file_path}\n\n```\n{snippet}\n```"
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=400,
                temperature=0.25,
            )
            return {"ok": True, "summary": response.choices[0].message.content.strip()}
        except Exception as exc:
            return {"ok": False, "error": "generation_failed", "message": str(exc)}

    def answer_repo_question(
        self,
        question: str,
        relevant_context: str,
        chat_history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """Answer using repository excerpts; prefers JSON with answer and referenced_files."""
        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }

        system = (
            "You are an expert code assistant. Answer ONLY using the repository context provided. "
            "If the context is insufficient, say what is missing. Cite concrete file paths when you "
            "refer to code (backtick paths like `src/app.py`). "
            "Respond with a single JSON object (no markdown fences) with keys: "
            '"answer" (string, markdown allowed inside the string), '
            '"referenced_files" (array of strings, repo-relative paths you relied on).'
        )
        ctx = f"Repository context:\n\n{relevant_context}\n\nQuestion:\n{question}"

        messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
        for turn in chat_history[-24:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role not in ("user", "assistant") or not content:
                continue
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": ctx})

        try:
            kwargs: Dict[str, Any] = {
                "model": self.model,
                "messages": messages,
                "max_tokens": min(self.max_tokens_per_request, 2500),
                "temperature": 0.25,
            }
            try:
                response = self.client.chat.completions.create(
                    **kwargs, response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(**kwargs)

            raw = response.choices[0].message.content.strip()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return {"ok": True, "answer": raw, "referenced_files": []}

            answer = str(data.get("answer", "")).strip()
            refs = data.get("referenced_files") or []
            if not isinstance(refs, list):
                refs = []
            refs = [str(x) for x in refs if isinstance(x, (str, int, float))]
            if not answer:
                answer = raw
            return {"ok": True, "answer": answer, "referenced_files": refs}
        except Exception as exc:
            return {"ok": False, "error": "generation_failed", "message": str(exc)}

