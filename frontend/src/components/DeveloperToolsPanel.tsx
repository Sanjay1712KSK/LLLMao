import { Activity, ChevronDown, GitBranch, Play, Search, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useDeveloperToolsStore } from '../store/developerToolsStore';
import { useWorkspaceStore } from '../store/workspaceStore';

export function DeveloperToolsPanel() {
  const [command, setCommand] = useState('git status --short');
  const [query, setQuery] = useState('');
  const { activeWorkspaceId, workspaces } = useWorkspaceStore();
  const workspace = useMemo(() => workspaces.find((item) => item.id === activeWorkspaceId), [activeWorkspaceId, workspaces]);
  const cwd = workspace?.root_path || '';
  const {
    terminalHistory,
    gitStatus,
    gitDiff,
    diagnostics,
    searchResults,
    openFile,
    error,
    runCommand,
    refreshGit,
    loadDiff,
    runDiagnostics,
    searchWorkspace,
    readFile,
    setOpenFileContent,
    saveOpenFile,
  } = useDeveloperToolsStore();

  useEffect(() => {
    if (!cwd) return;
    void refreshGit(cwd, activeWorkspaceId);
    void runDiagnostics(activeWorkspaceId);
  }, [activeWorkspaceId, cwd, refreshGit, runDiagnostics]);

  return (
    <section className="p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        <Terminal size={14} />
        Dev Tools
      </div>
      {!cwd ? (
        <div className="rounded-lg border border-line bg-elevated p-2 text-xs text-muted">Select a workspace for terminal, Git, search, and diagnostics.</div>
      ) : (
        <div className="flex flex-col gap-2">
          <details className="group rounded-lg border border-line bg-elevated [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between p-2 text-xs font-medium text-muted hover:text-ink">
              <div className="flex items-center gap-2">
                <Terminal size={13} /> Terminal
              </div>
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-2">
            <div className="flex gap-1">
              <input className="min-w-0 flex-1 rounded border border-line bg-input px-2 py-1 text-xs text-ink outline-none" value={command} onChange={(event) => setCommand(event.target.value)} />
              <button className="rounded bg-accent px-2 text-accent-ink" type="button" title="Run command" onClick={() => void runCommand(command, cwd, activeWorkspaceId)}>
                <Play size={13} />
              </button>
            </div>
              {terminalHistory[0] && (
                <pre className="mt-2 max-h-28 overflow-auto rounded bg-code p-2 text-[11px] leading-4 text-muted">{terminalHistory[0].output || `(exit ${terminalHistory[0].exit_code})`}</pre>
              )}
            </div>
          </details>

          <details className="group rounded-lg border border-line bg-elevated [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between p-2 text-xs font-medium text-muted hover:text-ink">
              <div className="flex items-center gap-2">
                <GitBranch size={13} /> {gitStatus?.branch || 'Git'}
              </div>
              <div className="flex items-center gap-2">
                <span>{gitStatus?.changed_files.length ?? 0} changed</span>
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="border-t border-line p-2">
              <button className="mb-2 w-full text-left text-xs text-muted hover:text-ink" type="button" onClick={() => void refreshGit(cwd, activeWorkspaceId)}>
                Refresh Status
              </button>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {gitStatus?.changed_files.slice(0, 8).map((file) => (
                <button key={`${file.status}-${file.path}`} className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-muted hover:bg-hover hover:text-ink" type="button" onClick={() => void loadDiff(cwd, file.path, activeWorkspaceId)}>
                  {file.status} {file.path}
                </button>
              ))}
              {!gitStatus?.changed_files.length && <div className="text-[11px] text-muted">No changed files.</div>}
            </div>
              {gitDiff && <pre className="mt-2 max-h-32 overflow-auto rounded bg-code p-2 text-[11px] leading-4 text-muted">{gitDiff}</pre>}
            </div>
          </details>

          <details className="group rounded-lg border border-line bg-elevated [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between p-2 text-xs font-medium text-muted hover:text-ink">
              <div className="flex items-center gap-2">
                <Search size={13} /> Workspace Search
              </div>
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-2">
            <div className="flex gap-1">
              <input className="min-w-0 flex-1 rounded border border-line bg-input px-2 py-1 text-xs text-ink outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="symbol, topic, file..." />
              <button className="rounded border border-line px-2 text-muted hover:text-ink" type="button" onClick={() => query.trim() && void searchWorkspace(activeWorkspaceId, query)}>
                <Search size={13} />
              </button>
            </div>
            {searchResults && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {[...searchResults.semantic, ...searchResults.keyword].slice(0, 8).map((item, index) => (
                  <button key={index} className="block w-full truncate text-left text-[11px] text-muted hover:text-ink" type="button" onClick={() => item.path && void readFile(cwd, String(item.path))}>
                    {String(item.path || '')}{item.symbol ? ` / ${String(item.symbol)}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          </details>

          {openFile && (
            <div className="rounded-lg border border-line bg-elevated p-2">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{openFile.path}{openFile.dirty ? ' *' : ''}</span>
                <button className="rounded border border-line px-2 py-0.5 hover:text-ink" type="button" onClick={() => void saveOpenFile(cwd)}>Save</button>
              </div>
              <textarea
                className="h-40 w-full resize-none rounded border border-line bg-code p-2 font-mono text-[11px] leading-4 text-ink outline-none"
                value={openFile.content}
                spellCheck={false}
                onChange={(event) => setOpenFileContent(event.target.value)}
              />
            </div>
          )}

          <details className="group rounded-lg border border-line bg-elevated [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between p-2 text-xs font-medium text-muted hover:text-ink">
              <div className="flex items-center gap-2">
                <Activity size={13} /> Diagnostics
              </div>
              <div className="flex items-center gap-2">
                <span>{diagnostics?.status || 'check'}</span>
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="border-t border-line p-2">
              <button className="mb-2 w-full text-left text-xs text-muted hover:text-ink" type="button" onClick={() => void runDiagnostics(activeWorkspaceId)}>
                Refresh Diagnostics
              </button>
            {diagnostics?.issues.slice(0, 4).map((issue) => (
              <div key={`${issue.title}-${issue.detail}`} className="mt-2 text-[11px] text-muted">
                <span className={issue.severity === 'error' ? 'text-red-300' : 'text-yellow-200'}>{issue.title}</span>
                {issue.detail ? ` · ${issue.detail}` : ''}
              </div>
              ))}
            </div>
          </details>
        </div>
      )}
      {error && <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
    </section>
  );
}
