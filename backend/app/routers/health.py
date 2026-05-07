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
    chroma_status = dependency_checker.cached("chromadb") or dependency_checker.check_chromadb()
    pillow_status = dependency_checker.cached("pillow") or dependency_checker.check_pillow()
    pypdf_status = dependency_checker.cached("pypdf") or dependency_checker.check_import(
        "pypdf", "pypdf", "PDF parser unavailable.", "Install pypdf in backend requirements."
    )
    docx_status = dependency_checker.cached("python-docx") or dependency_checker.check_import(
        "python-docx", "docx", "DOCX parser unavailable.", "Install python-docx in backend requirements."
    )
    watchdog_status = dependency_checker.cached("watchdog") or dependency_checker.check_import(
        "watchdog", "watchdog", "Workspace file watcher unavailable.", "Install watchdog in backend requirements."
    )
    return HealthRead(
        ok=ok and database_status.ok,
        message=message,
        backend="healthy",
        ollama=ok,
        chromadb=chroma_status.ok,
        pillow=pillow_status.ok,
        database=database_status.ok,
        ollama_ok=ok,
        database_ok=database_status.ok,
        dependencies={
            "chromadb": {"ok": chroma_status.ok, "message": chroma_status.message},
            "pillow": {"ok": pillow_status.ok, "message": pillow_status.message},
            "pypdf": {"ok": pypdf_status.ok, "message": pypdf_status.message},
            "python-docx": {"ok": docx_status.ok, "message": docx_status.message},
            "watchdog": {"ok": watchdog_status.ok, "message": watchdog_status.message},
            "sqlite": {"ok": database_status.ok, "message": database_status.message},
        },
    )
