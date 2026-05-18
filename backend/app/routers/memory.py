from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.memory import IntelligentContextOrchestrator
from app.memory.long_term import LongTermMemoryStore
from app.memory.summarization import ConversationSummarizer
from app.models import ConversationSummary, MemoryEntry, OrchestrationLog
from app.rag.vectorstore import MEMORY_COLLECTIONS, chroma_client_manager
from app.schemas import ContextDebugRead, IntelligentChatRequest, MemoryRead, MemoryStatusRead, SummarizeRequest, SummaryRead
from app.services import chat_service
from app.services.ollama_service import OllamaService, OllamaUnavailableError

router = APIRouter(tags=["memory"])


@router.get("/memory/status", response_model=MemoryStatusRead)
def memory_status(db: Session = Depends(get_db)) -> MemoryStatusRead:
    chroma_ok, _ = chroma_client_manager.validate()
    return MemoryStatusRead(
        enabled=True,
        chromadb=chroma_ok,
        entries=int(db.scalar(select(func.count(MemoryEntry.id))) or 0),
        summaries=int(db.scalar(select(func.count(ConversationSummary.id))) or 0),
        collections=list(MEMORY_COLLECTIONS),
    )


@router.post("/memory/summarize", response_model=SummaryRead)
async def summarize_memory(payload: SummarizeRequest, db: Session = Depends(get_db)) -> SummaryRead:
    chat = chat_service.get_chat(db, payload.chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    messages = [{"role": message.role, "content": message.content} for message in chat_service.list_messages(db, payload.chat_id)]
    summarizer = ConversationSummarizer()
    summary = summarizer.summarize_messages(messages)
    token_estimate = summarizer.token_estimate(summary)
    summary_id: str | None = None
    if payload.persist:
        row = ConversationSummary(
            id=str(uuid.uuid4()),
            chat_id=payload.chat_id,
            summary=summary,
            message_count=len(messages),
            token_estimate=token_estimate,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        summary_id = row.id
        await LongTermMemoryStore(get_settings().rag_embedding_model).remember(
            db,
            summary=summary,
            content="\n".join(f"{item['role']}: {item['content']}" for item in messages[-16:]),
            scope=payload.scope,
            chat_id=payload.chat_id,
            workspace_id=payload.workspace_id,
            title=chat.title,
            importance=0.72,
            metadata={"message_count": len(messages), "summary_id": row.id},
        )
    return SummaryRead(id=summary_id, chat_id=payload.chat_id, summary=summary, message_count=len(messages), token_estimate=token_estimate)


@router.get("/memory/retrieve", response_model=list[MemoryRead])
async def retrieve_memory(query: str, workspace_id: str | None = None, limit: int = 8, db: Session = Depends(get_db)) -> list[MemoryRead]:
    memories = await LongTermMemoryStore(get_settings().rag_embedding_model).recall(db, query, workspace_id=workspace_id, limit=limit)
    return [
        MemoryRead(
            id=item["id"],
            collection=item["collection"],
            scope=item["scope"],
            chat_id=item["chat_id"],
            workspace_id=item["workspace_id"],
            title=item["title"],
            summary=item["summary"],
            importance=item["importance"],
            score=item["score"],
            created_at=item["created_at"],
        )
        for item in memories
    ]


@router.get("/context/debug", response_model=list[ContextDebugRead])
def context_debug(chat_id: int | None = None, limit: int = 10, db: Session = Depends(get_db)) -> list[ContextDebugRead]:
    count = max(1, min(limit, 50))
    statement = select(OrchestrationLog).order_by(OrchestrationLog.created_at.desc()).limit(count)
    if chat_id is not None:
        statement = select(OrchestrationLog).where(OrchestrationLog.chat_id == chat_id).order_by(OrchestrationLog.created_at.desc()).limit(count)
    return [
        ContextDebugRead(
            id=row.id,
            chat_id=row.chat_id,
            mode=row.mode,
            query=row.query,
            token_budget=row.token_budget,
            token_estimate=row.token_estimate,
            composition=json.loads(row.composition_json or "{}"),
            created_at=row.created_at,
        )
        for row in db.scalars(statement).all()
    ]


@router.post("/chat/intelligent")
async def intelligent_chat(payload: IntelligentChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    chat = chat_service.get_chat(db, payload.chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.title == "New chat":
        chat_service.rename_chat(db, chat.id, chat_service.title_from_message(payload.message))
    chat_service.add_message(db, payload.chat_id, "user", payload.message)
    orchestrated = await IntelligentContextOrchestrator().build(
        db,
        chat_id=payload.chat_id,
        query=payload.message,
        workspace_id=payload.workspace_id,
        use_workspace=payload.use_workspace,
        use_documents=payload.use_documents,
    )

    async def event_stream():
        assistant_content: list[str] = []
        yield f"event: context\ndata: {json.dumps(orchestrated.composition)}\n\n"
        try:
            async for chunk in OllamaService().stream_chat(payload.model, orchestrated.messages):
                assistant_content.append(chunk)
                yield f"event: token\ndata: {json.dumps(chunk)}\n\n"
        except OllamaUnavailableError as exc:
            yield f"event: token\ndata: {json.dumps(f'[Error: {exc}]')}\n\n"
            return
        finally:
            content = "".join(assistant_content).strip()
            if content:
                chat_service.add_message(db, payload.chat_id, "assistant", content, model_name=payload.model)
                summarizer = ConversationSummarizer()
                summary = summarizer.summarize_messages(
                    [{"role": "user", "content": payload.message}, {"role": "assistant", "content": content}],
                    max_chars=900,
                )
                await LongTermMemoryStore(get_settings().rag_embedding_model).remember(
                    db,
                    summary=summary,
                    content=f"user: {payload.message}\nassistant: {content}",
                    scope="workspace" if payload.workspace_id else "conversation",
                    chat_id=payload.chat_id,
                    workspace_id=payload.workspace_id,
                    title=chat.title,
                    importance=0.62,
                    metadata={"source": "intelligent_chat"},
                )
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
