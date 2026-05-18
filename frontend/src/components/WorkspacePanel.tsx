import { FolderGit2, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { useWorkspaceStore } from '../store/workspaceStore';

export function WorkspacePanel() {
  const {
    workspaces,
    files,
    activeWorkspaceId,
    error,
    refreshWorkspaces,
    connectWorkspace,
    setActiveWorkspace,
    reindexWorkspace,
    disconnectWorkspace,
  } = useWorkspaceStore();
  const [path, setPath] = useState('');
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const indexing = useMemo(
    () => workspaces.some((workspace) => ['queued', 'indexing'].includes(workspace.status)),
    [workspaces],
  );

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    if (!indexing) return;
    const interval = window.setInterval(() => {
      void refreshWorkspaces();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [indexing, refreshWorkspaces]);

  return (
    <section className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
          <FolderGit2 size={14} />
          Workspace
        </div>
        <button className="rounded p-1 text-muted hover:bg-hover hover:text-ink" type="button" title="Refresh workspaces" onClick={() => refreshWorkspaces()}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-xs text-ink outline-none placeholder:text-muted"
          placeholder="/path/to/ros2_ws"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
        <button
          className="rounded-lg border border-line px-2 text-xs text-muted hover:bg-hover hover:text-ink"
          type="button"
          onClick={() => {
            if (!path.trim()) return;
            void connectWorkspace(path.trim());
            setPath('');
          }}
        >
          Add
        </button>
      </div>

      {workspaces.length > 0 && (
        <select
          className="mt-2 h-9 w-full rounded-lg border border-line bg-panel px-2 text-xs text-ink outline-none"
          value={activeWorkspaceId}
          onChange={(event) => setActiveWorkspace(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      )}

      {active && (
        <div className="mt-2 rounded-lg border border-line bg-panel p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-ink" title={active.root_path}>
                {active.name}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted">
                <span className={clsx('rounded px-1.5 py-0.5', statusClass(active.status))}>{active.status}</span>
                <span>{active.file_count} files</span>
                <span>{active.symbol_count} symbols</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button className="rounded p-1 text-muted hover:bg-hover hover:text-ink" type="button" title="Reindex workspace" onClick={() => reindexWorkspace(active.id)}>
                <RefreshCw size={14} />
              </button>
              <button className="rounded p-1 text-muted hover:bg-red-500/20 hover:text-red-300" type="button" title="Disconnect workspace" onClick={() => disconnectWorkspace(active.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          {active.progress_total > 0 && ['queued', 'indexing'].includes(active.status) && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className="h-full bg-accent" style={{ width: `${Math.round((active.progress_done / active.progress_total) * 100)}%` }} />
            </div>
          )}
          {active.error_message && <div className="mt-2 max-h-10 overflow-hidden text-[11px] text-amber-200">{active.error_message}</div>}
        </div>
      )}

      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
        {files.slice(0, 80).map((file) => (
          <div key={file.id} className="flex items-center justify-between gap-2 rounded border border-line/80 bg-surface px-2 py-1.5">
            <span className="min-w-0 truncate text-[11px] text-muted" title={file.relative_path}>
              {file.relative_path}
            </span>
            <span className="shrink-0 text-[10px] uppercase text-muted/80">{file.language}</span>
          </div>
        ))}
      </div>
      {error && <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
    </section>
  );
}

function statusClass(status: string) {
  if (status === 'indexed') return 'bg-accent/15 text-accent';
  if (status === 'failed') return 'bg-red-500/15 text-red-300';
  if (['queued', 'indexing'].includes(status)) return 'bg-blue-500/15 text-blue-200';
  return 'bg-subtle text-muted';
}
