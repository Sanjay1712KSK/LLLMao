from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.database.init_db import init_db
from app.routers import audio, chat, developer_tools, health, memory, models, multimodal, orchestration, rag, runtime, stats, workspace
from app.services.exception_handlers import http_exception_handler, unhandled_exception_handler, validation_exception_handler
from app.services.health import dependency_checker
from app.services.logging import configure_logging

settings = get_settings()
configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    await dependency_checker.startup_check()
    
    from app.audio.cleanup import cleanup_stale_audio
    import asyncio
    asyncio.create_task(asyncio.to_thread(cleanup_stale_audio, 7))
    yield


app = FastAPI(
    title=settings.app_name,
    description="Local-only workspace API for already-installed Ollama models.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(models.router, prefix=settings.api_prefix)
app.include_router(stats.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(memory.router, prefix=settings.api_prefix)
app.include_router(developer_tools.router, prefix=settings.api_prefix)
app.include_router(rag.router, prefix=settings.api_prefix)
app.include_router(workspace.router, prefix=settings.api_prefix)
app.include_router(multimodal.router, prefix=settings.api_prefix)
app.include_router(orchestration.router, prefix=settings.api_prefix)
app.include_router(audio.router, prefix=settings.api_prefix)
app.include_router(runtime.router, prefix=settings.api_prefix)
