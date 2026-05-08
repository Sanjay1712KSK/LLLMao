import logging
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings

logger = logging.getLogger("lllmao.audio.utils")
settings = get_settings()

def get_audio_dir(chat_id: int | None = None) -> Path:
    base = Path(settings.chat_media_path)
    if chat_id:
        p = base / str(chat_id) / "audio"
    else:
        p = base / "unassigned" / "audio"
    p.mkdir(parents=True, exist_ok=True)
    return p

def get_generated_dir(chat_id: int | None = None) -> Path:
    base = Path(settings.chat_media_path)
    if chat_id:
        p = base / str(chat_id) / "generated"
    else:
        p = base / "unassigned" / "generated"
    p.mkdir(parents=True, exist_ok=True)
    return p

async def save_upload(file: UploadFile, chat_id: int | None = None) -> tuple[str, str]:
    """Saves an uploaded file and returns the generated UUID and storage path."""
    attachment_id = str(uuid.uuid4())
    ext = Path(file.filename or "audio.webm").suffix
    if not ext:
        ext = ".webm"
        
    dest_dir = get_audio_dir(chat_id)
    storage_path = dest_dir / f"{attachment_id}{ext}"
    
    with open(storage_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return attachment_id, str(storage_path)
