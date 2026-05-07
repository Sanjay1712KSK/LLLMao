from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base


class MemoryEntry(Base):
    __tablename__ = "memory_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    collection: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    scope: Mapped[str] = mapped_column(String(64), index=True, nullable=False, default="conversation")
    chat_id: Mapped[int | None] = mapped_column(ForeignKey("chats.id", ondelete="SET NULL"), index=True, nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    importance: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    access_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    chat_id: Mapped[int] = mapped_column(ForeignKey("chats.id", ondelete="CASCADE"), index=True, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_estimate: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RetrievalRanking(Base):
    __tablename__ = "retrieval_rankings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    chat_id: Mapped[int | None] = mapped_column(ForeignKey("chats.id", ondelete="SET NULL"), index=True, nullable=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    metadata_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OrchestrationLog(Base):
    __tablename__ = "orchestration_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    chat_id: Mapped[int | None] = mapped_column(ForeignKey("chats.id", ondelete="SET NULL"), index=True, nullable=True)
    mode: Mapped[str] = mapped_column(String(64), nullable=False, default="intelligent")
    query: Mapped[str] = mapped_column(Text, nullable=False)
    token_budget: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_estimate: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    composition_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
