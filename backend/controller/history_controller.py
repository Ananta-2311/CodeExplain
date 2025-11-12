from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime
import json

from model.history_model import HistorySession, get_session, init_db

router = APIRouter(prefix="/history", tags=["history"])

# Ensure tables exist on import
init_db()


class HistoryCreateRequest(BaseModel):
    code: str
    response: Dict[str, Any]  # Store explanation payload (overview/explanations/ast)
    title: Optional[str] = None


class HistoryItem(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime


class HistoryDetail(BaseModel):
    id: int
    title: Optional[str]
    code: str
    response: Dict[str, Any]
    created_at: datetime


@router.post("", response_model=HistoryDetail)
def save_history(req: HistoryCreateRequest):
    try:
        with get_session() as db:
            record = HistorySession(
                title=req.title,
                code=req.code,
                response_json=json.dumps(req.response),
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return HistoryDetail(
                id=record.id,
                title=record.title,
                code=record.code,
                response=json.loads(record.response_json),
                created_at=record.created_at,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "save_failed", "message": str(e)})


@router.get("", response_model=List[HistoryItem])
def list_history():
    try:
        with get_session() as db:
            rows = db.query(HistorySession).order_by(HistorySession.created_at.desc()).all()
            return [
                HistoryItem(id=r.id, title=r.title, created_at=r.created_at)
                for r in rows
            ]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "list_failed", "message": str(e)})


@router.get("/{history_id}", response_model=HistoryDetail)
def get_history(history_id: int):
    try:
        with get_session() as db:
            record = db.query(HistorySession).filter(HistorySession.id == history_id).first()
            if not record:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "History not found"})
            return HistoryDetail(
                id=record.id,
                title=record.title,
                code=record.code,
                response=json.loads(record.response_json),
                created_at=record.created_at,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "fetch_failed", "message": str(e)})


@router.delete("/{history_id}")
def delete_history(history_id: int):
    try:
        with get_session() as db:
            record = db.query(HistorySession).filter(HistorySession.id == history_id).first()
            if not record:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": "History not found"})
            db.delete(record)
            db.commit()
            return {"ok": True, "message": "History deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "delete_failed", "message": str(e)})


@router.delete("")
def delete_all_history():
    try:
        with get_session() as db:
            db.query(HistorySession).delete()
            db.commit()
            return {"ok": True, "message": "All history deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "delete_failed", "message": str(e)})
