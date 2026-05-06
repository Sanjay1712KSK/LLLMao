from fastapi import APIRouter

from app.schemas import HealthRead
from app.services.ollama_service import OllamaService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthRead)
async def health() -> HealthRead:
    ok, message = await OllamaService().health()
    return HealthRead(ok=ok, message=message)
