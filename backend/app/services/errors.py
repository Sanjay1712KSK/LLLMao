from __future__ import annotations

from fastapi.responses import JSONResponse


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
