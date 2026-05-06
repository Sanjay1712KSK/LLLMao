from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import HealthRead
from app.services.health import dependency_checker
from app.services.ollama_service import OllamaService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthRead)
async def health(db: Session = Depends(get_db)) -> HealthRead:
    ok, message = await OllamaService().health()
    database_status = dependency_checker.check_database(db)
    pillow_status = dependency_checker.cached("pillow") or dependency_checker.check_pillow()
    chroma_status = dependency_checker.cached("chromadb") or dependency_checker.check_chromadb()
    return HealthRead(
        ok=ok and database_status.ok,
        message=message,
        ollama_ok=ok,
        database_ok=database_status.ok,
        dependencies={
            "pillow": {"ok": pillow_status.ok, "message": pillow_status.message},
            "chromadb": {"ok": chroma_status.ok, "message": chroma_status.message},
            "sqlite": {"ok": database_status.ok, "message": database_status.message},
        },
    )
