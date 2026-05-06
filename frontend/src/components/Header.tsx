import { Cpu, Wifi, WifiOff } from 'lucide-react';

import { formatBytes } from '../lib/format';
import { useChatStore } from '../store/chatStore';

export function Header() {
  const { models, selectedModel, setSelectedModel, health } = useChatStore();
  const model = models.find((item) => item.name === selectedModel);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Cpu size={17} className="text-accent" />
          <span>Local Ollama Workspace</span>
        </div>
        <p className="truncate text-xs text-muted">
          {model ? [model.parameter_size, model.quantization_level, formatBytes(model.size)].filter(Boolean).join(' · ') : 'No local model selected'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <select
          className="h-10 max-w-[44vw] rounded-lg border border-line bg-panel px-3 text-sm text-ink outline-none focus:border-accent md:max-w-xs"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
          disabled={!models.length}
        >
          {!models.length && <option value="">No installed models detected</option>}
          {models.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        <div
          className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-xs text-muted sm:flex"
          title={health.message}
        >
          {health.ok ? <Wifi size={15} className="text-accent" /> : <WifiOff size={15} className="text-red-400" />}
          {health.ok ? 'Ollama online' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
