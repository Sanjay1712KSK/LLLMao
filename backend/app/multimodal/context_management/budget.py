from __future__ import annotations

from app.rag.chunking import estimate_tokens


class ContextBudget:
    def __init__(self, max_tokens: int = 3200) -> None:
        self.max_tokens = max_tokens

    def select(self, chunks: list[dict], content_key: str = "content") -> list[dict]:
        selected: list[dict] = []
        used = 0
        for chunk in sorted(chunks, key=lambda item: float(item.get("score", 0)), reverse=True):
            tokens = estimate_tokens(str(chunk.get(content_key) or ""))
            if used + tokens > self.max_tokens and selected:
                continue
            selected.append(chunk)
            used += tokens
            if used >= self.max_tokens:
                break
        return selected
