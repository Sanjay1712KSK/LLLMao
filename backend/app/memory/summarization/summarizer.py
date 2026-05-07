from __future__ import annotations

import re

from app.rag.chunking import estimate_tokens


class ConversationSummarizer:
    technical_terms = re.compile(r"\b(ros2|node|topic|service|launch|isaac|sim|error|bug|index|rag|chroma|ollama|gpu|vram|pdf|workspace)\b", re.I)

    def summarize_messages(self, messages: list[dict[str, str]], max_chars: int = 1600) -> str:
        if not messages:
            return "No conversation content to summarize."
        candidates: list[str] = []
        for message in messages:
            role = message.get("role", "user")
            content = " ".join(message.get("content", "").split())
            if not content:
                continue
            if role == "user" or self.technical_terms.search(content):
                candidates.append(f"{role}: {content[:420]}")
        if not candidates:
            candidates = [f"{item.get('role', 'message')}: {' '.join(item.get('content', '').split())[:320]}" for item in messages[-6:]]
        summary = "\n".join(candidates[-10:])
        if len(summary) > max_chars:
            summary = summary[:max_chars].rstrip() + "\n[Summary truncated.]"
        return summary

    def token_estimate(self, summary: str) -> int:
        return estimate_tokens(summary)
