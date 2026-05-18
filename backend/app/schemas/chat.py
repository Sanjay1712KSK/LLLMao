from datetime import datetime
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatCreate(BaseModel):
    title: str = Field(default="New chat", max_length=160)


class ChatUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    pinned: bool | None = None


class ChatRead(BaseModel):
    id: int
    title: str
    pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatAttachmentRead(BaseModel):
    id: str
    message_id: int | None = None
    type: str
    source_type: str
    mime_type: str
    filename: str
    duration_ms: int | None = None
    sample_rate: int | None = None
    channels: int | None = None
    width: int | None = None
    height: int | None = None
    pages: int | None = None
    transcript: str | None = None
    timestamps_json: str | None = None
    embeddings_hook: str | None = None
    audio_session_id: str | None = None
    extra_metadata: Any = {}

    model_config = ConfigDict(from_attributes=True)

    @field_validator("extra_metadata", mode="before")
    def parse_extra_metadata(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v


class MessageRead(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    model_name: str | None = None
    created_at: datetime
    attachments: list[ChatAttachmentRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
