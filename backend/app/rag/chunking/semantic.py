from __future__ import annotations

import re
from datetime import UTC, datetime

from app.rag.types import ParsedBlock, RagChunk


def estimate_tokens(text: str) -> int:
    words = re.findall(r"\S+", text)
    return max(1, int(len(words) * 1.3))


class SemanticChunker:
    def __init__(self, target_tokens: int = 500, overlap_tokens: int = 90) -> None:
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens

    def chunk(self, blocks: list[ParsedBlock], document_id: str, filename: str, source_type: str) -> list[RagChunk]:
        chunks: list[RagChunk] = []
        current: list[ParsedBlock] = []
        current_tokens = 0

        for block in [item for item in blocks if item.text.strip()]:
            block_tokens = estimate_tokens(block.text)
            boundary = block.block_type in {"heading", "section"} and current_tokens >= self.target_tokens * 0.55
            oversized = current and current_tokens + block_tokens > self.target_tokens
            if boundary or oversized:
                chunks.append(self._build_chunk(current, document_id, filename, source_type, len(chunks)))
                current = self._overlap_blocks(current)
                current_tokens = sum(estimate_tokens(item.text) for item in current)

            if block_tokens > self.target_tokens * 1.4 and block.block_type not in {"code", "table"}:
                for split_block in self._split_large_block(block):
                    if current and current_tokens + estimate_tokens(split_block.text) > self.target_tokens:
                        chunks.append(self._build_chunk(current, document_id, filename, source_type, len(chunks)))
                        current = self._overlap_blocks(current)
                        current_tokens = sum(estimate_tokens(item.text) for item in current)
                    current.append(split_block)
                    current_tokens += estimate_tokens(split_block.text)
                continue

            current.append(block)
            current_tokens += block_tokens

        if current:
            chunks.append(self._build_chunk(current, document_id, filename, source_type, len(chunks)))
        return chunks

    def _build_chunk(
        self,
        blocks: list[ParsedBlock],
        document_id: str,
        filename: str,
        source_type: str,
        chunk_index: int,
    ) -> RagChunk:
        section_title = next((block.section_title for block in reversed(blocks) if block.section_title), None)
        content = "\n\n".join(block.text.strip() for block in blocks if block.text.strip())
        return RagChunk(
            id=f"{document_id}:{chunk_index}",
            document_id=document_id,
            filename=filename,
            chunk_index=chunk_index,
            source_type=source_type,
            section_title=section_title,
            content=content,
            token_count=estimate_tokens(content),
            created_at=datetime.now(UTC).isoformat(),
        )

    def _overlap_blocks(self, blocks: list[ParsedBlock]) -> list[ParsedBlock]:
        overlap: list[ParsedBlock] = []
        total = 0
        for block in reversed(blocks):
            overlap.insert(0, block)
            total += estimate_tokens(block.text)
            if total >= self.overlap_tokens:
                break
        return overlap

    def _split_large_block(self, block: ParsedBlock) -> list[ParsedBlock]:
        sentences = re.split(r"(?<=[.!?])\s+", block.text.strip())
        splits: list[ParsedBlock] = []
        current: list[str] = []
        total = 0
        for sentence in sentences:
            sentence_tokens = estimate_tokens(sentence)
            if current and total + sentence_tokens > self.target_tokens:
                splits.append(ParsedBlock(" ".join(current), block.section_title, block.block_type, block.metadata))
                current = []
                total = 0
            current.append(sentence)
            total += sentence_tokens
        if current:
            splits.append(ParsedBlock(" ".join(current), block.section_title, block.block_type, block.metadata))
        return splits
