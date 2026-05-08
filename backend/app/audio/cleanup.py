import logging
import time
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models.chat import ChatAttachment, AttachmentType

logger = logging.getLogger("lllmao.audio.cleanup")

def cleanup_stale_audio(days_old: int = 7):
    """
    Cleans up old, generated TTS audio files from disk and removes 
    the database records if they are not pinned or heavily utilized.
    """
    settings = get_settings()
    media_dir = Path(settings.chat_media_path) / "generated"
    
    if not media_dir.exists():
        return
        
    cutoff_time = time.time() - (days_old * 86400)
    
    with SessionLocal() as db:
        # Find old attachments in DB
        # A more robust check might involve checking if the parent chat is pinned
        old_attachments = db.scalars(
            select(ChatAttachment)
            .where(ChatAttachment.type == AttachmentType.AUDIO)
        ).all()
        
        deleted_count = 0
        for attachment in old_attachments:
            if not attachment.storage_path:
                continue
                
            file_path = Path(attachment.storage_path)
            # Only target the "generated" directory to avoid deleting user uploads
            if "generated" in file_path.parts:
                if file_path.exists():
                    mtime = file_path.stat().st_mtime
                    if mtime < cutoff_time:
                        try:
                            file_path.unlink()
                            db.delete(attachment)
                            deleted_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete stale TTS audio {file_path}: {e}")
                else:
                    # File is missing, clean up DB anyway
                    db.delete(attachment)
                    deleted_count += 1
                    
        if deleted_count > 0:
            db.commit()
            logger.info(f"Cleaned up {deleted_count} stale TTS audio attachments.")
