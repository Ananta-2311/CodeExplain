"""SQLAlchemy models for uploaded repositories, files, chunks, and chat messages.

Tables mirror the zip-ingest pipeline: one ``Repository`` row per upload,
``RepositoryFile`` for raw text, ``RepositoryChunk`` for retrieval slices, and
``RepositoryChatMessage`` for persisted Q&A. Cascade deletes remove children
when a repository row is deleted.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from model.history_model import Base


class Repository(Base):
    """Uploaded repository metadata and optional AI overview."""

    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_tree_json: Mapped[str] = mapped_column(Text, nullable=False)
    overview_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_flow_graph_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    files = relationship("RepositoryFile", back_populates="repository", cascade="all, delete-orphan")
    chunks = relationship("RepositoryChunk", back_populates="repository", cascade="all, delete-orphan")
    chat_messages = relationship(
        "RepositoryChatMessage", back_populates="repository", cascade="all, delete-orphan"
    )


class RepositoryFile(Base):
    """One text file extracted from the archive (path + content)."""

    __tablename__ = "repository_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id"), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(2048), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    repository = relationship("Repository", back_populates="files")
    chunks = relationship("RepositoryChunk", back_populates="file", cascade="all, delete-orphan")


class RepositoryChunk(Base):
    """Searchable slice of a file for retrieval and AI context."""

    __tablename__ = "repository_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id"), nullable=False, index=True)
    file_id: Mapped[int] = mapped_column(Integer, ForeignKey("repository_files.id"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    repository = relationship("Repository", back_populates="chunks")
    file = relationship("RepositoryFile", back_populates="chunks")


class RepositoryChatMessage(Base):
    """Persisted Q&A turns for a repository (session-long)."""

    __tablename__ = "repository_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    repo_id: Mapped[str] = mapped_column(String(36), ForeignKey("repositories.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    repository = relationship("Repository", back_populates="chat_messages")
