from __future__ import annotations

import logging
from typing import Any

from app.rag.types import RagChunk
from app.rag.vectorstore.chroma_client import (
    DOCUMENTS_COLLECTION,
    ChromaUnavailableError,
    chroma_client_manager,
)

logger = logging.getLogger("lllmao.vectorstore")


class VectorStoreUnavailableError(RuntimeError):
    pass


class ChromaVectorStore:
    def __init__(self, collection_name: str = DOCUMENTS_COLLECTION) -> None:
        try:
            self.collection = chroma_client_manager.collection(collection_name)
        except ChromaUnavailableError as exc:
            raise VectorStoreUnavailableError("Vector database unavailable.") from exc

    def upsert_chunks(self, chunks: list[RagChunk], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        self.upsert_records(
            ids=[chunk.id for chunk in chunks],
            documents=[chunk.content for chunk in chunks],
            embeddings=embeddings,
            metadatas=[self._metadata(chunk) for chunk in chunks],
        )

    def upsert_records(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, str | int | float | bool | None]],
    ) -> None:
        if not ids:
            return
        try:
            self.collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)
        except Exception as exc:  # noqa: BLE001
            logger.exception("vectorstore_upsert_failed", extra={"record_count": len(ids)})
            raise VectorStoreUnavailableError("Vector database unavailable.") from exc

    def query(self, embedding: list[float], limit: int = 5) -> list[dict[str, Any]]:
        try:
            result = self.collection.query(
                query_embeddings=[embedding],
                n_results=limit,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("vectorstore_query_failed", extra={"limit": limit})
            raise VectorStoreUnavailableError("Vector database unavailable.") from exc
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        ids = result.get("ids", [[]])[0]
        rows: list[dict[str, Any]] = []
        for index, document in enumerate(documents):
            rows.append(
                {
                    "id": ids[index] if index < len(ids) else "",
                    "content": document,
                    "metadata": metadatas[index] if index < len(metadatas) else {},
                    "distance": distances[index] if index < len(distances) else None,
                }
            )
        return rows

    def delete_document(self, document_id: str) -> None:
        self._delete(where={"document_id": document_id})

    def delete_workspace(self, workspace_id: str) -> None:
        self._delete(where={"workspace_id": workspace_id})

    def delete_file(self, workspace_id: str, file_path: str) -> None:
        self._delete(where={"$and": [{"workspace_id": workspace_id}, {"file_path": file_path}]})

    def _delete(self, where: dict[str, Any]) -> None:
        try:
            self.collection.delete(where=where)
        except Exception as exc:  # noqa: BLE001
            logger.exception("vectorstore_delete_failed", extra={"where": str(where)})
            raise VectorStoreUnavailableError("Vector database unavailable.") from exc

    def _metadata(self, chunk: RagChunk) -> dict[str, str | int | float | bool | None]:
        return {
            "document_id": chunk.document_id,
            "filename": chunk.filename,
            "chunk_index": chunk.chunk_index,
            "source_type": chunk.source_type,
            "section_title": chunk.section_title or "",
            "created_at": chunk.created_at,
            "token_count": chunk.token_count,
        }
