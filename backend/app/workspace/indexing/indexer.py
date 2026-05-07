from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models import CodeSymbol, IndexedFile, Workspace
from app.orchestration.executor import executor
from app.orchestration.scheduler import scheduler
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.vectorstore import ChromaVectorStore, VectorStoreUnavailableError, WORKSPACE_COLLECTION
from app.services.ollama_service import OllamaUnavailableError
from app.workspace.parsers import CodeParser, language_for_path
from app.workspace.types import CodeChunk

workspace_progress: dict[str, dict[str, int | str]] = {}
workspace_cancellations: set[str] = set()
logger = logging.getLogger("lllmao.workspace_indexer")

IGNORED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "build",
    "install",
    "log",
    "dist",
    ".cache",
}
MAX_FILE_BYTES = 750_000


class WorkspaceIndexer:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embedding_model = embedding_model
        self.parser = CodeParser()

    async def index(self, workspace_id: str) -> None:
        if not await scheduler.admit_task("CPU_COMPUTE", "low"):
            logger.warning("workspace_indexing_rejected_by_admission_control", extra={"workspace_id": workspace_id})
            workspace_progress[workspace_id] = {"status": "failed", "done": 0, "total": 0}
            return

        db = SessionLocal()
        try:
            workspace = db.get(Workspace, workspace_id)
            if workspace is None:
                return
            workspace.status = "indexing"
            workspace.error_message = None
            db.commit()

            root = Path(workspace.root_path).expanduser().resolve()
            files = self._scan(root)
            workspace_progress[workspace_id] = {"status": "scanning", "done": 0, "total": len(files)}
            
            try:
                vectorstore = ChromaVectorStore(collection_name=WORKSPACE_COLLECTION)
                vectorstore.delete_workspace(workspace_id)
                vector_error = None
            except VectorStoreUnavailableError as exc:
                vectorstore = None
                vector_error = str(exc)

            embeddings = OllamaEmbeddingService(model=self.embedding_model)
            
            limits = await scheduler.get_runtime_limits()
            concurrency = limits.get("concurrency", 1)
            
            total_symbols = 0
            indexed_file_ids: set[str] = set()
            progress_counter = [0]

            async def _process_file(path: Path) -> None:
                if workspace_id in workspace_cancellations or executor.is_cancelled(workspace_id):
                    return
                # Use a fresh session per worker or share it carefully. 
                # For simplicity in this backpressure model, we open a short-lived session per file
                with SessionLocal() as worker_db:
                    try:
                        file_record, chunks = self._index_file(worker_db, workspace, root, path)
                        indexed_file_ids.add(file_record.id)
                        nonlocal total_symbols
                        total_symbols += len(chunks)
                        
                        if vectorstore is not None and chunks:
                            chunk_embeddings = []
                            for chunk in chunks:
                                chunk_embeddings.append(await embeddings.embed(chunk.content))
                            vectorstore.upsert_records(
                                ids=[chunk.id for chunk in chunks],
                                documents=[chunk.content for chunk in chunks],
                                embeddings=chunk_embeddings,
                                metadatas=[self._metadata(chunk) for chunk in chunks],
                            )
                    except (OllamaUnavailableError, VectorStoreUnavailableError) as exc:
                        logger.warning(
                            "workspace_vector_file_indexing_failed",
                            extra={"workspace_id": workspace_id, "file_path": str(path), "error": str(exc)},
                        )
                    finally:
                        progress_counter[0] += 1
                        workspace_progress[workspace_id] = {"status": "indexing", "done": progress_counter[0], "total": len(files)}

            # Run with execution plane backpressure and preemption
            await executor.run_with_backpressure(
                items=files,
                worker_fn=_process_file,
                concurrency=concurrency,
                task_id=workspace_id,
            )

            if workspace_id in workspace_cancellations or executor.is_cancelled(workspace_id):
                workspace.status = "cancelled"
                db.commit()
                workspace_cancellations.discard(workspace_id)
                return

            existing_files = db.scalars(select(IndexedFile).where(IndexedFile.workspace_id == workspace_id)).all()
            for file_record in existing_files:
                if file_record.id not in indexed_file_ids:
                    db.delete(file_record)
            workspace.status = "indexed"
            workspace.indexed_at = datetime.now(UTC)
            workspace.file_count = len(indexed_file_ids)
            workspace.symbol_count = total_symbols
            workspace.error_message = vector_error
            db.commit()
            workspace_progress[workspace_id] = {"status": "indexed", "done": len(files), "total": len(files)}
            
        except Exception as exc:
            logger.exception("workspace_indexing_crashed", extra={"workspace_id": workspace_id})
            workspace = db.get(Workspace, workspace_id)
            if workspace is not None:
                workspace.status = "failed"
                workspace.error_message = str(exc)
                db.commit()
            workspace_progress[workspace_id] = {"status": "failed", "done": 0, "total": 0}
        finally:
            db.close()

    def _scan(self, root: Path) -> list[Path]:
        files: list[Path] = []
        for path in root.rglob("*"):
            if any(part in IGNORED_DIRS for part in path.parts):
                continue
            if not path.is_file() or language_for_path(path) is None:
                continue
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            files.append(path)
        return sorted(files)

    def _index_file(self, db: Session, workspace: Workspace, root: Path, path: Path) -> tuple[IndexedFile, list[CodeChunk]]:
        relative_path = str(path.relative_to(root))
        stat = path.stat()
        file_id = hashlib.sha1(f"{workspace.id}:{relative_path}".encode("utf-8")).hexdigest()
        language = language_for_path(path) or "text"
        last_modified = datetime.fromtimestamp(stat.st_mtime, UTC)
        file_record = db.get(IndexedFile, file_id)
        
        if file_record is None:
            file_record = IndexedFile(
                id=file_id,
                workspace_id=workspace.id,
                relative_path=relative_path,
                absolute_path=str(path),
                language=language,
                size_bytes=stat.st_size,
                last_modified=last_modified,
            )
            db.add(file_record)
        else:
            file_record.absolute_path = str(path)
            file_record.language = language
            file_record.size_bytes = stat.st_size
            file_record.last_modified = last_modified
        file_record.status = "indexed"
        file_record.indexed_at = datetime.now(UTC)

        db.execute(delete(CodeSymbol).where(CodeSymbol.file_id == file_id))
        chunks = self.parser.parse(path, workspace.id, file_id, relative_path, language, last_modified, self.embedding_model)
        for chunk in chunks:
            db.add(
                CodeSymbol(
                    id=chunk.id,
                    workspace_id=chunk.workspace_id,
                    file_id=chunk.file_id,
                    file_path=chunk.file_path,
                    language=chunk.language,
                    chunk_type=chunk.chunk_type,
                    symbol_name=chunk.symbol_name,
                    start_line=chunk.start_line,
                    end_line=chunk.end_line,
                    imports=json.dumps(chunk.imports),
                    ros2_metadata=json.dumps(chunk.ros2_metadata),
                    content=chunk.content,
                    token_count=chunk.token_count,
                    last_modified=chunk.last_modified,
                    embedding_model=chunk.embedding_model,
                )
            )
        file_record.chunk_count = len(chunks)
        db.commit()
        db.refresh(file_record)
        return file_record, chunks

    def _metadata(self, chunk: CodeChunk) -> dict[str, str | int | float | bool | None]:
        # Provide hash for embedding invalidation and versioning
        chunk_hash = hashlib.sha1(f"{chunk.embedding_model}:{chunk.content}".encode("utf-8")).hexdigest()
        metadata = {
            "workspace_id": chunk.workspace_id,
            "file_path": chunk.file_path,
            "language": chunk.language,
            "chunk_type": chunk.chunk_type,
            "symbol_name": chunk.symbol_name or "",
            "start_line": chunk.start_line,
            "end_line": chunk.end_line,
            "imports": ", ".join(chunk.imports[:20]),
            "last_modified": chunk.last_modified.isoformat(),
            "embedding_model": chunk.embedding_model,
            "embedding_model_hash": chunk_hash,
        }
        for key, value in chunk.ros2_metadata.items():
            metadata[f"ros2_{key}"] = ", ".join(str(item) for item in value[:20])
        return metadata
