from __future__ import annotations

import math
import re
from datetime import UTC, datetime


class RetrievalReranker:
    def rerank(self, query: str, items: list[dict]) -> list[dict]:
        terms = {term.lower() for term in re.findall(r"[A-Za-z_][\w/.-]+", query) if len(term) > 2}
        now = datetime.now(UTC)
        ranked: list[dict] = []
        for item in items:
            score = float(item.get("score", 0))
            haystack = " ".join(
                str(item.get(key) or "") for key in ("title", "summary", "content", "file_path", "symbol_name", "source_type")
            ).lower()
            if terms:
                score += min(sum(1 for term in terms if term in haystack), 8) * 0.08
            score += float(item.get("importance", 0) or 0) * 0.25
            score += min(float(item.get("access_count", 0) or 0), 10) * 0.015
            created_at = item.get("created_at")
            if isinstance(created_at, datetime):
                age_days = max((now - created_at).total_seconds() / 86400, 0)
                score += 0.18 * math.exp(-age_days / 21)
            if item.get("workspace_id"):
                score += 0.08
            if item.get("symbol_name"):
                score += 0.1
            ranked.append({**item, "score": score})
        return sorted(ranked, key=lambda item: float(item.get("score", 0)), reverse=True)
