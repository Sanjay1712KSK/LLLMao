from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

from app.rag.chunking import estimate_tokens
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import ChromaVectorStore

logger = logging.getLogger("lllmao.rag_retrieval")


@dataclass(slots=True)
class RetrievedChunk:
    id: str
    content: str
    filename: str
    section_title: str | None
    chunk_index: int
    source_type: str
    distance: float | None
    score: float


class RagRetrievalPipeline:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embeddings = OllamaEmbeddingService(model=embedding_model)
        self.vectorstore = ChromaVectorStore()

    async def retrieve(self, query: str, limit: int = 5) -> list[RetrievedChunk]:
        embedding = await self.embeddings.embed(query)
        rows = self.vectorstore.query(embedding, limit=limit * 3)
        chunks: list[RetrievedChunk] = []
        for row in rows:
            metadata = row.get("metadata") or {}
            distance = row.get("distance")
            content = str(row.get("content") or "")
            chunks.append(
                RetrievedChunk(
                    id=str(row.get("id") or ""),
                    content=content,
                    filename=str(metadata.get("filename") or "Unknown source"),
                    section_title=metadata.get("section_title"),
                    chunk_index=int(metadata.get("chunk_index") or 0),
                    source_type=str(metadata.get("source_type") or "document"),
                    distance=distance,
                    score=self._score(query, content, metadata, distance),
                )
            )
        return self._dedupe(chunks)[:limit]

    def _score(self, query: str, content: str, metadata: dict, distance: float | None) -> float:
        score = 1.0 / (1.0 + float(distance or 0.0))
        terms = {term.lower() for term in query.split() if len(term) > 2}
        haystack = " ".join([content[:1200], str(metadata.get("filename") or ""), str(metadata.get("section_title") or "")]).lower()
        if terms:
            score += min(sum(1 for term in terms if term in haystack), 6) * 0.08
        if metadata.get("section_title"):
            score += 0.04
        token_count = estimate_tokens(content)
        if token_count > 900:
            score -= 0.08
        return score

    def _dedupe(self, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        seen: set[str] = set()
        deduped: list[RetrievedChunk] = []
        for chunk in sorted(chunks, key=lambda item: item.score, reverse=True):
            normalized = " ".join(chunk.content.lower().split())
            fingerprint = hashlib.sha1(f"{chunk.filename}:{normalized[:1000]}".encode("utf-8")).hexdigest()
            if fingerprint in seen:
                logger.debug("rag_duplicate_chunk_filtered", extra={"chunk_id": chunk.id, "filename": chunk.filename})
                continue
            seen.add(fingerprint)
            deduped.append(chunk)
        return deduped


def build_contextual_messages(history: list[dict[str, str]], query: str, chunks: list[RetrievedChunk]) -> list[dict[str, str]]:
    context_blocks = []
    used_tokens = 0
    for index, chunk in enumerate(chunks, start=1):
        title = f"{chunk.filename}"
        if chunk.section_title:
            title += f" / {chunk.section_title}"
        content = chunk.content
        tokens = estimate_tokens(content)
        if used_tokens + tokens > 3000 and context_blocks:
            continue
        used_tokens += tokens
        context_blocks.append(f"[Source {index}: {title}, chunk {chunk.chunk_index}, score {chunk.score:.2f}]\n{content}")

    system_prompt = (
        "You are LLLMao, a local-only assistant using retrieved knowledge base context. "
        "Answer from the provided context when relevant. If the context is insufficient, say so clearly. "
        "Do not invent document details. Include concise source references when useful.\n\n"
        "Retrieved context:\n"
        + ("\n\n---\n\n".join(context_blocks) if context_blocks else "No relevant context was retrieved.")
    )
    trimmed_history = history[-10:]
    return [{"role": "system", "content": system_prompt}, *trimmed_history, {"role": "user", "content": query}]
