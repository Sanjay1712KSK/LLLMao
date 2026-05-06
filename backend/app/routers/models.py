from fastapi import APIRouter, HTTPException, status

from app.schemas import ModelRead
from app.services.ollama_service import OllamaService, OllamaUnavailableError

router = APIRouter(tags=["models"])


@router.get("/models", response_model=list[ModelRead])
async def models() -> list[ModelRead]:
    try:
        return [ModelRead(**model) for model in await OllamaService().list_models()]
    except OllamaUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
