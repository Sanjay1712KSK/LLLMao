from __future__ import annotations

from app.rag.chunking import estimate_tokens


class TokenBudgetManager:
    def __init__(self, max_tokens: int = 4200) -> None:
        self.max_tokens = max_tokens

    def select(self, items: list[dict], content_key: str = "content") -> tuple[list[dict], int]:
        selected: list[dict] = []
        used = 0
        for item in sorted(items, key=lambda value: float(value.get("score", 0)), reverse=True):
            content = str(item.get(content_key) or "")
            tokens = estimate_tokens(content)
            if used + tokens > self.max_tokens and selected:
                continue
            selected.append({**item, "token_estimate": tokens})
            used += tokens
            if used >= self.max_tokens:
                break
        return selected, used

    def trim_history(self, history: list[dict[str, str]], budget: int = 1200) -> list[dict[str, str]]:
        selected: list[dict[str, str]] = []
        used = 0
        for message in reversed(history):
            tokens = estimate_tokens(message.get("content", ""))
            if selected and used + tokens > budget:
                break
            selected.append(message)
            used += tokens
        return list(reversed(selected))
