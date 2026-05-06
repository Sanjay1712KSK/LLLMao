from __future__ import annotations

import importlib.util
import logging
from pathlib import Path

logger = logging.getLogger("lllmao.image_processing")


class UnsupportedImageError(ValueError):
    pass


class ImageDependencyMissingError(UnsupportedImageError):
    pass


class ImageProcessor:
    supported_types = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
    max_dimension = 1600
    thumb_size = (360, 240)

    @staticmethod
    def pillow_available() -> bool:
        return importlib.util.find_spec("PIL") is not None

    def validate(self, path: Path) -> str:
        if not self.pillow_available():
            raise ImageDependencyMissingError("Image processing backend unavailable.")
        from PIL import Image, UnidentifiedImageError

        try:
            with Image.open(path) as image:
                kind = (image.format or "").lower()
        except (UnidentifiedImageError, OSError) as exc:
            logger.warning("image_validation_failed", extra={"path": str(path), "error": str(exc)})
            raise UnsupportedImageError("Could not read this image. Use a valid PNG, JPG, JPEG, or WEBP file.") from exc
        if kind == "jpg":
            kind = "jpeg"
        if kind not in self.supported_types:
            raise UnsupportedImageError("Unsupported image type. Use PNG, JPG, JPEG, or WEBP.")
        return self.supported_types[kind]

    def normalize(self, source: Path, target: Path, thumbnail: Path) -> tuple[int, int, int, str]:
        mime_type = self.validate(source)
        from PIL import Image, ImageOps

        try:
            with Image.open(source) as image:
                image = ImageOps.exif_transpose(image)
                if image.mode not in {"RGB", "RGBA"}:
                    image = image.convert("RGB")
                image.thumbnail((self.max_dimension, self.max_dimension))
                save_format = "PNG" if mime_type == "image/png" else "WEBP" if mime_type == "image/webp" else "JPEG"
                image.save(target, format=save_format, optimize=True)
                width, height = image.size

                thumb = image.copy()
                if thumb.mode != "RGB":
                    thumb = thumb.convert("RGB")
                thumb.thumbnail(self.thumb_size)
                thumb.save(thumbnail, format="JPEG", quality=82, optimize=True)
        except OSError as exc:
            logger.exception("image_normalization_failed", extra={"path": str(source)})
            raise UnsupportedImageError("Image processing failed. Try a smaller or different image file.") from exc

        return width, height, target.stat().st_size, mime_type
