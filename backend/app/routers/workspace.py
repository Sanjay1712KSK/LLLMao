from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import IndexedFile, Workspace
from app.rag.vectorstore import ChromaVectorStore, VectorStoreUnavailableError
from app.schemas import IndexedFileRead, WorkspaceChatRequest, WorkspaceConnectRequest, WorkspaceRead
from app.services import chat_service
from app.services.ollama_service import OllamaService, OllamaUnavailableError
from app.workspace.indexing import WorkspaceIndexer, workspace_cancellations, workspace_progress
from app.workspace.retrieval import WorkspaceRetrievalPipeline, build_workspace_messages
from app.workspace.watcher import workspace_watcher

router = APIRouter(tags=["workspace"])


def _workspace_read(workspace: Workspace) -> WorkspaceRead:
    payload = WorkspaceRead.model_validate(workspace)
    progress = workspace_progress.get(workspace.id) or {}
    return payload.model_copy(
        update={
            "progress_done": int(progress.get("done") or workspace.file_count or 0),
            "progress_total": int(progress.get("total") or workspace.file_count or 0),
        }
    )


@router.post("/workspace/connect", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
def connect_workspace(payload: WorkspaceConnectRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> WorkspaceRead:
    root = Path(payload.path).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace path must be an existing directory")

    existing = db.scalar(select(Workspace).where(Workspace.root_path == str(root)))
    settings = get_settings()
    if existing is not None:
        existing.status = "queued"
        existing.error_message = None
        db.commit()
        db.refresh(existing)
        background_tasks.add_task(WorkspaceIndexer(settings.rag_embedding_model).index, existing.id)
        workspace_watcher.start(existing.id, existing.root_path, settings.rag_embedding_model)
        return _workspace_read(existing)

    workspace = Workspace(
        id=str(uuid.uuid4()),
        name=payload.name or root.name,
        root_path=str(root),
        status="queued",
        embedding_model=settings.rag_embedding_model,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    background_tasks.add_task(WorkspaceIndexer(settings.rag_embedding_model).index, workspace.id)
    workspace_watcher.start(workspace.id, workspace.root_path, settings.rag_embedding_model)
    return _workspace_read(workspace)


@router.get("/workspaces", response_model=list[WorkspaceRead])
def list_workspaces(db: Session = Depends(get_db)) -> list[WorkspaceRead]:
    workspaces = db.scalars(select(Workspace).order_by(Workspace.updated_at.desc(), Workspace.created_at.desc())).all()
    return [_workspace_read(workspace) for workspace in workspaces]


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_workspace(workspace_id: str, db: Session = Depends(get_db)) -> None:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    workspace_cancellations.add(workspace_id)
    workspace_watcher.stop(workspace_id)
    try:
        ChromaVectorStore(collection_name="lllmao_workspace").delete_workspace(workspace_id)
    except VectorStoreUnavailableError:
        pass
    db.delete(workspace)
    db.commit()


@router.post("/workspace/{workspace_id}/reindex", response_model=WorkspaceRead)
def reindex_workspace(workspace_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> WorkspaceRead:
    workspace = db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    workspace.status = "queued"
    workspace.error_message = None
    db.commit()
    db.refresh(workspace)
    background_tasks.add_task(WorkspaceIndexer(get_settings().rag_embedding_model).index, workspace.id)
    return _workspace_read(workspace)


@router.get("/workspace/{workspace_id}/files", response_model=list[IndexedFileRead])
def list_workspace_files(workspace_id: str, db: Session = Depends(get_db)) -> list[IndexedFileRead]:
    if db.get(Workspace, workspace_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    files = db.scalars(
        select(IndexedFile).where(IndexedFile.workspace_id == workspace_id).order_by(IndexedFile.relative_path.asc())
    ).all()
    return [IndexedFileRead.model_validate(file) for file in files]


@router.post("/workspace/chat")
async def stream_workspace_chat(payload: WorkspaceChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    chat = chat_service.get_chat(db, payload.chat_id)
    workspace = db.get(Workspace, payload.workspace_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    if workspace is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    if chat.title == "New chat":
        chat_service.rename_chat(db, chat.id, chat_service.title_from_message(payload.message))

    chunks = await WorkspaceRetrievalPipeline(get_settings().rag_embedding_model).retrieve(db, workspace.id, payload.message)
    chat_service.add_message(db, payload.chat_id, "user", payload.message)
    history = chat_service.list_messages(db, payload.chat_id)
    history_payload = [
        {"role": message.role, "content": message.content}
        for message in history
        if message.role in {"user", "assistant"}
    ]
    ollama_messages = build_workspace_messages(history_payload[:-1], payload.message, chunks)
    sources = [
        {
            "file_path": chunk.file_path,
            "language": chunk.language,
            "chunk_type": chunk.chunk_type,
            "symbol_name": chunk.symbol_name,
            "start_line": chunk.start_line,
            "end_line": chunk.end_line,
            "score": chunk.score,
        }
        for chunk in chunks
    ]

    async def event_stream():
        assistant_content: list[str] = []
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        try:
            async for chunk in OllamaService().stream_chat(payload.model, ollama_messages):
                assistant_content.append(chunk)
                yield f"event: token\ndata: {json.dumps(chunk)}\n\n"
        except OllamaUnavailableError as exc:
            yield f"event: token\ndata: {json.dumps(f'[Error: {exc}]')}\n\n"
            return
        finally:
            content = "".join(assistant_content).strip()
            if content:
                chat_service.add_message(db, payload.chat_id, "assistant", content)
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
