from __future__ import annotations

import subprocess
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.developer_tools.security import ToolSecurityError, safe_workspace_path
from app.models import PatchHistory


class PatchService:
    def propose(self, db: Session, *, cwd: str, patch_text: str, title: str, description: str = "", workspace_id: str | None = None) -> PatchHistory:
        if not patch_text.strip().startswith(("diff --git", "--- ")):
            raise ToolSecurityError("Patch proposal must be a unified diff.")
        root = safe_workspace_path(Path(cwd))
        row = PatchHistory(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            title=title[:255] or "Patch proposal",
            description=description,
            patch_text=patch_text,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def apply(self, db: Session, *, patch_id: str, cwd: str, approved: bool) -> PatchHistory:
        if not approved:
            raise ToolSecurityError("Patch application requires explicit approval.")
        root = safe_workspace_path(Path(cwd))
        row = db.get(PatchHistory, patch_id)
        if row is None:
            raise ToolSecurityError("Patch proposal not found.")
        if row.applied:
            return row
        check = subprocess.run(["git", "apply", "--check", "-"], input=row.patch_text, cwd=str(root), text=True, capture_output=True, timeout=8)
        if check.returncode != 0:
            raise ToolSecurityError(check.stderr or "Patch does not apply cleanly.")
        result = subprocess.run(["git", "apply", "-"], input=row.patch_text, cwd=str(root), text=True, capture_output=True, timeout=8)
        if result.returncode != 0:
            raise ToolSecurityError(result.stderr or "Patch application failed.")
        row.approved = True
        row.applied = True
        row.applied_at = datetime.now(UTC)
        db.commit()
        db.refresh(row)
        return row
