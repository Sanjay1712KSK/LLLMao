from __future__ import annotations

import importlib.util
import logging
import sqlite3
from dataclasses import dataclass
from typing import Literal

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings

logger = logging.getLogger("lllmao.dependencies")

DependencyName = Literal["pillow", "chromadb", "ollama", "sqlite"]


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
            "pillow": self.check_pillow(),
            "chromadb": self.check_chromadb(),
            "sqlite": self.check_sqlite_import(),
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

    def check_pillow(self) -> DependencyStatus:
        if importlib.util.find_spec("PIL") is None:
            return DependencyStatus(
                name="pillow",
                ok=False,
                message="Image processing backend unavailable.",
                details="Install Pillow in backend requirements.",
            )
        return DependencyStatus(name="pillow", ok=True, message="Pillow is available.")

    def check_chromadb(self) -> DependencyStatus:
        if importlib.util.find_spec("chromadb") is None:
            return DependencyStatus(
                name="chromadb",
                ok=False,
                message="Vector retrieval backend unavailable.",
                details="Install ChromaDB in backend requirements.",
            )
        return DependencyStatus(name="chromadb", ok=True, message="ChromaDB is available.")

    def check_sqlite_import(self) -> DependencyStatus:
        try:
            sqlite3.connect(":memory:").execute("SELECT 1").close()
        except sqlite3.Error as exc:
            return DependencyStatus(name="sqlite", ok=False, message="SQLite unavailable.", details=str(exc))
        return DependencyStatus(name="sqlite", ok=True, message="SQLite is available.")

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
