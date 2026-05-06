from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import CodeSymbol
from app.rag.chunking import estimate_tokens
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import ChromaVectorStore, VectorStoreUnavailableError
from app.services.ollama_service import OllamaUnavailableError

logger = logging.getLogger("lllmao.workspace_retrieval")


@dataclass(slots=True)
class RetrievedCodeChunk:
    id: str
    content: str
    file_path: str
    language: str
    chunk_type: str
    symbol_name: str | None
    start_line: int
    end_line: int
    score: float
    ros2_metadata: dict


class WorkspaceRetrievalPipeline:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embedding_model = embedding_model

    async def retrieve(self, db: Session, workspace_id: str, query: str, limit: int = 8) -> list[RetrievedCodeChunk]:
        semantic = await self._semantic(workspace_id, query, limit)
        keyword = self._keyword(db, workspace_id, query, limit * 2)
        merged: dict[str, RetrievedCodeChunk] = {}
        for rank, item in enumerate(semantic):
            item.score += max(0.0, 1.0 - rank * 0.08)
            merged[item.id] = item
        for item in keyword:
            if item.id in merged:
                merged[item.id].score += item.score
            else:
                merged[item.id] = item
        symbol_boosts = self._query_symbols(query)
        for item in merged.values():
            haystack = " ".join([item.file_path, item.symbol_name or "", item.chunk_type, item.content[:500]]).lower()
            if any(symbol in haystack for symbol in symbol_boosts):
                item.score += 0.65
            if item.file_path.endswith(("package.xml", "CMakeLists.txt", "setup.py", "launch.py")):
                item.score += 0.22
            if item.chunk_type in {"function", "class", "launch", "ros2_node"}:
                item.score += 0.15
        return self._dedupe(sorted(merged.values(), key=lambda item: item.score, reverse=True))[:limit]

    async def _semantic(self, workspace_id: str, query: str, limit: int) -> list[RetrievedCodeChunk]:
        try:
            embedding = await OllamaEmbeddingService(model=self.embedding_model).embed(query)
            rows = ChromaVectorStore(collection_name="lllmao_workspace").query(embedding, limit=limit)
        except (VectorStoreUnavailableError, OllamaUnavailableError):
            logger.warning("workspace_semantic_retrieval_unavailable", extra={"workspace_id": workspace_id})
            return []
        chunks = []
        for row in rows:
            metadata = row.get("metadata") or {}
            if metadata.get("workspace_id") != workspace_id:
                continue
            distance = row.get("distance")
            chunks.append(
                RetrievedCodeChunk(
                    id=str(row.get("id") or ""),
                    content=str(row.get("content") or ""),
                    file_path=str(metadata.get("file_path") or ""),
                    language=str(metadata.get("language") or ""),
                    chunk_type=str(metadata.get("chunk_type") or ""),
                    symbol_name=str(metadata.get("symbol_name") or "") or None,
                    start_line=int(metadata.get("start_line") or 1),
                    end_line=int(metadata.get("end_line") or 1),
                    score=1.0 / (1.0 + float(distance or 0.0)),
                    ros2_metadata={},
                )
            )
        return chunks

    def _keyword(self, db: Session, workspace_id: str, query: str, limit: int) -> list[RetrievedCodeChunk]:
        terms = [term.lower() for term in re.findall(r"[A-Za-z_][\w/.-]+", query) if len(term) > 2]
        if not terms:
            return []
        clauses = []
        for term in terms[:8]:
            like = f"%{term}%"
            clauses.extend([CodeSymbol.content.ilike(like), CodeSymbol.symbol_name.ilike(like), CodeSymbol.file_path.ilike(like)])
        rows = db.scalars(select(CodeSymbol).where(CodeSymbol.workspace_id == workspace_id, or_(*clauses)).limit(200)).all()
        scored = []
        for row in rows:
            score = 0.0
            content = row.content.lower()
            symbol = (row.symbol_name or "").lower()
            path = row.file_path.lower()
            ros2 = json.loads(row.ros2_metadata or "{}")
            for term in terms:
                if term == symbol:
                    score += 2.0
                if term in symbol:
                    score += 1.2
                if term in path:
                    score += 0.8
                score += min(content.count(term), 5) * 0.18
                if term in json.dumps(ros2).lower():
                    score += 1.0
            scored.append(self._from_symbol(row, score))
        return sorted(scored, key=lambda item: item.score, reverse=True)[:limit]

    def _from_symbol(self, row: CodeSymbol, score: float) -> RetrievedCodeChunk:
        return RetrievedCodeChunk(
            id=row.id,
            content=row.content,
            file_path=row.file_path,
            language=row.language,
            chunk_type=row.chunk_type,
            symbol_name=row.symbol_name,
            start_line=row.start_line,
            end_line=row.end_line,
            score=score,
            ros2_metadata=json.loads(row.ros2_metadata or "{}"),
        )

    def _query_symbols(self, query: str) -> list[str]:
        return [term.lower() for term in re.findall(r"[A-Za-z_][\w/.-]+", query) if len(term) > 2]

    def _dedupe(self, chunks: list[RetrievedCodeChunk]) -> list[RetrievedCodeChunk]:
        seen: set[tuple[str, int, int] | str] = set()
        deduped: list[RetrievedCodeChunk] = []
        for chunk in chunks:
            key: tuple[str, int, int] | str = (chunk.file_path, chunk.start_line, chunk.end_line)
            normalized = " ".join(chunk.content.lower().split())
            content_key = normalized[:1200]
            if key in seen or content_key in seen:
                logger.debug("workspace_duplicate_chunk_filtered", extra={"chunk_id": chunk.id, "file_path": chunk.file_path})
                continue
            seen.add(key)
            seen.add(content_key)
            deduped.append(chunk)
        return deduped


def build_workspace_messages(history: list[dict[str, str]], query: str, chunks: list[RetrievedCodeChunk]) -> list[dict[str, str]]:
    context = []
    used_tokens = 0
    for index, chunk in enumerate(chunks, start=1):
        symbol = f"::{chunk.symbol_name}" if chunk.symbol_name else ""
        tokens = estimate_tokens(chunk.content)
        if used_tokens + tokens > 3200 and context:
            continue
        used_tokens += tokens
        context.append(
            f"[Source {index}: {chunk.file_path}{symbol} lines {chunk.start_line}-{chunk.end_line}, {chunk.language}/{chunk.chunk_type}, score {chunk.score:.2f}]\n{chunk.content}"
        )
    system_prompt = (
        "You are LLLMao, a local workspace-aware development assistant. "
        "Use the retrieved code context to answer project questions. "
        "Prioritize exact symbols, file paths, ROS2 topics, nodes, publishers, subscribers, services, and launch files. "
        "If context is insufficient, say what is missing instead of guessing.\n\n"
        "Workspace context:\n"
        + ("\n\n---\n\n".join(context) if context else "No workspace context was retrieved.")
    )
    return [{"role": "system", "content": system_prompt}, *history[-10:], {"role": "user", "content": query}]
