from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path


APP_ID = "lllmao"


def _xdg_dir(env_name: str, fallback: Path) -> Path:
    value = os.environ.get(env_name)
    return Path(value).expanduser() if value else fallback


@dataclass(frozen=True)
class RuntimePaths:
    data: Path
    config: Path
    cache: Path
    state: Path
    logs: Path
    database: Path
    vector_db: Path
    uploads: Path
    images: Path
    chat_media: Path
    embeddings: Path
    settings: Path
    workspaces: Path
    models_piper: Path

    def ensure(self) -> None:
        for path in (
            self.data,
            self.config,
            self.cache,
            self.state,
            self.logs,
            self.database.parent,
            self.vector_db,
            self.uploads,
            self.images,
            self.chat_media,
            self.embeddings,
            self.settings.parent,
            self.workspaces,
            self.models_piper,
        ):
            path.mkdir(parents=True, exist_ok=True)

    def as_dict(self) -> dict[str, str]:
        return {
            "data": str(self.data),
            "config": str(self.config),
            "cache": str(self.cache),
            "state": str(self.state),
            "logs": str(self.logs),
            "database": str(self.database),
            "vector_db": str(self.vector_db),
            "uploads": str(self.uploads),
            "images": str(self.images),
            "chat_media": str(self.chat_media),
            "embeddings": str(self.embeddings),
            "settings": str(self.settings),
            "workspaces": str(self.workspaces),
            "models_piper": str(self.models_piper),
        }


def get_runtime_paths() -> RuntimePaths:
    home = Path.home()
    paths = _build_runtime_paths(home)
    try:
        paths.ensure()
        return paths
    except OSError:
        fallback_home = Path(tempfile.gettempdir()) / f"{APP_ID}-{os.getuid()}"
        paths = _build_runtime_paths(fallback_home, force_home=True)
        paths.ensure()
        return paths


def _build_runtime_paths(home: Path, force_home: bool = False) -> RuntimePaths:
    data = _xdg_dir("XDG_DATA_HOME", home / ".local" / "share") / APP_ID
    config = _xdg_dir("XDG_CONFIG_HOME", home / ".config") / APP_ID
    cache = _xdg_dir("XDG_CACHE_HOME", home / ".cache") / APP_ID
    state = _xdg_dir("XDG_STATE_HOME", home / ".local" / "state") / APP_ID
    if force_home:
        data = home / ".local" / "share" / APP_ID
        config = home / ".config" / APP_ID
        cache = home / ".cache" / APP_ID
        state = home / ".local" / "state" / APP_ID
    paths = RuntimePaths(
        data=data,
        config=config,
        cache=cache,
        state=state,
        logs=state / "logs",
        database=data / "database" / "workspace.sqlite3",
        vector_db=data / "vector-db" / "chroma",
        uploads=data / "uploads",
        images=data / "media" / "images",
        chat_media=data / "media" / "chat",
        embeddings=cache / "embeddings",
        settings=config / "settings.json",
        workspaces=data / "workspaces",
        models_piper=data / "models" / "piper",
    )
    return paths
