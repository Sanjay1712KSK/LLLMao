from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ImageRead(BaseModel):
    id: str
    chat_id: int | None = None
    filename: str
    mime_type: str
    width: int
    height: int
    size_bytes: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MultimodalChatRequest(BaseModel):
    chat_id: int
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)
    image_ids: list[str] = Field(default_factory=list)
    workspace_id: str | None = None
    use_workspace: bool = False
    use_knowledge_base: bool = False


class RetrievalDebugRead(BaseModel):
    id: str
    chat_id: int | None = None
    mode: str
    query: str
    sources: list[dict]
    context_summary: str
    token_budget: int
    created_at: datetime


class ContextSessionRead(BaseModel):
    id: str
    chat_id: int | None = None
    mode: str
    image_ids: list[str]
    workspace_id: str | None = None
    document_context_count: int
    workspace_context_count: int
    prompt_tokens_estimate: int
    created_at: datetime
