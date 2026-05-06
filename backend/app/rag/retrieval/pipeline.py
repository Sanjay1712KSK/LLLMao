from __future__ import annotations

from dataclasses import dataclass

from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import ChromaVectorStore


@dataclass(slots=True)
class RetrievedChunk:
    id: str
    content: str
    filename: str
    section_title: str | None
    chunk_index: int
    source_type: str
    distance: float | None


class RagRetrievalPipeline:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embeddings = OllamaEmbeddingService(model=embedding_model)
        self.vectorstore = ChromaVectorStore()

    async def retrieve(self, query: str, limit: int = 5) -> list[RetrievedChunk]:
        embedding = await self.embeddings.embed(query)
        rows = self.vectorstore.query(embedding, limit=limit)
        chunks: list[RetrievedChunk] = []
        for row in rows:
            metadata = row.get("metadata") or {}
            chunks.append(
                RetrievedChunk(
                    id=str(row.get("id") or ""),
                    content=str(row.get("content") or ""),
                    filename=str(metadata.get("filename") or "Unknown source"),
                    section_title=metadata.get("section_title"),
                    chunk_index=int(metadata.get("chunk_index") or 0),
                    source_type=str(metadata.get("source_type") or "document"),
                    distance=row.get("distance"),
                )
            )
        return chunks


def build_contextual_messages(history: list[dict[str, str]], query: str, chunks: list[RetrievedChunk]) -> list[dict[str, str]]:
    context_blocks = []
    for index, chunk in enumerate(chunks, start=1):
        title = f"{chunk.filename}"
        if chunk.section_title:
            title += f" / {chunk.section_title}"
        context_blocks.append(f"[Source {index}: {title}, chunk {chunk.chunk_index}]\n{chunk.content}")

    system_prompt = (
        "You are LLLMao, a local-only assistant using retrieved knowledge base context. "
        "Answer from the provided context when relevant. If the context is insufficient, say so clearly. "
        "Do not invent document details. Include concise source references when useful.\n\n"
        "Retrieved context:\n"
        + ("\n\n---\n\n".join(context_blocks) if context_blocks else "No relevant context was retrieved.")
    )
    trimmed_history = history[-10:]
    return [{"role": "system", "content": system_prompt}, *trimmed_history, {"role": "user", "content": query}]
