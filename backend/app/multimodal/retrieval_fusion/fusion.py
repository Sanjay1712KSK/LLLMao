from __future__ import annotations

from sqlalchemy.orm import Session

from app.workspace.retrieval import WorkspaceRetrievalPipeline


class RetrievalFusion:
    async def workspace_context(self, db: Session, workspace_id: str | None, query: str) -> list[dict]:
        if not workspace_id:
            return []
        chunks = await WorkspaceRetrievalPipeline().retrieve(db, workspace_id, query, limit=6)
        return [
            {
                "kind": "workspace",
                "label": f"{chunk.file_path}:{chunk.start_line}-{chunk.end_line}",
                "file_path": chunk.file_path,
                "symbol_name": chunk.symbol_name,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "score": chunk.score,
                "content": chunk.content,
            }
            for chunk in chunks
        ]
