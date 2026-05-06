from __future__ import annotations

import hashlib

from app.rag.chunking import estimate_tokens


class ContextBudget:
    def __init__(self, max_tokens: int = 3200) -> None:
        self.max_tokens = max_tokens

    def select(self, chunks: list[dict], content_key: str = "content") -> list[dict]:
        selected: list[dict] = []
        seen: set[str] = set()
        used = 0
        for chunk in sorted(chunks, key=self._score, reverse=True):
            content = self._compress(str(chunk.get(content_key) or ""))
            if not content.strip():
                continue
            fingerprint = self._fingerprint(chunk, content)
            if fingerprint in seen:
                continue
            tokens = estimate_tokens(content)
            if used + tokens > self.max_tokens and selected:
                continue
            selected.append({**chunk, content_key: content})
            seen.add(fingerprint)
            used += tokens
            if used >= self.max_tokens:
                break
        return selected

    def _score(self, chunk: dict) -> float:
        score = float(chunk.get("score", 0))
        if chunk.get("symbol_name"):
            score += 0.2
        if chunk.get("file_path"):
            score += 0.12
        if chunk.get("section_title"):
            score += 0.06
        return score

    def _fingerprint(self, chunk: dict, content: str) -> str:
        source = chunk.get("id") or chunk.get("file_path") or chunk.get("filename") or chunk.get("label") or ""
        normalized = " ".join(content.lower().split())
        return hashlib.sha1(f"{source}:{normalized[:1200]}".encode("utf-8")).hexdigest()

    def _compress(self, content: str) -> str:
        max_chars = max(800, self.max_tokens * 4)
        if len(content) <= max_chars:
            return content
        return content[:max_chars].rstrip() + "\n[Context truncated to fit prompt budget.]"
