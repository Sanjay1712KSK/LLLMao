from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.developer_tools.security import safe_workspace_path, validate_terminal_command
from app.models import TerminalSession


class TerminalService:
    async def execute(
        self,
        db: Session,
        *,
        command: str,
        cwd: str,
        workspace_id: str | None = None,
        timeout: float = 20.0,
    ) -> TerminalSession:
        args = validate_terminal_command(command)
        working_dir = safe_workspace_path(Path(cwd))
        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=str(working_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except TimeoutError:
            process.kill()
            stdout, _ = await process.communicate()
        output = stdout.decode("utf-8", errors="replace")[-60_000:]
        row = TerminalSession(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            cwd=str(working_dir),
            command=command,
            exit_code=process.returncode,
            output=output,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
