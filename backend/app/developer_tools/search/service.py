from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import CodeSymbol, IndexedFile
from app.workspace.retrieval import WorkspaceRetrievalPipeline


class WorkspaceSearchService:
    async def search(self, db: Session, *, workspace_id: str, query: str, limit: int = 20) -> dict:
        terms = [term for term in re.findall(r"[A-Za-z_][\w/.-]+", query) if len(term) > 1]
        clauses = []
        for term in terms[:6]:
            like = f"%{term}%"
            clauses.extend([IndexedFile.relative_path.ilike(like), CodeSymbol.symbol_name.ilike(like), CodeSymbol.content.ilike(like)])
        keyword = []
        if clauses:
            symbols = db.scalars(select(CodeSymbol).where(CodeSymbol.workspace_id == workspace_id, or_(*clauses)).limit(limit)).all()
            keyword = [
                {
                    "type": "symbol",
                    "path": symbol.file_path,
                    "symbol": symbol.symbol_name,
                    "start_line": symbol.start_line,
                    "end_line": symbol.end_line,
                    "preview": symbol.content[:320],
                }
                for symbol in symbols
            ]
        semantic_chunks = await WorkspaceRetrievalPipeline().retrieve(db, workspace_id, query, limit=min(limit, 8))
        semantic = [
            {
                "type": "semantic",
                "path": chunk.file_path,
                "symbol": chunk.symbol_name,
                "score": chunk.score,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "preview": chunk.content[:320],
            }
            for chunk in semantic_chunks
        ]
        return {"query": query, "keyword": keyword, "semantic": semantic}
