from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime
import json
import os

from model.history_model import HistorySession, get_session, init_db, Base
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

# Settings model (using same base)
class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)  # user_id or "default"
    settings_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


router = APIRouter(prefix="/settings", tags=["settings"])

# Ensure tables exist
init_db()


class SettingsRequest(BaseModel):
    user_id: Optional[str] = "default"
    theme: Optional[str] = "light"  # "light" or "dark"
    fontSize: Optional[int] = 14
    language: Optional[str] = "python"
    editorTheme: Optional[str] = "default"


class SettingsResponse(BaseModel):
    user_id: str
    theme: str
    fontSize: int
    language: str
    editorTheme: str
    updated_at: Optional[datetime] = None


@router.post("", response_model=SettingsResponse)
def save_settings(req: SettingsRequest):
    """Save user settings to database."""
    try:
        settings_dict = {
            "theme": req.theme or "light",
            "fontSize": req.fontSize or 14,
            "language": req.language or "python",
            "editorTheme": req.editorTheme or "default",
        }
        
        with get_session() as db:
            user_id = req.user_id or "default"
            existing = db.query(UserSettings).filter(UserSettings.id == user_id).first()
            
            if existing:
                existing.settings_json = json.dumps(settings_dict)
                existing.updated_at = datetime.utcnow()
            else:
                existing = UserSettings(
                    id=user_id,
                    settings_json=json.dumps(settings_dict),
                    updated_at=datetime.utcnow(),
                )
                db.add(existing)
            
            db.commit()
            db.refresh(existing)
            
            return SettingsResponse(
                user_id=existing.id,
                theme=settings_dict["theme"],
                fontSize=settings_dict["fontSize"],
                language=settings_dict["language"],
                editorTheme=settings_dict["editorTheme"],
                updated_at=existing.updated_at,
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "save_failed", "message": str(e)}
        )


@router.get("/{user_id}", response_model=SettingsResponse)
def get_settings(user_id: str = "default"):
    """Get user settings from database."""
    try:
        with get_session() as db:
            settings = db.query(UserSettings).filter(UserSettings.id == user_id).first()
            
            if not settings:
                return SettingsResponse(
                    user_id=user_id,
                    theme="light",
                    fontSize=14,
                    language="python",
                    editorTheme="default",
                )
            
            settings_dict = json.loads(settings.settings_json)
            return SettingsResponse(
                user_id=settings.id,
                theme=settings_dict.get("theme", "light"),
                fontSize=settings_dict.get("fontSize", 14),
                language=settings_dict.get("language", "python"),
                editorTheme=settings_dict.get("editorTheme", "default"),
                updated_at=settings.updated_at,
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "fetch_failed", "message": str(e)}
        )

