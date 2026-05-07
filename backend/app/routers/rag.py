from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Document, DocumentChunk
from app.rag.indexing import DocumentIndexer, indexing_cancellations, indexing_progress
from app.rag.parsers import DocumentParser
from app.rag.retrieval.pipeline import RagRetrievalPipeline, build_contextual_messages
from app.rag.vectorstore import ChromaVectorStore, VectorStoreUnavailableError, chroma_client_manager
from app.schemas import DocumentChunkRead, DocumentRead, RagChatRequest
from app.services import chat_service
from app.services.errors import chromadb_unavailable, structured_error
from app.services.ollama_service import OllamaService, OllamaUnavailableError

router = APIRouter(tags=["rag"])
logger = logging.getLogger("lllmao.rag")


def _file_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    return "md" if suffix == "markdown" else suffix


def _document_read(document: Document) -> DocumentRead:
    payload = DocumentRead.model_validate(document)
    progress = indexing_progress.get(document.id) or {}
    return payload.model_copy(
        update={
            "progress_done": int(progress.get("done") or document.chunk_count or 0),
            "progress_total": int(progress.get("total") or document.chunk_count or 0),
        }
    )


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DocumentRead | JSONResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in DocumentParser.supported_extensions:
        return structured_error(
            "UNSUPPORTED_DOCUMENT_TYPE",
            "Unsupported document type.",
            f"Supported extensions: {', '.join(sorted(DocumentParser.supported_extensions))}",
            status.HTTP_400_BAD_REQUEST,
        )

    chroma_ok, chroma_details = chroma_client_manager.validate()
    if not chroma_ok:
        logger.warning("document_upload_chromadb_unavailable", extra={"filename": file.filename, "details": chroma_details})
        return chromadb_unavailable()

    settings = get_settings()
    upload_dir = Path(settings.upload_path)
    upload_dir.mkdir(parents=True, exist_ok=True)
    document_id = str(uuid.uuid4())
    safe_name = Path(file.filename or f"document{suffix}").name
    storage_path = upload_dir / f"{document_id}{suffix}"
    try:
        with storage_path.open("wb") as handle:
            shutil.copyfileobj(file.file, handle)
    except OSError as exc:
        logger.exception("document_upload_write_failed", extra={"filename": safe_name})
        return structured_error(
            "DOCUMENT_UPLOAD_FAILED",
            "Document upload failed.",
            "Backend could not save the uploaded file.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    document = Document(
        id=document_id,
        filename=safe_name,
        file_type=_file_type(safe_name),
        storage_path=str(storage_path),
        status="queued",
        embedding_model=settings.rag_embedding_model,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    background_tasks.add_task(DocumentIndexer(settings.rag_embedding_model).index, document.id)
    return _document_read(document)


@router.get("/documents", response_model=list[DocumentRead])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentRead]:
    documents = db.scalars(select(Document).order_by(Document.created_at.desc())).all()
    return [_document_read(document) for document in documents]


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, db: Session = Depends(get_db)) -> None:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    indexing_cancellations.add(document_id)
    try:
        ChromaVectorStore().delete_document(document_id)
    except VectorStoreUnavailableError:
        pass
    storage_path = Path(document.storage_path)
    db.delete(document)
    db.commit()
    if storage_path.exists():
        storage_path.unlink()


@router.post("/documents/{document_id}/reindex", response_model=DocumentRead)
def reindex_document(document_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)) -> DocumentRead:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    document.status = "queued"
    document.error_message = None
    db.commit()
    db.refresh(document)
    background_tasks.add_task(DocumentIndexer(get_settings().rag_embedding_model).index, document.id)
    return _document_read(document)


@router.post("/documents/{document_id}/cancel", response_model=DocumentRead)
def cancel_indexing(document_id: str, db: Session = Depends(get_db)) -> DocumentRead:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    indexing_cancellations.add(document_id)
    document.status = "cancelling"
    db.commit()
    db.refresh(document)
    return _document_read(document)


@router.get("/documents/{document_id}/chunks", response_model=list[DocumentChunkRead])
def list_document_chunks(document_id: str, db: Session = Depends(get_db)) -> list[DocumentChunkRead]:
    if db.get(Document, document_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    chunks = db.scalars(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index.asc())
    ).all()
    return [DocumentChunkRead.model_validate(chunk) for chunk in chunks]


@router.post("/rag/chat")
async def stream_rag_chat(payload: RagChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    chat = chat_service.get_chat(db, payload.chat_id)
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    if chat.title == "New chat":
        chat_service.rename_chat(db, chat.id, chat_service.title_from_message(payload.message))

    settings = get_settings()
    try:
        chunks = await RagRetrievalPipeline(settings.rag_embedding_model).retrieve(payload.message, settings.rag_retrieval_limit)
    except (OllamaUnavailableError, VectorStoreUnavailableError) as exc:
        logger.warning("rag_retrieval_failed", extra={"chat_id": payload.chat_id, "error": str(exc)})
        return chromadb_unavailable() if isinstance(exc, VectorStoreUnavailableError) else structured_error(
            "OLLAMA_UNAVAILABLE",
            "Ollama unavailable.",
            "Local Ollama API is not reachable.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    chat_service.add_message(db, payload.chat_id, "user", payload.message)
    history = chat_service.list_messages(db, payload.chat_id)
    history_payload = [
        {"role": message.role, "content": message.content}
        for message in history
        if message.role in {"user", "assistant"}
    ]
    ollama_messages = build_contextual_messages(history_payload[:-1], payload.message, chunks)
    source_payload = [
        {
            "filename": chunk.filename,
            "section_title": chunk.section_title,
            "chunk_index": chunk.chunk_index,
            "source_type": chunk.source_type,
            "distance": chunk.distance,
            "score": chunk.score,
        }
        for chunk in chunks
    ]

    async def event_stream():
        assistant_content: list[str] = []
        yield f"event: sources\ndata: {json.dumps(source_payload)}\n\n"
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
