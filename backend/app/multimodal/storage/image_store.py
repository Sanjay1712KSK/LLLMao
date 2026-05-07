from __future__ import annotations

import base64
import logging
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings
from app.models import ImageAsset
from app.multimodal.image_processing import ImageService

logger = logging.getLogger("lllmao.image_store")


class ImageStore:
    def __init__(self) -> None:
        settings = get_settings()
        self.root = Path(settings.image_path)
        self.root.mkdir(parents=True, exist_ok=True)
        self.image_service = ImageService()

    async def save_upload(self, file: UploadFile, chat_id: int | None = None) -> ImageAsset:
        image_id = str(uuid.uuid4())
        safe_name = Path(file.filename or f"{image_id}.png").name
        staging = self.root / f"{image_id}.upload"
        suffix = Path(safe_name).suffix.lower() or ".jpg"
        target = self.root / f"{image_id}{suffix}"
        thumbnail = self.root / f"{image_id}.thumb.jpg"
        try:
            width, height, size_bytes, mime_type = await self.image_service.save_and_process(
                file,
                staging=staging,
                target=target,
                thumbnail=thumbnail,
            )
        except Exception:
            logger.exception("image_upload_processing_failed", extra={"filename": safe_name, "chat_id": chat_id})
            target.unlink(missing_ok=True)
            thumbnail.unlink(missing_ok=True)
            raise
        finally:
            staging.unlink(missing_ok=True)
        return ImageAsset(
            id=image_id,
            chat_id=chat_id,
            filename=safe_name,
            mime_type=mime_type,
            storage_path=str(target),
            thumbnail_path=str(thumbnail),
            width=width,
            height=height,
            size_bytes=size_bytes,
        )

    def as_ollama_base64(self, image: ImageAsset) -> str:
        return base64.b64encode(Path(image.storage_path).read_bytes()).decode("ascii")
