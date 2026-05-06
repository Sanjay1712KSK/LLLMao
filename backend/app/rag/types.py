from dataclasses import dataclass, field


@dataclass(slots=True)
class ParsedBlock:
    text: str
    section_title: str | None = None
    block_type: str = "paragraph"
    metadata: dict[str, str | int | None] = field(default_factory=dict)


@dataclass(slots=True)
class RagChunk:
    id: str
    document_id: str
    filename: str
    chunk_index: int
    source_type: str
    section_title: str | None
    content: str
    token_count: int
    created_at: str
