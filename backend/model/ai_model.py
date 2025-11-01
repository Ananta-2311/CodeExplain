import os
import time
import json
from typing import Any, Dict, List, Optional
from collections import deque
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class RateLimiter:
    """Simple token bucket rate limiter for API calls."""

    def __init__(self, max_calls: int = 60, time_window: float = 60.0):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = deque()

    def acquire(self) -> bool:
        """Check if a call is allowed and record it."""
        now = time.time()
        # Remove calls outside the time window
        while self.calls and self.calls[0] < now - self.time_window:
            self.calls.popleft()
        # Check if we're at the limit
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

        # Check rate limiting
        if not self.rate_limiter.acquire():
            wait = self.rate_limiter.wait_time()
            return {
                "ok": False,
                "error": "rate_limit_exceeded",
                "message": f"Rate limit exceeded. Please wait {wait:.1f} seconds.",
            }

        try:
            # Prepare context from AST
            ast_json = json.dumps(ast_data["tree"], indent=2)
            context_parts = self._prepare_context(ast_json, source_code)

            # Generate explanation
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

        # Estimate tokens for AST (rough: 4 chars = 1 token)
        ast_tokens = len(ast_json) // 4
        code_tokens = len(source_code) // 4 if source_code else 0

        # If total fits, send together
        total_tokens = (
            len(base_prompt) // 4 + ast_tokens + (len(source_code) if source_code else 0) // 4
        )

        if total_tokens <= self.max_context_tokens:
            context_text = base_prompt + ast_json
            if source_code:
                context_text += f"\n\nOriginal source code:\n\n```python\n{source_code}\n```"
            chunks.append({"role": "user", "content": context_text})
        else:
            # Chunk the AST if needed
            if ast_tokens > self.max_context_tokens:
                # Split AST JSON by top-level items
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

            # Build context
            context = f"Here is a {node_type} named '{node_name}' from Python code:\n\n{node_json}"
            if source_code:
                # Try to extract relevant code section if we have line numbers
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

