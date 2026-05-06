from pydantic import BaseModel, Field


class ModelRead(BaseModel):
    name: str
    modified_at: str | None = None
    size: int | None = None
    family: str | None = None
    parameter_size: str | None = None
    quantization_level: str | None = None


class HealthRead(BaseModel):
    ok: bool
    message: str


class ChatRequest(BaseModel):
    chat_id: int
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)
