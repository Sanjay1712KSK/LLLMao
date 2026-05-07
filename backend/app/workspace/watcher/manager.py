from __future__ import annotations

import asyncio
import logging
import threading
import time
from pathlib import Path

from app.orchestration.executor import executor
from app.workspace.indexing import WorkspaceIndexer

logger = logging.getLogger("lllmao.workspace.watcher")


class WorkspaceWatcher:
    def __init__(self) -> None:
        self._observers: dict[str, object] = {}
        self._last_run: dict[str, float] = {}

    def start(self, workspace_id: str, root_path: str, embedding_model: str) -> None:
        if workspace_id in self._observers:
            return
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer
        except ImportError:
            return

        watcher = self

        class Handler(FileSystemEventHandler):
            def on_any_event(self, event) -> None:
                if event.is_directory:
                    return
                path = Path(event.src_path)
                
                # Git-Aware Watchdog: if .git/HEAD or .git/index changes, trigger bulk reindex
                if ".git" in path.parts:
                    if path.name in {"HEAD", "index"}:
                        logger.info("workspace_git_event_detected", extra={"workspace_id": workspace_id, "path": str(path)})
                        watcher._debounced_reindex(workspace_id, embedding_model, delay=5)
                    return

                if any(part in {".git", "build", "install", "log", "node_modules", "__pycache__"} for part in path.parts):
                    return
                    
                watcher._debounced_reindex(workspace_id, embedding_model, delay=3)

        observer = Observer()
        observer.schedule(Handler(), root_path, recursive=True)
        observer.daemon = True
        observer.start()
        self._observers[workspace_id] = observer

    def stop(self, workspace_id: str) -> None:
        observer = self._observers.pop(workspace_id, None)
        if observer is None:
            return
        # Preempt any indexing task for this workspace
        executor.preempt(workspace_id)
        observer.stop()
        observer.join(timeout=2)

    def _debounced_reindex(self, workspace_id: str, embedding_model: str, delay: int = 3) -> None:
        now = time.monotonic()
        if now - self._last_run.get(workspace_id, 0) < delay:
            return
        self._last_run[workspace_id] = now
        
        # Preempt the current indexing task to restart it
        executor.preempt(workspace_id)

        thread = threading.Thread(
            target=lambda: asyncio.run(WorkspaceIndexer(embedding_model).index(workspace_id)),
            daemon=True,
        )
        thread.start()


workspace_watcher = WorkspaceWatcher()
