"""Upload, list, overview, data-flow, file preview, and chat APIs for repository-aware assistance.

Exposes REST endpoints under ``/repositories`` for zip upload, listing, detail
(including optional chat history), per-file content, AI project overview,
AI data-flow graph generation, and RAG-style Q&A over stored chunks. Uses
SQLite via ``get_session`` and reuses ``get_ai_model`` from explain routes.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from controller.explanation_controller import get_ai_model
from model.history_model import get_session, init_db
from model.repository_model import (
    Repository,
    RepositoryChatMessage,
    RepositoryChunk,
    RepositoryFile,
)
from service.repository_service import (
    CHUNK_CHARS,
    CHUNK_OVERLAP,
    ExtractedFile,
    build_overview_context,
    extract_repository_from_zip,
    sanitize_data_flow_graph,
    select_relevant_chunks,
    _chunk_lines,
)

router = APIRouter(prefix="/repositories", tags=["repositories"])
init_db()


class ChatTurn(BaseModel):
    """One message in repo chat."""

    role: str
    content: str


class RepoChatRequest(BaseModel):
    """Question plus optional prior turns (excluding the current question)."""

    question: str = Field(..., min_length=1, max_length=8000)
    history: List[ChatTurn] = Field(default_factory=list)


class OverviewBody(BaseModel):
    """Request body for overview regeneration."""

    regenerate: bool = False


def _repo_to_summary(r: Repository) -> Dict[str, Any]:
    """Shape a ``Repository`` ORM row into the JSON list-item used by ``GET /repositories``."""
    return {
        "repo_id": r.id,
        "repo_name": r.name,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/upload")
async def upload_repository(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
):
    """Accept a zip archive, extract filtered text files, persist tree and chunks."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_file", "message": "Please upload a .zip file."},
        )
    try:
        raw = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "read_failed", "message": str(e)},
        )

    suggested = name or (file.filename.rsplit(".", 1)[0] if file.filename else None)
    try:
        repo_id, repo_name, extracted, tree = extract_repository_from_zip(raw, suggested_name=suggested)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_zip", "message": str(e)},
        )

    tree_json = json.dumps(tree)

    try:
        with get_session() as db:
            repo = Repository(id=repo_id, name=repo_name, file_tree_json=tree_json, overview_text=None)
            db.add(repo)
            db.flush()

            for ef in extracted:
                rf = RepositoryFile(repo_id=repo_id, path=ef.rel_path, content=ef.content)
                db.add(rf)
                db.flush()

                for idx, (start_line, end_line, chunk_text) in enumerate(
                    _chunk_lines(ef.content, CHUNK_CHARS, CHUNK_OVERLAP)
                ):
                    db.add(
                        RepositoryChunk(
                            repo_id=repo_id,
                            file_id=rf.id,
                            chunk_index=idx,
                            start_line=start_line,
                            end_line=end_line,
                            content=chunk_text,
                        )
                    )
            db.commit()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "persist_failed", "message": str(e)},
        )

    return {
        "ok": True,
        "repo_id": repo_id,
        "repo_name": repo_name,
        "file_tree": tree,
    }


@router.get("")
def list_repositories():
    """List uploaded repositories (newest first)."""
    try:
        with get_session() as db:
            rows = db.query(Repository).order_by(Repository.created_at.desc()).all()
            return {"ok": True, "repositories": [_repo_to_summary(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "list_failed", "message": str(e)})


@router.get("/{repo_id}")
def get_repository(repo_id: str, include_chat: bool = True):
    """Return metadata, file tree, overview if present, and recent chat messages."""
    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})
            n_files = db.query(RepositoryFile).filter(RepositoryFile.repo_id == repo_id).count()
            n_chunks = db.query(RepositoryChunk).filter(RepositoryChunk.repo_id == repo_id).count()
            df_graph: Optional[Dict[str, Any]] = None
            raw_df = getattr(r, "data_flow_graph_json", None)
            if raw_df:
                try:
                    df_graph = json.loads(raw_df)
                except json.JSONDecodeError:
                    df_graph = None
            out: Dict[str, Any] = {
                "ok": True,
                "repo_id": r.id,
                "repo_name": r.name,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "file_tree": json.loads(r.file_tree_json),
                "overview": r.overview_text,
                "data_flow_graph": df_graph,
                "stats": {"files": n_files, "chunks": n_chunks},
            }
            if include_chat:
                msgs = (
                    db.query(RepositoryChatMessage)
                    .filter(RepositoryChatMessage.repo_id == repo_id)
                    .order_by(RepositoryChatMessage.id.asc())
                    .limit(80)
                    .all()
                )
                out["chat_messages"] = [
                    {"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
                    for m in msgs
                ]
            return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "fetch_failed", "message": str(e)})


@router.delete("/{repo_id}")
def delete_repository(repo_id: str):
    """Remove a repository and all stored files, chunks, and chat for that repo."""
    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})
            db.delete(r)
            db.commit()
        return {"ok": True, "repo_id": repo_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "delete_failed", "message": str(e)})


@router.get("/{repo_id}/file")
def get_repository_file(repo_id: str, path: str = Query(..., min_length=1, max_length=2048)):
    """Return stored content for one repository-relative path."""
    path = path.strip().lstrip("/")
    if not path or ".." in path.split("/"):
        raise HTTPException(status_code=400, detail={"error": "invalid_path", "message": "Invalid path"})
    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})
            rf = (
                db.query(RepositoryFile)
                .filter(RepositoryFile.repo_id == repo_id, RepositoryFile.path == path)
                .first()
            )
            if not rf:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "File not found"})
            return {"ok": True, "path": rf.path, "content": rf.content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "fetch_failed", "message": str(e)})


@router.post("/{repo_id}/overview")
def generate_or_get_overview(repo_id: str, body: OverviewBody = OverviewBody()):
    """Generate a project overview with AI, or return a cached overview."""
    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})
            if r.overview_text and not body.regenerate:
                return {"ok": True, "overview": r.overview_text, "cached": True}

            files = db.query(RepositoryFile).filter(RepositoryFile.repo_id == repo_id).order_by(RepositoryFile.path).all()
            if not files:
                raise HTTPException(status_code=400, detail={"error": "no_files", "message": "No files in repository"})

            extracted = [ExtractedFile(rel_path=f.path, content=f.content) for f in files]
            ctx = build_overview_context(extracted)

        try:
            ai = get_ai_model()
        except HTTPException:
            raise
        result = ai.generate_project_overview(ctx)
        if not result.get("ok"):
            err = result.get("error", "generation_failed")
            if err == "rate_limit_exceeded":
                raise HTTPException(status_code=429, detail=result)
            raise HTTPException(status_code=500, detail=result)

        overview = result["overview"]
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if r:
                r.overview_text = overview
                db.commit()

        return {"ok": True, "overview": overview, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "overview_failed", "message": str(e)})


@router.post("/{repo_id}/data-flow")
def generate_or_get_data_flow(repo_id: str, body: OverviewBody = OverviewBody()):
    """Build or return cached AI data-flow graph (nodes + directed links)."""
    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})
            stored = getattr(r, "data_flow_graph_json", None)
            if stored and not body.regenerate:
                try:
                    cached = json.loads(stored)
                except json.JSONDecodeError:
                    cached = None
                if isinstance(cached, dict) and cached.get("nodes"):
                    return {"ok": True, "graph": cached, "cached": True}

            files = db.query(RepositoryFile).filter(RepositoryFile.repo_id == repo_id).order_by(RepositoryFile.path).all()
            if not files:
                raise HTTPException(status_code=400, detail={"error": "no_files", "message": "No files in repository"})

            extracted = [ExtractedFile(rel_path=f.path, content=f.content) for f in files]
            ctx = build_overview_context(extracted)

        try:
            ai = get_ai_model()
        except HTTPException:
            raise
        result = ai.generate_data_flow_graph(ctx)
        if not result.get("ok"):
            err = result.get("error", "generation_failed")
            if err == "rate_limit_exceeded":
                raise HTTPException(status_code=429, detail=result)
            raise HTTPException(status_code=500, detail=result)

        graph = sanitize_data_flow_graph(result.get("graph") or {})
        if not graph.get("nodes"):
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "graph_empty",
                    "message": "Could not build a data-flow map from the model output. Try “Regenerate map”.",
                },
            )

        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if r:
                r.data_flow_graph_json = json.dumps(graph)
                db.commit()

        return {"ok": True, "graph": graph, "cached": False}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "data_flow_failed", "message": str(e)})


@router.post("/{repo_id}/chat")
def repo_chat(repo_id: str, req: RepoChatRequest):
    """Retrieve relevant chunks, call the model with chat history, persist messages."""
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail={"error": "empty_question", "message": "Question is required"})

    try:
        with get_session() as db:
            r = db.query(Repository).filter(Repository.id == repo_id).first()
            if not r:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Repository not found"})

            pairs: List[tuple] = (
                db.query(RepositoryFile.path, RepositoryChunk.content)
                .join(RepositoryChunk, RepositoryChunk.file_id == RepositoryFile.id)
                .filter(RepositoryChunk.repo_id == repo_id)
                .all()
            )
            flat: List[tuple] = [(path, content) for path, content in pairs]

            if len(flat) > 2500:
                step = max(1, len(flat) // 2500)
                flat = flat[::step]

            selected = select_relevant_chunks(flat, question, max_chars=14000)
            context_blocks = "\n\n".join(f"### {p}\n{c}" for p, c in selected)

            if req.history:
                hist = [{"role": t.role, "content": t.content} for t in req.history if t.role in ("user", "assistant")]
            else:
                prev = (
                    db.query(RepositoryChatMessage)
                    .filter(RepositoryChatMessage.repo_id == repo_id)
                    .order_by(RepositoryChatMessage.id.asc())
                    .limit(40)
                    .all()
                )
                hist = [{"role": m.role, "content": m.content} for m in prev]

        try:
            ai = get_ai_model()
        except HTTPException:
            raise
        out = ai.answer_repo_question(question, context_blocks, hist)
        if not out.get("ok"):
            err = out.get("error", "generation_failed")
            if err == "rate_limit_exceeded":
                raise HTTPException(status_code=429, detail=out)
            raise HTTPException(status_code=500, detail=out)

        answer = out.get("answer", "")
        refs = out.get("referenced_files") or []

        with get_session() as db:
            db.add(RepositoryChatMessage(repo_id=repo_id, role="user", content=question))
            db.add(RepositoryChatMessage(repo_id=repo_id, role="assistant", content=answer))
            db.commit()

        return {"ok": True, "answer": answer, "referenced_files": refs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "chat_failed", "message": str(e)})
