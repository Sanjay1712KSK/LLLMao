import { Activity, Database, HardDrive, MonitorCog, Moon, RefreshCw, Settings, Sun, Trash2, UserRound, X } from 'lucide-react';
import clsx from 'clsx';
import { useEffect } from 'react';

import { api } from '../services/api';
import { useChatStore } from '../store/chatStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSystemStore } from '../store/systemStore';

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-ink">{label}</div>
        {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
      </div>
      <span className={clsx('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', ok ? 'bg-accent' : 'bg-red-400')} />
    </div>
  );
}

export function SettingsCenter() {
  const { theme, settingsOpen, devToolsEnabled, telemetryEnabled, diagnostics, loadingDiagnostics, setTheme, setSettingsOpen, setDevToolsEnabled, setTelemetryEnabled, refreshDiagnostics, clearCache } = useSettingsStore();
  const { models, selectedModel, setSelectedModel, chats, bootstrap } = useChatStore();
  const orchestration = useSystemStore((state) => state.orchestration);
  const setPolicy = useSystemStore((state) => state.setPolicy);

  useEffect(() => {
    if (settingsOpen) void refreshDiagnostics();
  }, [settingsOpen, refreshDiagnostics]);

  return (
    <>
      <button
        className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full border border-line bg-panel text-ink shadow-soft hover:border-accent"
        type="button"
        title="Open settings"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings size={20} />
      </button>
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 p-3 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
          <section className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-ink"><MonitorCog size={18} className="text-accent" /> Settings</div>
              <button className="rounded-md p-2 text-muted hover:bg-panel hover:text-ink" type="button" title="Close settings" onClick={() => setSettingsOpen(false)}><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><UserRound size={16} /> Workstation</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <StatusLine label="Linux user" ok detail={diagnostics?.username || 'Loading'} />
                  <StatusLine label="Active model" ok={Boolean(selectedModel)} detail={selectedModel || 'No model selected'} />
                </div>
              </section>

              <section>
                <div className="mb-3 text-sm font-semibold text-ink">Theme</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className={clsx('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', theme === 'dark' ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-panel text-muted')} type="button" onClick={() => setTheme('dark')}><Moon size={16} /> ChatGPT-style Dark</button>
                  <button className={clsx('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', theme === 'light' ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-panel text-muted')} type="button" onClick={() => setTheme('light')}><Sun size={16} /> ChatGPT-style Light</button>
                </div>
              </section>

              <section>
                <div className="mb-3 text-sm font-semibold text-ink">Model Management</div>
                <select className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink outline-none focus:border-accent" value={selectedModel} disabled={!models.length} onChange={(event) => void setSelectedModel(event.target.value)}>
                  {!models.length && <option value="">No installed models detected</option>}
                  {models.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}
                </select>
                <p className="mt-2 text-xs text-muted">Model changes validate with Ollama and warm up before the active model updates.</p>
              </section>

              <section>
                <div className="mb-3 text-sm font-semibold text-ink">Runtime Policy</div>
                <select className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-ink outline-none focus:border-accent" value={orchestration?.policy || 'normal'} onChange={(event) => void setPolicy(event.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="coding">Coding</option>
                  <option value="gaming">Coexistence</option>
                  <option value="rendering">Rendering</option>
                  <option value="battery">Battery Saver</option>
                </select>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Activity size={16} /> Runtime Diagnostics</div>
                  <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-ink" type="button" onClick={() => void refreshDiagnostics()}><RefreshCw size={13} /> {loadingDiagnostics ? 'Checking' : 'Refresh'}</button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <StatusLine label="Backend" ok={Boolean(diagnostics?.backend.ok)} detail={diagnostics?.backend.message} />
                  <StatusLine label="Ollama" ok={Boolean(diagnostics?.ollama.ok)} detail={diagnostics?.ollama.message} />
                  <StatusLine label="Local models" ok={Boolean(diagnostics?.models.ok)} detail={`${diagnostics?.models.count ?? 0} installed`} />
                  <StatusLine label="Database" ok={Boolean(diagnostics?.database.ok)} detail={diagnostics?.database.message} />
                  <StatusLine label="Chroma/vector DB" ok={Boolean(diagnostics?.chromadb.ok)} detail={diagnostics?.chromadb.message} />
                  <StatusLine label="Voice transcription" ok={Boolean(diagnostics?.audio?.ok)} detail={diagnostics?.audio?.message} />
                  <StatusLine label="GPU detection" ok={Boolean(diagnostics?.gpu.ok)} detail={diagnostics?.gpu.ok ? 'Telemetry available' : 'Optional telemetry unavailable'} />
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><HardDrive size={16} /> Storage</div>
                <div className="space-y-1 rounded-md border border-line bg-panel p-3 text-xs text-muted">
                  {Object.entries(diagnostics?.paths ?? {}).slice(0, 8).map(([key, value]) => <div key={key} className="flex gap-2"><span className="w-24 shrink-0 text-ink">{key}</span><span className="min-w-0 truncate">{value}</span></div>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-ink" type="button" onClick={() => void clearCache()}><Database size={15} /> Clear cache</button>
                  <button className="inline-flex items-center gap-2 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10" type="button" onClick={async () => { await api.deleteAllChats(); await bootstrap(); useNotificationStore.getState().notify({ kind: 'success', title: 'Chats deleted', message: `${chats.length} chats removed.` }); }}><Trash2 size={15} /> Delete all chats</button>
                </div>
              </section>

              <section>
                <div className="mb-3 text-sm font-semibold text-ink">Workspace Controls</div>
                <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink">
                  <span>Live telemetry</span>
                  <input type="checkbox" checked={telemetryEnabled} onChange={(event) => setTelemetryEnabled(event.target.checked)} />
                </label>
                <label className="mt-2 flex items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink">
                  <span>Developer tools</span>
                  <input type="checkbox" checked={devToolsEnabled} onChange={(event) => setDevToolsEnabled(event.target.checked)} />
                </label>
              </section>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
