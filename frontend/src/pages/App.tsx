import { ChevronDown, PanelLeft, TerminalSquare } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { ChatInput } from '../components/ChatInput';
import { ChatView } from '../components/ChatView';
import { Notifications } from '../components/Notifications';
import { SettingsCenter } from '../components/SettingsCenter';
import { Sidebar } from '../components/Sidebar';
import { SystemDashboard } from '../components/SystemDashboard';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSystemStore } from '../store/systemStore';
import { AudioModelModal } from '../components/audio/AudioModelModal';

export default function App() {
  const bootstrap = useChatStore((state) => state.bootstrap);
  const startPolling = useSystemStore((state) => state.startPolling);
  const stopPolling = useSystemStore((state) => state.stopPolling);
  const telemetryEnabled = useSettingsStore((state) => state.telemetryEnabled);
  const devToolsEnabled = useSettingsStore((state) => state.devToolsEnabled);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop icon rail

  useEffect(() => {
    void bootstrap();
    startPolling();
    return () => stopPolling();
  }, [bootstrap, startPolling, stopPolling]);

  return (
    <div className="h-screen overflow-hidden bg-surface text-ink">
      <Notifications />
      <AudioModelModal />
      <SettingsCenter />
      <div className="flex h-full">
        <div className={clsx("hidden h-full transition-all duration-300 md:block", sidebarCollapsed ? "w-16" : "w-72")}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-80 max-w-[85vw]" onClick={(event) => event.stopPropagation()}>
              <Sidebar collapsed={false} onToggle={() => {}} />
            </div>
          </div>
        )}
        <section className="relative flex min-w-0 flex-1 flex-col bg-grid-pattern">
          <div className="flex items-center border-b border-line bg-surface/80 backdrop-blur-md md:hidden">
            <button className="m-2 rounded-lg p-2 text-muted hover:bg-hover hover:text-ink" onClick={() => setSidebarOpen(true)} type="button" title="Open sidebar">
              <PanelLeft size={20} />
            </button>
            <div className="text-sm font-semibold">LLLMao</div>
          </div>
          <ChatView />
          <ChatInput />
        </section>
        {telemetryEnabled && <SystemDashboard />}
      </div>
    </div>
  );
}
