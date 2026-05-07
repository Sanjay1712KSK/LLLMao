from __future__ import annotations

import importlib.util
import logging
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.rag.vectorstore import chroma_client_manager

logger = logging.getLogger("lllmao.dependencies")

DependencyName = Literal["chromadb", "pillow", "pypdf", "python-docx", "watchdog", "ollama", "sqlite", "uploads"]


@dataclass(slots=True)
class DependencyStatus:
    name: DependencyName
    ok: bool
    message: str
    details: str | None = None


class DependencyChecker:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._startup_status: dict[DependencyName, DependencyStatus] = {}

    async def startup_check(self) -> dict[DependencyName, DependencyStatus]:
        statuses = {
            "chromadb": self.check_chromadb(),
            "pillow": self.check_import("pillow", "PIL", "Image processing backend unavailable.", "Install Pillow in backend requirements."),
            "pypdf": self.check_import("pypdf", "pypdf", "PDF parser unavailable.", "Install pypdf in backend requirements."),
            "python-docx": self.check_import(
                "python-docx",
                "docx",
                "DOCX parser unavailable.",
                "Install python-docx in backend requirements.",
            ),
            "watchdog": self.check_import(
                "watchdog",
                "watchdog",
                "Workspace file watcher unavailable.",
                "Install watchdog in backend requirements.",
            ),
            "sqlite": self.check_sqlite_import(),
            "uploads": self.check_upload_paths(),
            "ollama": await self.check_ollama(),
        }
        self._startup_status = statuses
        for status in statuses.values():
            log = logger.info if status.ok else logger.warning
            log(
                "dependency_check",
                extra={
                    "dependency": status.name,
                    "ok": status.ok,
                    "status_message": status.message,
                    "details": status.details,
                },
            )
        return statuses

    def cached(self, name: DependencyName) -> DependencyStatus | None:
        return self._startup_status.get(name)

    def check_import(self, name: DependencyName, module: str, message: str, details: str) -> DependencyStatus:
        if importlib.util.find_spec(module) is None:
            return DependencyStatus(
                name=name,
                ok=False,
                message=message,
                details=details,
            )
        return DependencyStatus(name=name, ok=True, message=f"{name} is available.")

    def check_chromadb(self) -> DependencyStatus:
        ok, details = chroma_client_manager.validate()
        if not ok:
            return DependencyStatus(
                name="chromadb",
                ok=False,
                message="Vector retrieval backend unavailable.",
                details=details or "ChromaDB dependency missing or failed to initialize.",
            )
        return DependencyStatus(name="chromadb", ok=True, message="ChromaDB is initialized.")

    def check_pillow(self) -> DependencyStatus:
        return self.check_import("pillow", "PIL", "Image processing backend unavailable.", "Install Pillow in backend requirements.")

    def check_sqlite_import(self) -> DependencyStatus:
        try:
            sqlite3.connect(":memory:").execute("SELECT 1").close()
        except sqlite3.Error as exc:
            return DependencyStatus(name="sqlite", ok=False, message="SQLite unavailable.", details=str(exc))
        return DependencyStatus(name="sqlite", ok=True, message="SQLite is available.")

    def check_upload_paths(self) -> DependencyStatus:
        try:
            settings = get_settings()
            for path in (Path(settings.upload_path), Path(settings.image_path), Path(settings.chroma_path)):
                path.mkdir(parents=True, exist_ok=True)
                probe = path / ".lllmao-write-test"
                probe.write_text("ok", encoding="utf-8")
                probe.unlink(missing_ok=True)
        except OSError as exc:
            return DependencyStatus(
                name="uploads",
                ok=False,
                message="Upload storage unavailable.",
                details=str(exc),
            )
        return DependencyStatus(name="uploads", ok=True, message="Upload and vector storage paths are writable.")

    def check_database(self, db: Session) -> DependencyStatus:
        try:
            db.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001 - health must never crash the request.
            logger.exception("database_health_check_failed")
            return DependencyStatus(name="sqlite", ok=False, message="Database unavailable.", details=str(exc))
        return DependencyStatus(name="sqlite", ok=True, message="Database is available.")

    async def check_ollama(self) -> DependencyStatus:
        try:
            timeout = httpx.Timeout(0.8, connect=0.2)
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(f"{self.settings.ollama_base_url.rstrip('/')}/api/tags")
                response.raise_for_status()
        except httpx.HTTPError as exc:
            return DependencyStatus(
                name="ollama",
                ok=False,
                message="Ollama is not reachable.",
                details=str(exc),
            )
        return DependencyStatus(name="ollama", ok=True, message="Ollama is reachable.")


dependency_checker = DependencyChecker()
