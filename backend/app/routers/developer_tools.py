from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.developer_tools.diagnostics import DiagnosticsService
from app.developer_tools.editor import EditorService
from app.developer_tools.git import GitService
from app.developer_tools.patches import PatchService
from app.developer_tools.ros2 import Ros2Service
from app.developer_tools.search import WorkspaceSearchService
from app.developer_tools.security import ToolSecurityError
from app.developer_tools.terminal import TerminalService
from app.schemas import (
    DiagnosticsRead,
    FileReadRequest,
    FileReadResult,
    FileSaveRequest,
    GitStatusRead,
    PatchApplyRequest,
    PatchGenerateRequest,
    PatchRead,
    TerminalExecuteRequest,
    TerminalResultRead,
)

router = APIRouter(tags=["developer-tools"])


@router.post("/terminal/execute", response_model=TerminalResultRead)
async def terminal_execute(payload: TerminalExecuteRequest, db: Session = Depends(get_db)) -> TerminalResultRead:
    try:
        result = await TerminalService().execute(db, command=payload.command, cwd=payload.cwd, workspace_id=payload.workspace_id)
    except ToolSecurityError as exc:
        raise HTTPException(status_code=400, detail={"error": True, "code": "TERMINAL_COMMAND_BLOCKED", "message": str(exc), "details": str(exc)}) from exc
    return TerminalResultRead.model_validate(result)


@router.get("/git/status", response_model=GitStatusRead)
def git_status(cwd: str, workspace_id: str | None = None, db: Session = Depends(get_db)) -> GitStatusRead:
    return GitStatusRead.model_validate(GitService().status(db, cwd, workspace_id))


@router.get("/git/diff")
def git_diff(cwd: str, path: str | None = None, workspace_id: str | None = None, db: Session = Depends(get_db)) -> dict:
    return {"diff": GitService().diff(db, cwd, path, workspace_id)}


@router.get("/git/history")
def git_history(cwd: str, workspace_id: str | None = None, limit: int = 20, db: Session = Depends(get_db)) -> dict:
    return {"commits": GitService().history(db, cwd, workspace_id, limit)}


@router.post("/patch/generate", response_model=PatchRead)
def patch_generate(payload: PatchGenerateRequest, db: Session = Depends(get_db)) -> PatchRead:
    try:
        row = PatchService().propose(
            db,
            cwd=payload.cwd,
            patch_text=payload.patch_text,
            title=payload.title,
            description=payload.description,
            workspace_id=payload.workspace_id,
        )
    except ToolSecurityError as exc:
        raise HTTPException(status_code=400, detail={"error": True, "code": "PATCH_REJECTED", "message": str(exc), "details": str(exc)}) from exc
    return PatchRead.model_validate(row)


@router.post("/patch/apply", response_model=PatchRead)
def patch_apply(payload: PatchApplyRequest, db: Session = Depends(get_db)) -> PatchRead:
    try:
        row = PatchService().apply(db, patch_id=payload.patch_id, cwd=payload.cwd, approved=payload.approved)
    except ToolSecurityError as exc:
        raise HTTPException(status_code=400, detail={"error": True, "code": "PATCH_APPLY_BLOCKED", "message": str(exc), "details": str(exc)}) from exc
    return PatchRead.model_validate(row)


@router.get("/workspace/search")
async def workspace_search(workspace_id: str, query: str, limit: int = 20, db: Session = Depends(get_db)) -> dict:
    return await WorkspaceSearchService().search(db, workspace_id=workspace_id, query=query, limit=limit)


@router.get("/workspace/diagnostics", response_model=DiagnosticsRead)
def workspace_diagnostics(workspace_id: str | None = None, db: Session = Depends(get_db)) -> DiagnosticsRead:
    return DiagnosticsRead.model_validate(DiagnosticsService().run(db, workspace_id))


@router.get("/ros2/overview")
def ros2_overview(workspace_id: str, db: Session = Depends(get_db)) -> dict:
    return Ros2Service().package_overview(db, workspace_id)


@router.post("/file/read", response_model=FileReadResult)
def file_read(payload: FileReadRequest) -> FileReadResult:
    try:
        return FileReadResult.model_validate(EditorService().read(cwd=payload.cwd, path=payload.path))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": True, "code": "FILE_READ_FAILED", "message": str(exc), "details": str(exc)}) from exc


@router.post("/file/save", response_model=FileReadResult)
def file_save(payload: FileSaveRequest) -> FileReadResult:
    try:
        return FileReadResult.model_validate(EditorService().save(cwd=payload.cwd, path=payload.path, content=payload.content))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": True, "code": "FILE_SAVE_FAILED", "message": str(exc), "details": str(exc)}) from exc
