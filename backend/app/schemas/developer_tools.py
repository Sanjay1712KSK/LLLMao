from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TerminalExecuteRequest(BaseModel):
    command: str = Field(min_length=1)
    cwd: str
    workspace_id: str | None = None


class TerminalResultRead(BaseModel):
    id: str
    cwd: str
    command: str
    exit_code: int | None
    output: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GitStatusRead(BaseModel):
    branch: str
    changed_files: list[dict]


class PatchGenerateRequest(BaseModel):
    cwd: str
    patch_text: str
    title: str = "Patch proposal"
    description: str = ""
    workspace_id: str | None = None


class PatchApplyRequest(BaseModel):
    cwd: str
    patch_id: str
    approved: bool


class PatchRead(BaseModel):
    id: str
    title: str
    description: str
    patch_text: str
    approved: bool
    applied: bool
    created_at: datetime
    applied_at: datetime | None = None

    model_config = {"from_attributes": True}


class DiagnosticsRead(BaseModel):
    status: str
    issues: list[dict]


class FileReadRequest(BaseModel):
    cwd: str
    path: str


class FileSaveRequest(BaseModel):
    cwd: str
    path: str
    content: str


class FileReadResult(BaseModel):
    path: str
    content: str
