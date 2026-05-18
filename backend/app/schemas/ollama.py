from pydantic import BaseModel, Field


class ModelRead(BaseModel):
    name: str
    modified_at: str | None = None
    size: int | None = None
    family: str | None = None
    parameter_size: str | None = None
    quantization_level: str | None = None
    capabilities: list[str] = []


class HealthRead(BaseModel):
    ok: bool
    message: str
    backend: str = "healthy"
    ollama: bool = False
    chromadb: bool = False
    pillow: bool = False
    database: bool = False
    uploads: bool = False
    backend_ok: bool = True
    ollama_ok: bool
    ollama_installed: bool = False
    database_ok: bool
    dependencies: dict[str, dict[str, str | bool]] = {}


class ChatRequest(BaseModel):
    chat_id: int
    model: str = Field(min_length=1)
    message: str = Field(min_length=1)


class GpuStatsRead(BaseModel):
    name: str | None = None
    vendor: str | None = None
    utilization_percent: float | None = None
    vram_used_mb: float | None = None
    vram_total_mb: float | None = None


class SystemStatsRead(BaseModel):
    cpu_percent: float
    ram_percent: float
    ram_used_mb: float
    ram_total_mb: float
    gpu: GpuStatsRead | None = None
    active_model: str | None = None
    backend_ok: bool
    ollama_ok: bool
    database_ok: bool
