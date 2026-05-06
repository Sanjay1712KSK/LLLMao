from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete

from app.database.session import SessionLocal
from app.models import Document, DocumentChunk
from app.rag.chunking import SemanticChunker
from app.rag.embeddings import OllamaEmbeddingService
from app.rag.parsers import DocumentParser
from app.rag.vectorstore import ChromaVectorStore

indexing_progress: dict[str, dict[str, int | str]] = {}
indexing_cancellations: set[str] = set()


class DocumentIndexer:
    def __init__(self, embedding_model: str = "nomic-embed-text") -> None:
        self.embedding_model = embedding_model
        self.parser = DocumentParser()
        self.chunker = SemanticChunker()

    async def index(self, document_id: str) -> None:
        db = SessionLocal()
        try:
            document = db.get(Document, document_id)
            if document is None:
                return
            document.status = "indexing"
            document.error_message = None
            db.commit()

            path = Path(document.storage_path)
            blocks = self.parser.parse(path)
            chunks = self.chunker.chunk(blocks, document.id, document.filename, document.file_type)
            indexing_progress[document_id] = {"status": "embedding", "done": 0, "total": len(chunks)}

            embeddings_service = OllamaEmbeddingService(model=self.embedding_model)
            embeddings = []
            for index, chunk in enumerate(chunks, start=1):
                if document_id in indexing_cancellations:
                    document.status = "cancelled"
                    db.commit()
                    indexing_cancellations.discard(document_id)
                    return
                embeddings.append(await embeddings_service.embed(chunk.content))
                indexing_progress[document_id] = {"status": "embedding", "done": index, "total": len(chunks)}

            vectorstore = ChromaVectorStore()
            vectorstore.delete_document(document.id)
            vectorstore.upsert_chunks(chunks, embeddings)

            db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
            for chunk in chunks:
                db.add(
                    DocumentChunk(
                        id=chunk.id,
                        document_id=chunk.document_id,
                        filename=chunk.filename,
                        source_type=chunk.source_type,
                        chunk_index=chunk.chunk_index,
                        section_title=chunk.section_title,
                        token_count=chunk.token_count,
                        content=chunk.content,
                    )
                )
            document.status = "indexed"
            document.indexed_at = datetime.now(UTC)
            document.chunk_count = len(chunks)
            document.embedding_model = self.embedding_model
            db.commit()
            indexing_progress[document_id] = {"status": "indexed", "done": len(chunks), "total": len(chunks)}
        except Exception as exc:
            document = db.get(Document, document_id)
            if document is not None:
                document.status = "failed"
                document.error_message = str(exc)
                db.commit()
            indexing_progress[document_id] = {"status": "failed", "done": 0, "total": 0}
        finally:
            db.close()
