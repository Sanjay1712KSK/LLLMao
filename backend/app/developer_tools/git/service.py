from __future__ import annotations

import subprocess
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.developer_tools.security import safe_workspace_path
from app.models import GitAnalysisLog


class GitService:
    def status(self, db: Session, cwd: str, workspace_id: str | None = None) -> dict:
        root = safe_workspace_path(Path(cwd))
        branch = self._run(root, ["git", "branch", "--show-current"])
        porcelain = self._run(root, ["git", "status", "--short"])
        files = [{"status": line[:2].strip(), "path": line[3:]} for line in porcelain.splitlines() if line.strip()]
        payload = {"branch": branch.strip() or "detached", "changed_files": files}
        self._log(db, workspace_id, root, "status", porcelain)
        return payload

    def diff(self, db: Session, cwd: str, path: str | None = None, workspace_id: str | None = None) -> str:
        root = safe_workspace_path(Path(cwd))
        args = ["git", "diff", "--"]
        if path:
            args.append(str(safe_workspace_path(root, path).relative_to(root)))
        output = self._run(root, args, max_chars=120_000)
        self._log(db, workspace_id, root, "diff", output[:20_000])
        return output

    def history(self, db: Session, cwd: str, workspace_id: str | None = None, limit: int = 20) -> list[dict]:
        root = safe_workspace_path(Path(cwd))
        output = self._run(root, ["git", "log", f"--max-count={max(1, min(limit, 50))}", "--pretty=%h%x09%ad%x09%s", "--date=short"])
        self._log(db, workspace_id, root, "history", output)
        return [
            {"hash": parts[0], "date": parts[1], "subject": parts[2]}
            for line in output.splitlines()
            if len((parts := line.split("\t", 2))) == 3
        ]

    def _run(self, cwd: Path, args: list[str], max_chars: int = 60_000) -> str:
        result = subprocess.run(args, cwd=str(cwd), capture_output=True, text=True, timeout=8, check=False)
        return (result.stdout + result.stderr)[-max_chars:]

    def _log(self, db: Session, workspace_id: str | None, cwd: Path, action: str, output: str) -> None:
        db.add(GitAnalysisLog(id=str(uuid.uuid4()), workspace_id=workspace_id, cwd=str(cwd), action=action, output=output))
        db.commit()
