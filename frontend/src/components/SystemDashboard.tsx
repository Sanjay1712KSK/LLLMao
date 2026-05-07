import { Activity, Bot, Cpu, Database, Gauge, HardDrive, MemoryStick, Server, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import type React from 'react';

import { formatBytes } from '../lib/format';
import { useChatStore } from '../store/chatStore';
import { useSystemStore } from '../store/systemStore';

function Metric({
  label,
  value,
  detail,
  icon,
  alert,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={clsx("rounded-lg border p-3", alert ? "border-amber-500/50 bg-amber-500/10 text-amber-50" : "border-line bg-white/[0.035]")}>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className={alert ? "text-amber-400" : "text-accent"}>{icon}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-ink">{value}</div>
      {detail && <div className="mt-1 truncate text-xs text-muted">{detail}</div>}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={clsx('h-2 w-2 rounded-full', ok ? 'bg-accent' : 'bg-red-400')} />;
}

export function SystemDashboard() {
  const stats = useSystemStore((state) => state.stats);
  const orchestration = useSystemStore((state) => state.orchestration);
  const setPolicy = useSystemStore((state) => state.setPolicy);
  const error = useSystemStore((state) => state.error);
  const { selectedModel, isStreaming, tokensPerSecond } = useChatStore();
  const gpu = stats?.gpu;
  const vramDetail =
    gpu?.vram_used_mb && gpu?.vram_total_mb
      ? `${formatBytes(gpu.vram_used_mb * 1024 * 1024)} / ${formatBytes(gpu.vram_total_mb * 1024 * 1024)}`
      : 'Unavailable';

  const vramPressure = orchestration?.vram_pressure ? Math.round(orchestration.vram_pressure * 100) : null;
  const isDegraded = orchestration?.degraded_mode;

  return (
    <aside className="hidden h-full w-80 shrink-0 border-l border-line bg-[#0d0f14] xl:flex xl:flex-col">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between text-sm font-semibold text-ink">
          <div className="flex items-center gap-2">
            <Gauge size={17} className="text-accent" />
            Live System
          </div>
          {isDegraded && (
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase text-amber-500">
              <ShieldAlert size={12} /> Degraded
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">Adaptive runtime metrics</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {orchestration && (
          <div className="rounded-lg border border-line bg-panel p-3">
             <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Runtime Policy Profile</div>
             <select 
               className="w-full rounded border border-line bg-surface p-1.5 text-sm text-ink outline-none"
               value={orchestration.policy}
               onChange={(e) => setPolicy(e.target.value)}
             >
               <option value="normal">Normal (Balanced)</option>
               <option value="coding">Coding (Memory Heavy)</option>
               <option value="gaming">Gaming (Coexistence)</option>
               <option value="rendering">Rendering (GPU Compute)</option>
               <option value="battery">Battery Saver</option>
             </select>
          </div>
        )}
        
        <Metric label="CPU" value={`${Math.round(stats?.cpu_percent ?? 0)}%`} icon={<Cpu size={15} />} />
        <Metric
          label="RAM"
          value={`${Math.round(stats?.ram_percent ?? 0)}%`}
          detail={stats ? `${formatBytes(stats.ram_used_mb * 1024 * 1024)} / ${formatBytes(stats.ram_total_mb * 1024 * 1024)}` : 'Loading'}
          icon={<MemoryStick size={15} />}
          alert={orchestration?.ram_pressure ? orchestration.ram_pressure > 0.85 : false}
        />
        <Metric label="GPU" value={gpu?.utilization_percent != null ? `${Math.round(gpu.utilization_percent)}%` : 'N/A'} detail={gpu?.name ?? 'CPU-only or telemetry unavailable'} icon={<Activity size={15} />} />
        <Metric 
          label="VRAM" 
          value={vramPressure != null ? `${vramPressure}%` : gpu?.vram_total_mb ? `${Math.round(((gpu.vram_used_mb ?? 0) / gpu.vram_total_mb) * 100)}%` : 'N/A'} 
          detail={vramDetail} 
          icon={<HardDrive size={15} />} 
          alert={vramPressure ? vramPressure > 85 : false}
        />
        <Metric label="Tokens/sec" value={tokensPerSecond ? tokensPerSecond.toFixed(1) : isStreaming ? 'Estimating' : 'Idle'} detail="Approximate local stream rate" icon={<Bot size={15} />} />
        <div className="rounded-lg border border-line bg-panel p-3">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Runtime</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Selected</span>
              <span className="truncate text-ink">{selectedModel || 'None'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Active</span>
              <span className="truncate text-ink">{stats?.active_model || 'Idle'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><StatusDot ok={Boolean(stats?.ollama_ok)} /> Ollama</span>
              {stats?.ollama_ok ? <Wifi size={15} className="text-accent" /> : <WifiOff size={15} className="text-red-400" />}
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><StatusDot ok={Boolean(stats?.database_ok)} /> Database</span>
              <Database size={15} className={stats?.database_ok ? 'text-accent' : 'text-red-400'} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><StatusDot ok={Boolean(stats?.backend_ok)} /> Backend</span>
              <Server size={15} className={stats?.backend_ok ? 'text-accent' : 'text-red-400'} />
            </div>
          </div>
        </div>
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
      </div>
    </aside>
  );
}
