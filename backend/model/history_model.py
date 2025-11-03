from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import create_engine, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./codemuse.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

# Base for models
Base = declarative_base()


class HistorySession(Base):
    __tablename__ = "history_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# Session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def init_db() -> None:
    """Create tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()
