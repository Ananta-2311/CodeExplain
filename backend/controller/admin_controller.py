from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, desc

from model.history_model import get_session, ApiLog, ApiKey

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "changeme")


def require_admin(x_admin_token: Optional[str]):
    if not x_admin_token or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail={"error": "unauthorized", "message": "Invalid admin token"})


class StatsResponse(BaseModel):
    total_requests: int
    total_errors: int
    avg_latency_ms: float
    p95_latency_ms: float
    last_1h_requests: int
    last_1h_avg_latency_ms: float


@router.get("/stats", response_model=StatsResponse)
def get_stats(x_admin_token: Optional[str] = Header(None)):
    require_admin(x_admin_token)
    with get_session() as db:
        total_requests = db.query(func.count(ApiLog.id)).scalar() or 0
        total_errors = db.query(func.count(ApiLog.id)).filter(ApiLog.status_code >= 400).scalar() or 0
        avg_latency = db.query(func.avg(ApiLog.latency_ms)).scalar() or 0.0
        # Approximate p95 from last 1000 logs
        last_logs = db.query(ApiLog.latency_ms).order_by(desc(ApiLog.id)).limit(1000).all()
        latencies = [row[0] for row in last_logs]
        p95 = 0.0
        if latencies:
            latencies.sort()
            idx = int(0.95 * (len(latencies) - 1))
            p95 = float(latencies[idx])

        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        last_1h = db.query(ApiLog).filter(ApiLog.timestamp >= one_hour_ago)
        last_1h_requests = last_1h.count()
        last_1h_avg = last_1h.with_entities(func.avg(ApiLog.latency_ms)).scalar() or 0.0

        return StatsResponse(
            total_requests=total_requests,
            total_errors=total_errors,
            avg_latency_ms=float(avg_latency),
            p95_latency_ms=p95,
            last_1h_requests=last_1h_requests,
            last_1h_avg_latency_ms=float(last_1h_avg),
        )


class LogItem(BaseModel):
    id: int
    timestamp: datetime
    method: str
    path: str
    status_code: int
    latency_ms: int
    error: Optional[str]


@router.get("/logs", response_model=List[LogItem])
def get_logs(limit: int = 200, x_admin_token: Optional[str] = Header(None)):
    require_admin(x_admin_token)
    with get_session() as db:
        rows = (
            db.query(ApiLog)
            .order_by(desc(ApiLog.id))
            .limit(max(1, min(limit, 1000)))
            .all()
        )
        return [
            LogItem(
                id=r.id,
                timestamp=r.timestamp,
                method=r.method,
                path=r.path,
                status_code=r.status_code,
                latency_ms=r.latency_ms,
                error=r.error,
            )
            for r in rows
        ]


class ApiKeyIn(BaseModel):
    name: str
    key: str
    active: Optional[bool] = True


class ApiKeyOut(BaseModel):
    id: int
    name: str
    active: bool
    created_at: datetime
    last_used_at: Optional[datetime]
    mask: str


@router.get("/keys", response_model=List[ApiKeyOut])
def list_keys(x_admin_token: Optional[str] = Header(None)):
    require_admin(x_admin_token)
    with get_session() as db:
        keys = db.query(ApiKey).order_by(desc(ApiKey.created_at)).all()
        result: List[ApiKeyOut] = []
        for k in keys:
            mask = (k.key[:3] + "..." + k.key[-4:]) if k.key and len(k.key) > 7 else "***"
            result.append(ApiKeyOut(
                id=k.id,
                name=k.name,
                active=k.active,
                created_at=k.created_at,
                last_used_at=k.last_used_at,
                mask=mask,
            ))
        return result


@router.post("/keys", response_model=ApiKeyOut)
def add_key(payload: ApiKeyIn, x_admin_token: Optional[str] = Header(None)):
    require_admin(x_admin_token)
    with get_session() as db:
        rec = ApiKey(name=payload.name, key=payload.key, active=bool(payload.active))
        db.add(rec)
        db.commit()
        db.refresh(rec)
        mask = (rec.key[:3] + "..." + rec.key[-4:]) if rec.key and len(rec.key) > 7 else "***"
        return ApiKeyOut(
            id=rec.id,
            name=rec.name,
            active=rec.active,
            created_at=rec.created_at,
            last_used_at=rec.last_used_at,
            mask=mask,
        )


@router.delete("/keys/{key_id}")
def delete_key(key_id: int, x_admin_token: Optional[str] = Header(None)):
    require_admin(x_admin_token)
    with get_session() as db:
        rec = db.query(ApiKey).filter(ApiKey.id == key_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        db.delete(rec)
        db.commit()
        return {"ok": True}
