from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import get_settings
from app.memory.compression import ContextCompressor
from app.memory.long_term import LongTermMemoryStore
from app.memory.reranking import RetrievalReranker
from app.memory.token_management import TokenBudgetManager
from app.models import OrchestrationLog, RetrievalRanking
from app.rag.retrieval.pipeline import RagRetrievalPipeline
from app.rag.vectorstore import VectorStoreUnavailableError
from app.services import chat_service
from app.services.ollama_service import OllamaUnavailableError
from app.workspace.retrieval import WorkspaceRetrievalPipeline


@dataclass(slots=True)
class OrchestratedPrompt:
    messages: list[dict[str, str]]
    composition: dict
    token_estimate: int
    selected_context: list[dict]


class IntelligentContextOrchestrator:
    def __init__(self, token_budget: int | None = None) -> None:
        settings = get_settings()
        self.embedding_model = settings.rag_embedding_model
        self.token_budget = token_budget or max(settings.context_token_budget, 4200)
        self.budget = TokenBudgetManager(self.token_budget)
        self.compressor = ContextCompressor()
        self.reranker = RetrievalReranker()
        self.memory = LongTermMemoryStore(self.embedding_model)

    async def build(
        self,
        db: Session,
        *,
        chat_id: int,
        query: str,
        workspace_id: str | None = None,
        use_workspace: bool = True,
        use_documents: bool = True,
    ) -> OrchestratedPrompt:
        history_rows = chat_service.list_messages(db, chat_id)
        history = [{"role": row.role, "content": row.content} for row in history_rows if row.role in {"user", "assistant"}]
        memories = await self.memory.recall(db, query, workspace_id=workspace_id, limit=8)
        contexts: list[dict] = [
            {
                "source_type": "memory",
                "source_id": item["id"],
                "title": item["title"] or item["scope"],
                "content": self.compressor.compress(item["summary"], 1200),
                "score": item["score"],
                "importance": item["importance"],
                "created_at": item["created_at"],
                "workspace_id": item["workspace_id"],
            }
            for item in memories
        ]
        if use_documents:
            contexts.extend(await self._document_context(query))
        if use_workspace and workspace_id:
            contexts.extend(await self._workspace_context(db, workspace_id, query))
        contexts = self.compressor.dedupe(self.reranker.rerank(query, contexts))
        selected, context_tokens = self.budget.select(contexts)
        trimmed_history = self.budget.trim_history(history[:-1] if history and history[-1]["content"] == query else history)
        context_text = "\n\n---\n\n".join(
            f"[{index}. {item.get('source_type')} | score {float(item.get('score', 0)):.2f} | {item.get('title') or item.get('source_id')}]\n{item.get('content')}"
            for index, item in enumerate(selected, start=1)
        )
        system = (
            "You are LLLMao, a local-only memory-aware workspace assistant. "
            "Use recent conversation, recalled long-term memory, documents, and workspace context only when relevant. "
            "Prefer precise technical continuity over generic answers. If recalled context is uncertain, say what is known and what needs verification.\n\n"
            "Selected context:\n"
            + (context_text if context_text else "No relevant memory or retrieval context selected.")
        )
        messages = [{"role": "system", "content": system}, *trimmed_history, {"role": "user", "content": query}]
        token_estimate = context_tokens + sum(self.budget.select([{"content": message.get("content", ""), "score": 1}])[1] for message in messages)
        composition = {
            "memory_count": len([item for item in selected if item.get("source_type") == "memory"]),
            "document_count": len([item for item in selected if item.get("source_type") == "document"]),
            "workspace_count": len([item for item in selected if item.get("source_type") == "workspace"]),
            "selected_count": len(selected),
            "candidate_count": len(contexts),
            "history_count": len(trimmed_history),
            "token_estimate": token_estimate,
            "token_budget": self.token_budget,
            "sources": [
                {
                    "source_type": item.get("source_type"),
                    "source_id": item.get("source_id"),
                    "title": item.get("title"),
                    "score": item.get("score"),
                    "token_estimate": item.get("token_estimate"),
                }
                for item in selected
            ],
        }
        self._log(db, chat_id, query, composition, token_estimate, selected)
        return OrchestratedPrompt(messages, composition, token_estimate, selected)

    async def _document_context(self, query: str) -> list[dict]:
        try:
            chunks = await RagRetrievalPipeline(self.embedding_model).retrieve(query, limit=6)
        except (OllamaUnavailableError, VectorStoreUnavailableError):
            return []
        return [
            {
                "source_type": "document",
                "source_id": chunk.id,
                "title": f"{chunk.filename} / {chunk.section_title or 'chunk'}",
                "content": self.compressor.compress(chunk.content),
                "score": chunk.score,
            }
            for chunk in chunks
        ]

    async def _workspace_context(self, db: Session, workspace_id: str, query: str) -> list[dict]:
        chunks = await WorkspaceRetrievalPipeline(self.embedding_model).retrieve(db, workspace_id, query, limit=8)
        return [
            {
                "source_type": "workspace",
                "source_id": chunk.id,
                "title": f"{chunk.file_path}:{chunk.start_line}-{chunk.end_line}",
                "file_path": chunk.file_path,
                "symbol_name": chunk.symbol_name,
                "workspace_id": workspace_id,
                "content": self.compressor.compress(chunk.content),
                "score": chunk.score,
            }
            for chunk in chunks
        ]

    def _log(self, db: Session, chat_id: int, query: str, composition: dict, token_estimate: int, selected: list[dict]) -> None:
        log_id = str(uuid.uuid4())
        db.add(
            OrchestrationLog(
                id=log_id,
                chat_id=chat_id,
                mode="intelligent",
                query=query,
                token_budget=self.token_budget,
                token_estimate=token_estimate,
                composition_json=json.dumps(composition),
            )
        )
        for item in selected:
            db.add(
                RetrievalRanking(
                    id=str(uuid.uuid4()),
                    chat_id=chat_id,
                    query=query,
                    source_type=str(item.get("source_type") or "context"),
                    source_id=str(item.get("source_id") or item.get("title") or ""),
                    score=float(item.get("score", 0)),
                    metadata_json=json.dumps({key: item.get(key) for key in ("title", "token_estimate", "workspace_id")}),
                )
            )
        db.commit()
