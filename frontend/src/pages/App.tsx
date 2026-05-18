import { ChevronDown, PanelLeft, TerminalSquare } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { ChatInput } from '../components/ChatInput';
import { ChatView } from '../components/ChatView';
import { DeveloperToolsPanel } from '../components/DeveloperToolsPanel';
import { Header } from '../components/Header';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);

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
        <div className="hidden md:block">
          <Sidebar />
        </div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/80 md:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-80 max-w-[85vw]" onClick={(event) => event.stopPropagation()}>
              <Sidebar />
            </div>
          </div>
        )}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-line bg-surface md:hidden">
            <button className="m-2 rounded-lg p-2 text-muted hover:bg-hover hover:text-ink" onClick={() => setSidebarOpen(true)} type="button" title="Open sidebar">
              <PanelLeft size={20} />
            </button>
            <div className="text-sm font-semibold">LLLMao</div>
          </div>
          <Header />
          <ChatView />
          <ChatInput />
        </section>
        {telemetryEnabled && <SystemDashboard />}
      </div>
      {devToolsEnabled && (
        <div className={clsx("fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-panel-soft shadow-float md:left-72", telemetryEnabled ? "xl:right-14" : "xl:right-0")}>
          <button
            className="flex h-10 w-full items-center justify-between px-4 text-sm font-medium text-ink hover:bg-hover"
            type="button"
            onClick={() => setDevToolsOpen(!devToolsOpen)}
          >
            <span className="inline-flex items-center gap-2"><TerminalSquare size={16} className="text-accent" /> Developer tools</span>
            <ChevronDown className={devToolsOpen ? '' : 'rotate-180'} size={16} />
          </button>
          {devToolsOpen && (
            <div className="max-h-[42vh] overflow-y-auto">
              <DeveloperToolsPanel />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
