from __future__ import annotations

from pathlib import Path

from app.developer_tools.security import safe_workspace_path

MAX_EDIT_FILE_BYTES = 1_000_000


class EditorService:
    def read(self, *, cwd: str, path: str) -> dict:
        root = safe_workspace_path(Path(cwd))
        target = safe_workspace_path(root, path)
        if not target.is_file():
            raise ValueError("File not found.")
        if target.stat().st_size > MAX_EDIT_FILE_BYTES:
            raise ValueError("File is too large for the lightweight editor.")
        return {"path": str(target.relative_to(root)), "content": target.read_text(encoding="utf-8", errors="replace")}

    def save(self, *, cwd: str, path: str, content: str) -> dict:
        root = safe_workspace_path(Path(cwd))
        target = safe_workspace_path(root, path)
        if not target.exists() or not target.is_file():
            raise ValueError("File must already exist before saving.")
        if len(content.encode("utf-8")) > MAX_EDIT_FILE_BYTES:
            raise ValueError("File content is too large for the lightweight editor.")
        target.write_text(content, encoding="utf-8")
        return {"path": str(target.relative_to(root)), "content": content}
