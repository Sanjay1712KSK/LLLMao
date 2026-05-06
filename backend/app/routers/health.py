from sqlalchemy.orm import Session

from app.database import get_db
from fastapi import APIRouter

from app.schemas import HealthRead
from app.services.ollama_service import OllamaService
from app.services.system_monitor import system_monitor

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthRead)
async def health(db: Session = Depends(get_db)) -> HealthRead:
    ok, message = await OllamaService().health()
    database_ok = system_monitor.database_ok(db)
    return HealthRead(ok=ok and database_ok, message=message, ollama_ok=ok, database_ok=database_ok)
