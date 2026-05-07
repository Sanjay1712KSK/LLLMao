from __future__ import annotations

from fastapi.responses import JSONResponse
from starlette import status


def structured_error(code: str, message: str, details: str, status_code: int) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": True,
            "code": code,
            "message": message,
            "details": details,
        },
    )


def chromadb_unavailable() -> JSONResponse:
    return structured_error(
        "CHROMADB_UNAVAILABLE",
        "Vector database unavailable.",
        "ChromaDB dependency missing or failed to initialize.",
        503,
    )


def upload_processing_failed() -> JSONResponse:
    return structured_error(
        "UPLOAD_PROCESSING_FAILED",
        "File upload failed.",
        "Backend upload pipeline encountered an error.",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
