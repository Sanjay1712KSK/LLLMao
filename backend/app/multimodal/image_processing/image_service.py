from __future__ import annotations

import logging
from pathlib import Path

from fastapi import UploadFile

from app.multimodal.image_processing.processor import ImageDependencyMissingError, ImageProcessor, UnsupportedImageError

logger = logging.getLogger("lllmao.image_service")


class ImageService:
    allowed_content_types = {"image/png", "image/jpeg", "image/webp"}
    max_upload_bytes = 16 * 1024 * 1024

    def __init__(self) -> None:
        self.processor = ImageProcessor()

    def validate_backend(self) -> None:
        if not self.processor.pillow_available():
            raise ImageDependencyMissingError("Image processing backend unavailable.")

    async def save_and_process(self, file: UploadFile, *, staging: Path, target: Path, thumbnail: Path) -> tuple[int, int, int, str]:
        self.validate_backend()
        if file.content_type and file.content_type not in self.allowed_content_types:
            raise UnsupportedImageError("Unsupported image type. Use PNG, JPG, JPEG, or WEBP.")
        size = 0
        try:
            with staging.open("wb") as handle:
                while chunk := file.file.read(1024 * 1024):
                    size += len(chunk)
                    if size > self.max_upload_bytes:
                        raise UnsupportedImageError("Image is too large. Use an image under 16 MB.")
                    handle.write(chunk)
            return self.processor.normalize(staging, target, thumbnail)
        except (ImageDependencyMissingError, UnsupportedImageError):
            raise
        except OSError as exc:
            logger.exception("image_file_write_failed", extra={"filename": file.filename})
            raise UnsupportedImageError("Image upload could not be saved.") from exc
        finally:
            file.file.close()
