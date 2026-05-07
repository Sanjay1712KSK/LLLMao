from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.workspace.retrieval.pipeline import RetrievedCodeChunk

logger = logging.getLogger("lllmao.reranker")


class BaseReranker(ABC):
    @abstractmethod
    async def rerank(self, query: str, chunks: list[RetrievedCodeChunk]) -> list[RetrievedCodeChunk]:
        pass


class CosineReranker(BaseReranker):
    """
    A placeholder for a true cross-encoder or lightweight local reranker.
    For now, it relies on the initial cosine distance from ChromaDB,
    but applies some semantic boosts based on query terms.
    """
    async def rerank(self, query: str, chunks: list[RetrievedCodeChunk]) -> list[RetrievedCodeChunk]:
        query_terms = set(term.lower() for term in query.split() if len(term) > 2)
        
        for chunk in chunks:
            haystack = " ".join([chunk.file_path, chunk.symbol_name or "", chunk.chunk_type, chunk.content[:500]]).lower()
            term_matches = sum(1 for term in query_terms if term in haystack)
            
            # Simple keyword boost on top of existing cosine score
            chunk.score += (term_matches * 0.1)
            
            # Recency/Path boosts
            if chunk.file_path.endswith(("package.xml", "CMakeLists.txt", "setup.py", "launch.py")):
                chunk.score += 0.22
            if chunk.chunk_type in {"function", "class", "launch", "ros2_node"}:
                chunk.score += 0.15

        # Sort descending by updated score
        return sorted(chunks, key=lambda c: c.score, reverse=True)
