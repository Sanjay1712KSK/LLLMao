from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MemoryEntry
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import (
    CONVERSATIONAL_MEMORY_COLLECTION,
    PROJECT_MEMORY_COLLECTION,
    SEMANTIC_NOTES_COLLECTION,
    WORKSPACE_MEMORY_COLLECTION,
    ChromaVectorStore,
    VectorStoreUnavailableError,
)
from app.services.ollama_service import OllamaUnavailableError

logger = logging.getLogger("lllmao.memory")

COLLECTION_BY_SCOPE = {
    "conversation": CONVERSATIONAL_MEMORY_COLLECTION,
    "workspace": WORKSPACE_MEMORY_COLLECTION,
    "project": PROJECT_MEMORY_COLLECTION,
    "note": SEMANTIC_NOTES_COLLECTION,
}


class LongTermMemoryStore:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embedding_model = embedding_model

    async def remember(
        self,
        db: Session,
        *,
        summary: str,
        content: str,
        scope: str = "conversation",
        chat_id: int | None = None,
        workspace_id: str | None = None,
        title: str = "",
        importance: float = 0.5,
        metadata: dict | None = None,
    ) -> MemoryEntry:
        collection = COLLECTION_BY_SCOPE.get(scope, CONVERSATIONAL_MEMORY_COLLECTION)
        entry = MemoryEntry(
            id=str(uuid.uuid4()),
            collection=collection,
            scope=scope,
            chat_id=chat_id,
            workspace_id=workspace_id,
            title=title[:255],
            summary=summary,
            content=content,
            metadata_json=json.dumps(metadata or {}),
            importance=max(0.0, min(1.0, importance)),
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        await self._upsert_vector(entry)
        return entry

    async def recall(
        self,
        db: Session,
        query: str,
        *,
        workspace_id: str | None = None,
        limit: int = 8,
    ) -> list[dict]:
        semantic = await self._semantic_recall(query, limit=max(limit * 2, 10))
        ids = [item["id"] for item in semantic]
        rows: list[MemoryEntry] = []
        if ids:
            rows = list(db.scalars(select(MemoryEntry).where(MemoryEntry.id.in_(ids))))
        if len(rows) < limit:
            statement = select(MemoryEntry).order_by(MemoryEntry.updated_at.desc()).limit(limit * 3)
            rows.extend([row for row in db.scalars(statement).all() if row.id not in {item.id for item in rows}])
        semantic_scores = {item["id"]: item["score"] for item in semantic}
        recalled: list[dict] = []
        for row in rows:
            if workspace_id and row.workspace_id and row.workspace_id != workspace_id:
                continue
            row.access_count += 1
            row.last_accessed_at = datetime.now(UTC)
            recalled.append(
                {
                    "id": row.id,
                    "collection": row.collection,
                    "scope": row.scope,
                    "chat_id": row.chat_id,
                    "workspace_id": row.workspace_id,
                    "title": row.title,
                    "summary": row.summary,
                    "content": row.content,
                    "importance": row.importance,
                    "access_count": row.access_count,
                    "created_at": row.created_at,
                    "score": semantic_scores.get(row.id, row.importance),
                    "metadata": json.loads(row.metadata_json or "{}"),
                }
            )
        db.commit()
        return recalled[:limit]

    async def _upsert_vector(self, entry: MemoryEntry) -> None:
        try:
            embedding = await OllamaEmbeddingService(model=self.embedding_model).embed(f"{entry.title}\n{entry.summary}\n{entry.content}")
            ChromaVectorStore(collection_name=entry.collection).upsert_records(
                ids=[entry.id],
                documents=[entry.summary],
                embeddings=[embedding],
                metadatas=[
                    {
                        "scope": entry.scope,
                        "chat_id": entry.chat_id or 0,
                        "workspace_id": entry.workspace_id or "",
                        "title": entry.title,
                        "importance": entry.importance,
                        "created_at": entry.created_at.isoformat() if entry.created_at else "",
                    }
                ],
            )
        except (OllamaUnavailableError, VectorStoreUnavailableError):
            logger.warning("memory_vector_upsert_skipped", extra={"memory_id": entry.id, "collection": entry.collection})

    async def _semantic_recall(self, query: str, limit: int) -> list[dict]:
        try:
            embedding = await OllamaEmbeddingService(model=self.embedding_model).embed(query)
        except OllamaUnavailableError:
            return []
        rows: list[dict] = []
        for collection in COLLECTION_BY_SCOPE.values():
            try:
                for row in ChromaVectorStore(collection_name=collection).query(embedding, limit=limit):
                    distance = row.get("distance")
                    rows.append({"id": str(row.get("id") or ""), "score": 1.0 / (1.0 + float(distance or 0.0))})
            except VectorStoreUnavailableError:
                logger.warning("memory_semantic_recall_unavailable", extra={"collection": collection})
                return []
        return sorted(rows, key=lambda item: item["score"], reverse=True)[:limit]
