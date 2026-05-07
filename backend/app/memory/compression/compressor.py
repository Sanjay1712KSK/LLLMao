from __future__ import annotations


class ContextCompressor:
    def compress(self, text: str, max_chars: int = 1800) -> str:
        normalized = "\n".join(line.rstrip() for line in text.splitlines() if line.strip())
        if len(normalized) <= max_chars:
            return normalized
        head = normalized[: int(max_chars * 0.72)].rstrip()
        tail = normalized[-int(max_chars * 0.18) :].lstrip()
        return f"{head}\n[Compressed: middle content omitted for prompt budget.]\n{tail}"

    def dedupe(self, items: list[dict], content_key: str = "content") -> list[dict]:
        seen: set[str] = set()
        deduped: list[dict] = []
        for item in items:
            content = " ".join(str(item.get(content_key) or "").lower().split())
            key = content[:900]
            source = str(item.get("id") or item.get("source_id") or item.get("label") or "")
            fingerprint = f"{source}:{key}"
            if not key or fingerprint in seen or key in seen:
                continue
            seen.add(fingerprint)
            seen.add(key)
            deduped.append(item)
        return deduped
