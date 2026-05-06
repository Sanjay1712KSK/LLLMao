from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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


class MessageRead(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
