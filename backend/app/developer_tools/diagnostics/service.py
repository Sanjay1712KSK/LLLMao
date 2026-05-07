from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DiagnosticsLog, IndexedFile, Workspace
from app.services.health import dependency_checker


class DiagnosticsService:
    def run(self, db: Session, workspace_id: str | None = None) -> dict:
        issues: list[dict] = []
        chroma = dependency_checker.check_chromadb()
        if not chroma.ok:
            issues.append({"severity": "error", "title": "Vector database unavailable", "detail": chroma.details})
        pillow = dependency_checker.check_pillow()
        if not pillow.ok:
            issues.append({"severity": "warning", "title": "Image processing unavailable", "detail": pillow.details})
        if workspace_id:
            workspace = db.get(Workspace, workspace_id)
            if workspace is None:
                issues.append({"severity": "error", "title": "Workspace missing", "detail": "Selected workspace was not found."})
            else:
                root = Path(workspace.root_path)
                if not root.exists():
                    issues.append({"severity": "error", "title": "Workspace path missing", "detail": workspace.root_path})
                failed_files = db.scalars(select(IndexedFile).where(IndexedFile.workspace_id == workspace_id, IndexedFile.status == "failed").limit(20)).all()
                if failed_files:
                    issues.append({"severity": "warning", "title": "Some files failed indexing", "detail": f"{len(failed_files)} recent failed file(s)."})
        report = {"status": "ok" if not issues else "attention", "issues": issues}
        db.add(DiagnosticsLog(id=str(uuid.uuid4()), workspace_id=workspace_id, status=report["status"], report_json=json.dumps(report)))
        db.commit()
        return report
