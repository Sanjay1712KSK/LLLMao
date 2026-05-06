from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceConnectRequest(BaseModel):
    path: str = Field(min_length=1)
    name: str | None = Field(default=None, max_length=160)


class WorkspaceRead(BaseModel):
    id: str
    name: str
    root_path: str
    status: str
    error_message: str | None = None
    indexed_at: datetime | None = None
    file_count: int
    symbol_count: int
    embedding_model: str
    progress_done: int = 0
    progress_total: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IndexedFileRead(BaseModel):
    id: str
    workspace_id: str
    relative_path: str
    language: str
    status: str
    size_bytes: int
    last_modified: datetime
    indexed_at: datetime | None = None
    chunk_count: int

    model_config = ConfigDict(from_attributes=True)


class WorkspaceChatRequest(BaseModel):
    chat_id: int
    workspace_id: str
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)


class WorkspaceSource(BaseModel):
    file_path: str
    language: str
    chunk_type: str
    symbol_name: str | None = None
    start_line: int
    end_line: int
    score: float
