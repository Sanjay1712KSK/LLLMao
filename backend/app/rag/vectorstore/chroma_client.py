from __future__ import annotations

import importlib.util
import logging
import threading
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger("lllmao.chroma")

DOCUMENTS_COLLECTION = "documents"
WORKSPACE_COLLECTION = "workspace_chunks"
MULTIMODAL_COLLECTION = "multimodal_context"
REQUIRED_COLLECTIONS = (DOCUMENTS_COLLECTION, WORKSPACE_COLLECTION, MULTIMODAL_COLLECTION)


class ChromaUnavailableError(RuntimeError):
    pass


class ChromaClientManager:
    def __init__(self) -> None:
        self._client: Any | None = None
        self._collections: dict[str, Any] = {}
        self._lock = threading.RLock()

    @property
    def persist_path(self) -> Path:
        return Path(get_settings().chroma_path)

    def available(self) -> bool:
        return importlib.util.find_spec("chromadb") is not None

    def initialize(self, collections: tuple[str, ...] = REQUIRED_COLLECTIONS) -> None:
        with self._lock:
            client = self.client()
            for collection_name in collections:
                self.collection(collection_name, client=client)
            logger.info(
                "chromadb_initialized",
                extra={
                    "chroma_path": str(self.persist_path),
                    "collections": ",".join(collections),
                },
            )

    def validate(self) -> tuple[bool, str | None]:
        if not self.available():
            return False, "ChromaDB dependency missing or failed to initialize."
        try:
            self.initialize()
        except ChromaUnavailableError as exc:
            return False, str(exc)
        return True, None

    def client(self) -> Any:
        with self._lock:
            if self._client is not None:
                return self._client
            if not self.available():
                logger.warning("chromadb_dependency_missing")
                raise ChromaUnavailableError("ChromaDB dependency missing or failed to initialize.")
            try:
                import chromadb

                persist_path = self.persist_path
                persist_path.mkdir(parents=True, exist_ok=True)
                self._client = chromadb.PersistentClient(path=str(persist_path))
            except Exception as exc:  # noqa: BLE001 - vector DB should fail closed.
                logger.exception("chromadb_client_initialization_failed", extra={"chroma_path": str(self.persist_path)})
                raise ChromaUnavailableError("ChromaDB dependency missing or failed to initialize.") from exc
            return self._client

    def collection(self, name: str, client: Any | None = None) -> Any:
        with self._lock:
            if name in self._collections:
                return self._collections[name]
            try:
                chroma_client = client or self.client()
                collection = chroma_client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            except Exception as exc:  # noqa: BLE001
                logger.exception("chromadb_collection_initialization_failed", extra={"collection": name})
                raise ChromaUnavailableError("ChromaDB dependency missing or failed to initialize.") from exc
            self._collections[name] = collection
            return collection


chroma_client_manager = ChromaClientManager()
