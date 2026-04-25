"""Safe zip extraction, path filtering, chunking, and keyword retrieval for repositories.

Reads uploaded zip bytes, rejects unsafe paths and oversized members, extracts
allowed text files, builds a nested file tree, splits content into overlapping
chunks for search, and normalizes AI-produced data-flow graphs. Used by
``repository_controller`` for upload, chat context, overview, and data-flow
endpoints. Limits are tunable via ``REPO_*`` environment variables.
"""

from __future__ import annotations

import io
import json
import os
import re
import uuid
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

# Limits (override via env if needed)
MAX_ZIP_BYTES = int(os.getenv("REPO_MAX_ZIP_BYTES", str(300 * 1024 * 1024)))  # 300 MB default
# Sum of member uncompressed sizes (zip metadata); allow headroom above max zip size
MAX_UNCOMPRESSED_BYTES = int(os.getenv("REPO_MAX_UNCOMPRESSED_BYTES", str(2 * 1024 * 1024 * 1024)))
MAX_SINGLE_FILE_BYTES = int(os.getenv("REPO_MAX_SINGLE_FILE_BYTES", str(512 * 1024)))  # 512 KB text
PACKAGE_LOCK_SKIP_BYTES = int(os.getenv("REPO_PACKAGE_LOCK_MAX_BYTES", str(1024 * 1024)))  # 1 MB
CHUNK_CHARS = int(os.getenv("REPO_CHUNK_CHARS", "1800"))
CHUNK_OVERLAP = int(os.getenv("REPO_CHUNK_OVERLAP", "200"))
OVERVIEW_FILE_SNIPPET = int(os.getenv("REPO_OVERVIEW_SNIPPET_CHARS", "1200"))
OVERVIEW_MAX_FILES = int(os.getenv("REPO_OVERVIEW_MAX_FILES", "45"))

SKIP_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".git",
        "__pycache__",
        ".venv",
        "venv",
        "dist",
        "build",
        ".next",
        ".turbo",
        "coverage",
        ".idea",
        ".vscode",
    }
)

SKIP_FILE_NAMES = frozenset({".env", ".env.local", ".env.production"})

ALLOWED_SUFFIXES = frozenset(
    {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".hpp",
        ".html",
        ".css",
        ".json",
        ".md",
        ".txt",
        ".yml",
        ".yaml",
    }
)

BINARY_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ico",
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".wasm",
        ".so",
        ".dylib",
        ".dll",
        ".exe",
        ".bin",
        ".mp4",
        ".mp3",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
    }
)


@dataclass
class ExtractedFile:
    """One text file extracted from an archive (repository-relative path + body)."""

    rel_path: str
    content: str


def _is_safe_zip_entry(name: str) -> bool:
    """Reject absolute paths, empty names, and path traversal."""
    if not name or name.startswith("/"):
        return False
    parts = Path(name.replace("\\", "/")).parts
    if ".." in parts:
        return False
    return True


def _should_skip_path(rel: Path) -> bool:
    """Return True if path hits skip-dir names, secret filenames, or disallowed/binary extensions."""
    parts_lower = [p.lower() for p in rel.parts]
    for p in parts_lower:
        if p in SKIP_DIR_NAMES:
            return True
    name = rel.name.lower()
    if name in SKIP_FILE_NAMES:
        return True
    suf = rel.suffix.lower()
    if suf in BINARY_EXTENSIONS:
        return True
    if suf and suf not in ALLOWED_SUFFIXES:
        return True
    return False


def _read_text_safe(raw: bytes) -> Optional[str]:
    """Decode as UTF-8; skip if not plausible text."""
    if not raw:
        return ""
    if b"\x00" in raw[:8192]:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return raw.decode("utf-8", errors="replace")
        except Exception:
            return None


def _chunk_lines(content: str, chunk_chars: int, overlap: int) -> List[Tuple[int, int, str]]:
    """Return list of (start_line, end_line, chunk_text) covering the file."""
    lines = content.splitlines()
    if not lines:
        return [(1, 1, "")]
    chunks: List[Tuple[int, int, str]] = []
    text = content
    if len(text) <= chunk_chars:
        return [(1, len(lines), text)]

    start_char = 0
    n = len(text)
    while start_char < n:
        end_char = min(start_char + chunk_chars, n)
        piece = text[start_char:end_char]
        # line numbers from original content
        prefix = text[:start_char]
        start_line = prefix.count("\n") + 1
        end_line = start_line + piece.count("\n")
        chunks.append((start_line, end_line, piece))
        if end_char >= n:
            break
        start_char = max(0, end_char - overlap)
    return chunks


def build_file_tree(paths: Iterable[str]) -> List[Dict[str, Any]]:
    """Build nested list of ``{name, type, children?}`` from posix-style file paths."""

    norm = sorted({p.replace("\\", "/").strip("/") for p in paths if p and p.strip("/")})

    def children_of(prefix: str) -> List[Dict[str, Any]]:
        """Build one directory level of tree nodes (files and subdirs) under ``prefix``."""
        pref = f"{prefix}/" if prefix else ""
        next_level: Dict[str, str] = {}
        for p in norm:
            if prefix and not (p == prefix or p.startswith(pref)):
                continue
            if not prefix and "/" not in p:
                next_level[p] = "file"
                continue
            rest = p[len(pref) :] if pref else p
            if "/" in rest:
                dirname = rest.split("/", 1)[0]
                next_level.setdefault(dirname, "dir")
            else:
                if pref or prefix == "":
                    # file at this level
                    next_level[rest] = "file"

        # When prefix is "", we already added top-level files. Dirs from nested paths:
        if not prefix:
            for p in norm:
                if "/" in p:
                    dirname = p.split("/", 1)[0]
                    next_level.setdefault(dirname, "dir")

        items: List[Dict[str, Any]] = []
        for name in sorted(next_level.keys(), key=lambda x: (next_level[x] == "file", x.lower())):
            typ = next_level[name]
            if typ == "file":
                items.append({"name": name, "type": "file"})
            else:
                subprefix = f"{prefix}/{name}" if prefix else name
                items.append({"name": name, "type": "dir", "children": children_of(subprefix)})
        return items

    return children_of("")


def extract_repository_from_zip(
    zip_bytes: bytes,
    suggested_name: Optional[str] = None,
) -> Tuple[str, str, List[ExtractedFile], List[Dict[str, Any]]]:
    """
    Validate zip, extract allowed text files.

    Returns ``(repo_id, repo_name, files, file_tree)``. Raises ``ValueError`` on invalid input.
    """
    if len(zip_bytes) > MAX_ZIP_BYTES:
        raise ValueError(f"Zip file too large (max {MAX_ZIP_BYTES // (1024 * 1024)} MB)")

    buf = io.BytesIO(zip_bytes)
    if not zipfile.is_zipfile(buf):
        raise ValueError("Invalid or corrupted zip file")

    repo_id = str(uuid.uuid4())
    files: List[ExtractedFile] = []
    uncompressed_total = 0

    with zipfile.ZipFile(buf, "r") as zf:
        infos = zf.infolist()
        # Single top-level folder → use as repo display name hint
        top_names = {n.filename.split("/")[0].rstrip("/") for n in infos if n.filename and not n.filename.startswith("/")}
        common_root = None
        if len(top_names) == 1:
            only = next(iter(top_names))
            if only and all(i.filename.startswith(only + "/") or i.filename == only + "/" for i in infos):
                common_root = only

        repo_name = suggested_name or (common_root if common_root else "repository")

        for info in infos:
            if info.is_dir():
                continue
            name = info.filename.replace("\\", "/").strip("/")
            if not _is_safe_zip_entry(name):
                continue
            rel = Path(name)
            if common_root:
                cr = common_root + "/"
                if str(rel).startswith(cr) or rel.as_posix() == common_root:
                    rel = Path(*rel.parts[1:]) if len(rel.parts) > 1 else Path("")
            rel_posix = rel.as_posix() if rel != Path(".") else ""
            if not rel_posix or _should_skip_path(rel):
                continue
            uncompressed_total += info.file_size
            if uncompressed_total > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("Uncompressed contents exceed safety limit")

            lower_name = rel.name.lower()
            if lower_name == "package-lock.json" and info.file_size > PACKAGE_LOCK_SKIP_BYTES:
                continue

            if info.file_size > MAX_SINGLE_FILE_BYTES:
                continue

            try:
                raw = zf.read(info)
            except (RuntimeError, zipfile.BadZipFile) as e:
                raise ValueError(f"Failed to read archive member: {info.filename}: {e}") from e

            if len(raw) > MAX_SINGLE_FILE_BYTES:
                continue

            text = _read_text_safe(raw)
            if text is None:
                continue

            files.append(ExtractedFile(rel_path=rel_posix, content=text))

    if not files:
        raise ValueError("No readable code or text files found in the zip (after filtering)")

    max_repo_files = int(os.getenv("REPO_MAX_FILES", "500"))
    if len(files) > max_repo_files:
        files = sorted(files, key=lambda f: f.rel_path)[:max_repo_files]

    tree = build_file_tree(f.rel_path for f in files)
    return repo_id, repo_name, files, tree


def build_overview_context(files: Sequence[ExtractedFile]) -> str:
    """Concatenate bounded snippets for AI project overview."""
    parts: List[str] = []
    for ef in files[:OVERVIEW_MAX_FILES]:
        snippet = ef.content[:OVERVIEW_FILE_SNIPPET]
        parts.append(f"### File: {ef.rel_path}\n```\n{snippet}\n```\n")
    return "\n".join(parts)


_TOKEN_RE = re.compile(r"[a-zA-Z0-9_]{2,}")


def tokenize_for_retrieval(text: str) -> List[str]:
    """Lowercase alphanumeric tokens of length ≥2 for cheap lexical overlap scoring."""
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def score_chunk(question: str, path: str, content: str) -> float:
    """Score how well ``path`` + ``content`` match question tokens (path hits weighted higher)."""
    q_tokens = set(tokenize_for_retrieval(question))
    if not q_tokens:
        return 0.0
    hay = (path + "\n" + content).lower()
    score = 0.0
    for t in q_tokens:
        if t in hay:
            score += 2.0 if t in path.lower() else 1.0
    return score


def select_relevant_chunks(
    chunks: Sequence[Tuple[str, str]],  # (path, content)
    question: str,
    max_chars: int = 14000,
) -> List[Tuple[str, str]]:
    """Return (path, content) chunks ranked by simple lexical overlap, bounded by max_chars."""
    scored: List[Tuple[float, str, str]] = []
    for path, content in chunks:
        s = score_chunk(question, path, content)
        if s > 0:
            scored.append((s, path, content))
    scored.sort(key=lambda x: -x[0])
    if not scored:
        # fallback: first chunks
        scored = [(0.0, p, c) for p, c in chunks[:20]]

    out: List[Tuple[str, str]] = []
    total = 0
    for _, path, content in scored:
        block = f"--- {path} ---\n{content}\n"
        if total + len(block) > max_chars:
            if not out:
                out.append((path, content[: max_chars - 200]))
            break
        out.append((path, content))
        total += len(block)
        if total >= max_chars:
            break
    return out


_SLUG_ID = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,63}$")

ALLOWED_FLOW_GROUPS = frozenset({"entry", "api", "service", "data", "external", "infra", "other"})


def sanitize_data_flow_graph(raw: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
    """Normalize AI output into a bounded force-graph payload (nodes + links)."""
    if not isinstance(raw, dict):
        return {"nodes": [], "links": []}
    max_nodes = int(os.getenv("REPO_DATA_FLOW_MAX_NODES", "36"))
    max_links = int(os.getenv("REPO_DATA_FLOW_MAX_LINKS", "72"))
    nodes_in = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
    links_in = raw.get("links") if isinstance(raw.get("links"), list) else []

    def make_slug(label: str, idx: int) -> str:
        """Derive a valid graph node id slug from a human label, falling back to ``node_{idx}``."""
        base = re.sub(r"[^a-zA-Z0-9_]+", "_", (label or "node").strip())[:40].strip("_")
        if not base:
            base = "node"
        if not base[0].isalpha():
            base = f"n_{base}"
        base = base[:64]
        if not _SLUG_ID.match(base):
            base = f"node_{idx}"
        return base[:64]

    nodes: List[Dict[str, Any]] = []
    seen_ids: set = set()
    for i, n in enumerate(nodes_in[:max_nodes]):
        if not isinstance(n, dict):
            continue
        nid = str(n.get("id", "")).strip()
        label = str(n.get("label", "")).strip() or nid or f"Step {i + 1}"
        if not nid or not _SLUG_ID.match(nid):
            nid = make_slug(label, i)
        orig = nid
        suffix = 0
        while nid in seen_ids:
            suffix += 1
            nid = f"{orig[:50]}_{suffix}"
        seen_ids.add(nid)
        g = str(n.get("group", "other")).strip().lower()
        if g not in ALLOWED_FLOW_GROUPS:
            g = "other"
        nodes.append({"id": nid, "label": label[:96], "group": g, "type": "flow"})
    id_set = {n["id"] for n in nodes}
    links: List[Dict[str, Any]] = []
    for L in links_in[:max_links]:
        if not isinstance(L, dict):
            continue
        s = str(L.get("source", "")).strip()
        t = str(L.get("target", "")).strip()
        if s not in id_set or t not in id_set or s == t:
            continue
        lab = str(L.get("label", "")).strip()[:48]
        links.append({"source": s, "target": t, "label": lab, "type": "flow"})
    return {"nodes": nodes, "links": links}
