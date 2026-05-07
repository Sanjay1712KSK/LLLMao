from __future__ import annotations

import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette import status

logger = logging.getLogger("lllmao.api")


def structured_payload(code: str, message: str, details: str) -> dict:
    return {"error": True, "code": code, "message": message, "details": details}


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and exc.detail.get("error"):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    message = str(exc.detail) if exc.detail else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content=structured_payload("REQUEST_FAILED", message, "The backend rejected this request."),
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("request_validation_failed", extra={"validation_errors": str(exc.errors())[:1200]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=structured_payload("VALIDATION_FAILED", "Request validation failed.", "Check request fields and upload form data."),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_api_exception", extra={"path": request.url.path, "method": request.method})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=structured_payload("BACKEND_ERROR", "Backend request failed.", "Check backend logs for technical details."),
    )
