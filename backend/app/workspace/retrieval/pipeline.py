from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import CodeSymbol
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import ChromaVectorStore, VectorStoreUnavailableError, WORKSPACE_COLLECTION
from app.services.ollama_service import OllamaUnavailableError
from app.workspace.retrieval.allocator import ContextBudgetAllocator
from app.workspace.retrieval.reranking import CosineReranker

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
        self.allocator = ContextBudgetAllocator(strategy="balanced")
        self.reranker = CosineReranker()

    async def retrieve(self, db: Session, workspace_id: str, query: str, limit: int = 15) -> list[RetrievedCodeChunk]:
        # Stage 1: Query Rewrite (Placeholder for future expansion)
        rewritten_query = query
        
        # Stage 2: Semantic Search
        semantic = await self._semantic(workspace_id, rewritten_query, limit)
        
        # Stage 3: Lexical Search
        keyword = self._keyword(db, workspace_id, rewritten_query, limit)
        
        # Merge
        merged: dict[str, RetrievedCodeChunk] = {}
        for rank, item in enumerate(semantic):
            item.score += max(0.0, 1.0 - rank * 0.08)
            merged[item.id] = item
        for item in keyword:
            if item.id in merged:
                merged[item.id].score += item.score
            else:
                merged[item.id] = item

        chunks = list(merged.values())
        
        # Stage 4: Reranking
        reranked_chunks = await self.reranker.rerank(rewritten_query, chunks)
        
        # Stage 5 & 6: Deduplication and Token Budgeting
        allocated_chunks = self.allocator.allocate(reranked_chunks)

        return allocated_chunks

    async def _semantic(self, workspace_id: str, query: str, limit: int) -> list[RetrievedCodeChunk]:
        try:
            embedding = await OllamaEmbeddingService(model=self.embedding_model).embed(query)
            rows = ChromaVectorStore(collection_name=WORKSPACE_COLLECTION).query(
                embedding, limit=limit, where={"workspace_id": workspace_id}
            )
        except (VectorStoreUnavailableError, OllamaUnavailableError):
            logger.warning("workspace_semantic_retrieval_unavailable", extra={"workspace_id": workspace_id})
            return []
            
        chunks = []
        for row in rows:
            metadata = row.get("metadata") or {}
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


def build_workspace_messages(history: list[dict[str, str]], query: str, chunks: list[RetrievedCodeChunk]) -> list[dict[str, str]]:
    context = []
    for index, chunk in enumerate(chunks, start=1):
        symbol = f"::{chunk.symbol_name}" if chunk.symbol_name else ""
        context.append(
            f"[Source {index}: {chunk.file_path}{symbol} lines {chunk.start_line}-{chunk.end_line}, {chunk.language}/{chunk.chunk_type}, score {chunk.score:.2f}]\n{chunk.content}"
        )
        
    system_prompt = (
        "You are LLLMao, a highly advanced local workspace-aware development assistant. "
        "You MUST use the provided workspace context below to answer project questions. "
        "DO NOT invent facts. "
        "Prioritize exact symbols, file paths, ROS2 topics, nodes, and launch files. "
        "IMPORTANT: When answering, you MUST cite the source file paths (e.g., 'Based on server/index.js...') so the user knows where the information came from.\n\n"
        "Workspace context:\n"
        + ("\n\n---\n\n".join(context) if context else "No workspace context was retrieved.")
    )
    return [{"role": "system", "content": system_prompt}, *history[-10:], {"role": "user", "content": query}]
