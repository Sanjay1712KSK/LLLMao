from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Literal

from app.rag.chunking import estimate_tokens

if TYPE_CHECKING:
    from app.workspace.retrieval.pipeline import RetrievedCodeChunk

logger = logging.getLogger("lllmao.allocator")


class ContextBudgetAllocator:
    def __init__(self, strategy: Literal["precision", "balanced", "aggressive-context", "low-memory"] = "balanced") -> None:
        self.strategy = strategy
        if strategy == "precision":
            self.max_tokens = 2000
            self.max_chunks = 4
        elif strategy == "low-memory":
            self.max_tokens = 1500
            self.max_chunks = 3
        elif strategy == "aggressive-context":
            self.max_tokens = 8000
            self.max_chunks = 20
        else:
            self.max_tokens = 4000
            self.max_chunks = 8

    def allocate(self, chunks: list[RetrievedCodeChunk]) -> list[RetrievedCodeChunk]:
        """
        Allocate chunks based on strategy constraints, applying deduplication and token budgeting.
        """
        allocated: list[RetrievedCodeChunk] = []
        used_tokens = 0
        seen_keys: set[str] = set()

        # Assuming chunks are already pre-ranked by the retrieval pipeline
        for chunk in chunks:
            if len(allocated) >= self.max_chunks:
                break
                
            # Deduplication
            content_key = " ".join(chunk.content.lower().split())[:1200]
            if content_key in seen_keys:
                continue

            tokens = estimate_tokens(chunk.content)
            if used_tokens + tokens > self.max_tokens and allocated:
                # If we've already allocated some chunks and this one pushes us over the limit,
                # skip it. If it's the first chunk, we might allow it depending on rules.
                continue

            allocated.append(chunk)
            used_tokens += tokens
            seen_keys.add(content_key)

        return allocated
