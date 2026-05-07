import { Bug, RefreshCw, Activity } from 'lucide-react';

import { useChatStore } from '../store/chatStore';
import { useMultimodalStore } from '../store/multimodalStore';

export function RetrievalDebugPanel() {
  const currentChatId = useChatStore((state) => state.currentChatId);
  const { debugLogs, refreshDebug } = useMultimodalStore();

  return (
    <section className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
          <Bug size={14} />
          Context & Retrieval
        </div>
        <button className="rounded p-1 text-muted hover:bg-white/10 hover:text-ink" type="button" title="Refresh context logs" onClick={() => refreshDebug(currentChatId)}>
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {debugLogs.slice(0, 5).map((log) => (
          <div key={log.id} className="rounded-lg border border-line bg-panel p-2">
            <div className="flex items-center justify-between text-[11px] text-muted">
              <span className="truncate max-w-[80%] font-semibold text-ink">{log.query}</span>
              <Activity size={12} className="text-accent" />
            </div>
            <div className="mt-1 text-[11px] text-muted space-y-1">
              <div>Mode: {log.mode} · Strategy: {log.strategy || 'balanced'}</div>
              <div className="flex items-center justify-between">
                <span>Hits: {log.chunks_allocated || 0} / {log.chunks_retrieved || 0}</span>
                <span>Budget: {log.token_budget}</span>
              </div>
            </div>
          </div>
        ))}
        {!debugLogs.length && <div className="rounded-lg border border-line bg-panel p-2 text-xs text-muted">No context logs yet.</div>}
      </div>
    </section>
  );
}
