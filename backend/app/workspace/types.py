from dataclasses import dataclass, field
from datetime import datetime


@dataclass(slots=True)
class CodeChunk:
    id: str
    workspace_id: str
    file_id: str
    file_path: str
    language: str
    chunk_type: str
    symbol_name: str | None
    start_line: int
    end_line: int
    imports: list[str]
    ros2_metadata: dict[str, list[str]]
    content: str
    token_count: int
    last_modified: datetime
    embedding_model: str
    metadata: dict[str, str | int | float | bool | None] = field(default_factory=dict)
