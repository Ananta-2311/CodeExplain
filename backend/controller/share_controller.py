from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import json
import secrets

from model.history_model import get_session, ShareSession

router = APIRouter(prefix="/share", tags=["share"])


class ShareRequest(BaseModel):
    code: str
    response: Dict[str, Any]
    expires_days: Optional[int] = 30  # Default 30 days


class ShareResponse(BaseModel):
    token: str
    url: str
    expires_at: Optional[datetime]


def generate_token() -> str:
    """Generate a secure random token."""
    return secrets.token_urlsafe(32)


@router.post("", response_model=ShareResponse)
def create_share(req: ShareRequest):
    """Create a shareable session with a unique token."""
    try:
        token = generate_token()
        expires_at = None
        if req.expires_days:
            expires_at = datetime.utcnow() + timedelta(days=req.expires_days)
        
        with get_session() as db:
            share = ShareSession(
                token=token,
                code=req.code,
                response_json=json.dumps(req.response),
                expires_at=expires_at,
            )
            db.add(share)
            db.commit()
            db.refresh(share)
        
        # In production, use actual frontend URL from config
        url = f"http://localhost:5173/share/{token}"
        
        return ShareResponse(
            token=token,
            url=url,
            expires_at=expires_at,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "share_creation_failed", "message": str(e)}
        )


@router.get("/{token}")
def get_shared_session(token: str):
    """Retrieve a shared session by token."""
    try:
        with get_session() as db:
            share = db.query(ShareSession).filter(ShareSession.token == token).first()
            
            if not share:
                raise HTTPException(
                    status_code=404,
                    detail={"error": "not_found", "message": "Shared session not found or expired"}
                )
            
            # Check expiration
            if share.expires_at and share.expires_at < datetime.utcnow():
                raise HTTPException(
                    status_code=410,
                    detail={"error": "expired", "message": "This shared session has expired"}
                )
            
            return {
                "ok": True,
                "code": share.code,
                "response": json.loads(share.response_json),
                "created_at": share.created_at,
                "expires_at": share.expires_at,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "fetch_failed", "message": str(e)}
        )

