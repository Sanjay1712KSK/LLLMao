from __future__ import annotations

from pathlib import Path


class UnsupportedImageError(ValueError):
    pass


class ImageProcessor:
    supported_types = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
    max_dimension = 1600
    thumb_size = (360, 240)

    def validate(self, path: Path) -> str:
        try:
            from PIL import Image
        except ImportError as exc:
            raise UnsupportedImageError("Image support requires Pillow. Install backend requirements.") from exc
        with Image.open(path) as image:
            kind = (image.format or "").lower()
        if kind == "jpg":
            kind = "jpeg"
        if kind not in self.supported_types:
            raise UnsupportedImageError("Unsupported image type. Use PNG, JPG, JPEG, or WEBP.")
        return self.supported_types[kind]

    def normalize(self, source: Path, target: Path, thumbnail: Path) -> tuple[int, int, int, str]:
        mime_type = self.validate(source)
        from PIL import Image, ImageOps

        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGB")
            image.thumbnail((self.max_dimension, self.max_dimension))
            save_format = "PNG" if mime_type == "image/png" else "WEBP" if mime_type == "image/webp" else "JPEG"
            image.save(target, format=save_format, optimize=True)
            width, height = image.size

            thumb = image.copy()
            thumb.thumbnail(self.thumb_size)
            thumb.save(thumbnail, format="JPEG", quality=82, optimize=True)

        return width, height, target.stat().st_size, mime_type
