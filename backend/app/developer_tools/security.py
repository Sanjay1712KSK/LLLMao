from __future__ import annotations

import shlex
from pathlib import Path


class ToolSecurityError(ValueError):
    pass


DANGEROUS_TOKENS = {
    "sudo",
    "su",
    "doas",
    "pkexec",
    "rm",
    "mkfs",
    "mount",
    "umount",
    "dd",
    "reboot",
    "shutdown",
    "poweroff",
    "chown",
    "chmod",
}


def safe_workspace_path(root: Path, candidate: str | None = None) -> Path:
    base = root.expanduser().resolve()
    target = (base / candidate).resolve() if candidate else base
    if target != base and base not in target.parents:
        raise ToolSecurityError("Path escapes the selected workspace.")
    return target


def validate_terminal_command(command: str) -> list[str]:
    parts = shlex.split(command)
    if not parts:
        raise ToolSecurityError("Command is empty.")
    if any(part in {"&&", "||", ";", "|", ">", ">>", "<"} for part in parts):
        raise ToolSecurityError("Shell control operators are not allowed in embedded terminal commands.")
    executable = Path(parts[0]).name
    if executable in DANGEROUS_TOKENS:
        raise ToolSecurityError(f"Command '{executable}' is blocked for safety.")
    return parts
