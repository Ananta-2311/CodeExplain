"""SQLAlchemy models, engine, and session helpers for SQLite persistence."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import create_engine, inspect, Integer, String, Text, DateTime, Boolean, text
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./codemuse.db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

# Base for models
Base = declarative_base()


class HistorySession(Base):
    """Saved explain session: user code plus JSON explanation payload."""

    __tablename__ = "history_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class ApiKey(Base):
    """Optional API keys for future auth."""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key: Mapped[str] = mapped_column(Text, nullable=False)  # NOTE: store securely in production
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ApiLog(Base):
    """Per-request access log written by the FastAPI middleware."""

    __tablename__ = "api_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ShareSession(Base):
    """Public share link: random token maps to code + response JSON."""

    __tablename__ = "share_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    response_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


# Session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def _ensure_repository_data_flow_column() -> None:
    """Add ``data_flow_graph_json`` when upgrading an existing SQLite/Postgres DB."""
    insp = inspect(engine)
    if "repositories" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("repositories")}
    if "data_flow_graph_json" in cols:
        return
    dialect = engine.dialect.name
    if dialect == "sqlite":
        stmt = text("ALTER TABLE repositories ADD COLUMN data_flow_graph_json TEXT")
    elif dialect == "postgresql":
        stmt = text("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS data_flow_graph_json TEXT")
    else:
        return
    with engine.begin() as conn:
        conn.execute(stmt)


def init_db() -> None:
    """Create tables if they do not exist."""
    # Import repository models so their tables are registered on ``Base.metadata``.
    from model import repository_model  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_repository_data_flow_column()


def get_session() -> Session:
    """Return a new SQLAlchemy session (caller manages commit/close, often via context manager)."""
    return SessionLocal()
