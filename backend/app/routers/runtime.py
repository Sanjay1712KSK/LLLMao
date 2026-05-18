from __future__ import annotations

import getpass
import importlib.util
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.runtime_paths import get_runtime_paths
from app.services.health import dependency_checker
from app.services.ollama_service import OllamaService
from app.services.system_monitor import system_monitor

router = APIRouter(tags=["runtime"])


class CacheClearRequest(BaseModel):
    cache: bool = True
    embeddings: bool = True


@router.get("/runtime/paths")
async def runtime_paths() -> dict[str, str]:
    return get_runtime_paths().as_dict()


@router.get("/runtime/diagnostics")
async def runtime_diagnostics(db: Session = Depends(get_db)) -> dict[str, Any]:
    settings = get_settings()
    ollama_ok, ollama_message = await OllamaService().health()
    models = []
    if ollama_ok:
        try:
            models = await OllamaService().list_models()
        except Exception:
            models = []
    database = dependency_checker.check_database(db)
    chroma = dependency_checker.check_chromadb()
    storage = dependency_checker.check_upload_paths()
    stats = await system_monitor.collect(db)
    ffmpeg_path = shutil.which("ffmpeg")
    faster_whisper_ok = importlib.util.find_spec("faster_whisper") is not None
    pyav_ok = importlib.util.find_spec("av") is not None
    audio_ok = faster_whisper_ok and (bool(ffmpeg_path) or pyav_ok)
    return {
        "username": getpass.getuser(),
        "app": settings.app_name,
        "ollama": {"ok": ollama_ok, "message": ollama_message, "url": settings.ollama_base_url},
        "models": {"ok": bool(models), "count": len(models), "names": [model["name"] for model in models]},
        "backend": {"ok": True, "message": "Backend API is healthy."},
        "database": {"ok": database.ok, "message": database.message, "details": database.details},
        "chromadb": {"ok": chroma.ok, "message": chroma.message, "details": chroma.details},
        "storage": {"ok": storage.ok, "message": storage.message, "details": storage.details},
        "audio": {
            "ok": audio_ok,
            "ffmpeg": {"ok": bool(ffmpeg_path), "path": ffmpeg_path},
            "pyav": {"ok": pyav_ok},
            "faster_whisper": {"ok": faster_whisper_ok},
            "message": "Voice transcription is ready." if audio_ok else "Voice transcription needs faster-whisper and an audio decoder.",
        },
        "gpu": {"ok": stats.get("gpu") is not None, "details": stats.get("gpu") or "GPU telemetry unavailable or CPU-only system."},
        "paths": get_runtime_paths().as_dict(),
    }


@router.post("/runtime/cache/clear")
async def clear_cache(payload: CacheClearRequest) -> dict[str, list[str]]:
    paths = get_runtime_paths()
    targets: list[Path] = []
    if payload.cache:
        targets.append(paths.cache)
    if payload.embeddings:
        targets.append(paths.embeddings)
    cleared: list[str] = []
    for target in targets:
        if not target.exists():
            continue
        if target == Path.home() or target.parent == target:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refusing unsafe cache path.")
        shutil.rmtree(target)
        target.mkdir(parents=True, exist_ok=True)
        cleared.append(str(target))
    return {"cleared": cleared}
