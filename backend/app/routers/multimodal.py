from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import ContextSession, ImageAsset, RetrievalLog
from app.multimodal.prompt_orchestration import PromptOrchestrator
from app.multimodal.retrieval_fusion import RetrievalFusion
from app.multimodal.storage import ImageStore
from app.schemas import ImageRead, MultimodalChatRequest, RetrievalDebugRead
from app.services import chat_service
from app.services.ollama_service import OllamaService, OllamaUnavailableError

router = APIRouter(tags=["multimodal"])


@router.post("/images/upload", response_model=ImageRead, status_code=status.HTTP_201_CREATED)
async def upload_image(chat_id: int | None = None, file: UploadFile = File(...), db: Session = Depends(get_db)) -> ImageRead:
    if chat_id is not None and chat_service.get_chat(db, chat_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    try:
        image = await ImageStore().save_upload(file, chat_id=chat_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    db.add(image)
    db.commit()
    db.refresh(image)
    return ImageRead.model_validate(image)


@router.get("/images/{image_id}", response_model=ImageRead)
def get_image(image_id: str, db: Session = Depends(get_db)) -> ImageRead:
    image = db.get(ImageAsset, image_id)
    if image is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return ImageRead.model_validate(image)


@router.get("/images/{image_id}/file")
def get_image_file(image_id: str, db: Session = Depends(get_db)) -> FileResponse:
    image = db.get(ImageAsset, image_id)
    if image is None or not Path(image.storage_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
    return FileResponse(image.storage_path, media_type=image.mime_type, filename=image.filename)


@router.get("/images/{image_id}/thumbnail")
def get_image_thumbnail(image_id: str, db: Session = Depends(get_db)) -> FileResponse:
    image = db.get(ImageAsset, image_id)
    if image is None or not image.thumbnail_path or not Path(image.thumbnail_path).exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not found")
    return FileResponse(image.thumbnail_path, media_type="image/jpeg", filename=f"{image.id}.thumb.jpg")


@router.post("/multimodal/chat")
async def stream_multimodal_chat(payload: MultimodalChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    chat = chat_service.get_chat(db, payload.chat_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    if chat.title == "New chat":
        chat_service.rename_chat(db, chat.id, chat_service.title_from_message(payload.message))

    images = db.scalars(select(ImageAsset).where(ImageAsset.id.in_(payload.image_ids))).all() if payload.image_ids else []
    if len(images) != len(payload.image_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more images were not found")

    settings = get_settings()
    workspace_context = await RetrievalFusion().workspace_context(db, payload.workspace_id if payload.use_workspace else None, payload.message)
    image_payloads = [ImageStore().as_ollama_base64(image) for image in images]
    history = chat_service.list_messages(db, payload.chat_id)
    history_payload = [
        {"role": message.role, "content": message.content}
        for message in history
        if message.role in {"user", "assistant"}
    ]
    orchestrated = PromptOrchestrator(settings.context_token_budget).build(
        payload.message,
        history_payload,
        list(images),
        workspace_context,
        [],
        image_payloads,
    )

    db.add(
        RetrievalLog(
            id=str(uuid.uuid4()),
            chat_id=payload.chat_id,
            mode="multimodal",
            query=payload.message,
            sources_json=json.dumps(orchestrated.sources),
            context_summary=orchestrated.summary,
            token_budget=settings.context_token_budget,
        )
    )
    db.add(
        ContextSession(
            id=str(uuid.uuid4()),
            chat_id=payload.chat_id,
            mode="multimodal",
            image_ids_json=json.dumps(payload.image_ids),
            workspace_id=payload.workspace_id if payload.use_workspace else None,
            workspace_context_count=len(workspace_context),
            document_context_count=0,
            prompt_tokens_estimate=orchestrated.token_estimate,
        )
    )
    chat_service.add_message(db, payload.chat_id, "user", payload.message)
    db.commit()

    source_payload = [
        {
            "file_path": source.get("file_path") or source.get("label") or "image/context",
            "language": "context",
            "chunk_type": source.get("kind", "context"),
            "symbol_name": source.get("symbol_name"),
            "start_line": source.get("start_line", 1),
            "end_line": source.get("end_line", 1),
            "score": source.get("score", 0),
        }
        for source in orchestrated.sources
    ]

    async def event_stream():
        assistant_content: list[str] = []
        yield f"event: sources\ndata: {json.dumps(source_payload)}\n\n"
        yield f"event: context\ndata: {json.dumps({'summary': orchestrated.summary, 'tokens': orchestrated.token_estimate})}\n\n"
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
                chat_service.add_message(db, payload.chat_id, "assistant", content)
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/retrieval/debug", response_model=list[RetrievalDebugRead])
def retrieval_debug(chat_id: int | None = None, limit: int = 20, db: Session = Depends(get_db)) -> list[RetrievalDebugRead]:
    count = max(1, min(limit, 100))
    statement = select(RetrievalLog).order_by(RetrievalLog.created_at.desc()).limit(count)
    if chat_id is not None:
        statement = select(RetrievalLog).where(RetrievalLog.chat_id == chat_id).order_by(RetrievalLog.created_at.desc()).limit(count)
    logs = db.scalars(statement).all()
    return [
        RetrievalDebugRead(
            id=log.id,
            chat_id=log.chat_id,
            mode=log.mode,
            query=log.query,
            sources=json.loads(log.sources_json or "[]"),
            context_summary=log.context_summary,
            token_budget=log.token_budget,
            created_at=log.created_at,
        )
        for log in logs
    ]
