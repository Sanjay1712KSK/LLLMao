from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MemoryStatusRead(BaseModel):
    enabled: bool
    chromadb: bool
    entries: int
    summaries: int
    collections: list[str]


class SummarizeRequest(BaseModel):
    chat_id: int
    persist: bool = True
    scope: str = "conversation"
    workspace_id: str | None = None


class SummaryRead(BaseModel):
    id: str | None = None
    chat_id: int
    summary: str
    message_count: int
    token_estimate: int


class MemoryRead(BaseModel):
    id: str
    collection: str
    scope: str
    chat_id: int | None = None
    workspace_id: str | None = None
    title: str
    summary: str
    importance: float
    score: float | None = None
    created_at: datetime


class IntelligentChatRequest(BaseModel):
    chat_id: int
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)
    workspace_id: str | None = None
    use_workspace: bool = True
    use_documents: bool = True


class ContextDebugRead(BaseModel):
    id: str
    chat_id: int | None = None
    mode: str
    query: str
    token_budget: int
    token_estimate: int
    composition: dict
    created_at: datetime
