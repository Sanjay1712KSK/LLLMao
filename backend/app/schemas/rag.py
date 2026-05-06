from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentRead(BaseModel):
    id: str
    filename: str
    file_type: str
    status: str
    error_message: str | None = None
    indexed_at: datetime | None = None
    chunk_count: int
    embedding_model: str
    progress_done: int = 0
    progress_total: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkRead(BaseModel):
    id: str
    document_id: str
    filename: str
    source_type: str
    chunk_index: int
    section_title: str | None = None
    token_count: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RagChatRequest(BaseModel):
    chat_id: int
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)
