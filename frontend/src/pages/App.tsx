import { PanelLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ChatInput } from '../components/ChatInput';
import { ChatView } from '../components/ChatView';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SystemDashboard } from '../components/SystemDashboard';
import { useChatStore } from '../store/chatStore';
import { useSystemStore } from '../store/systemStore';

export default function App() {
  const bootstrap = useChatStore((state) => state.bootstrap);
  const startPolling = useSystemStore((state) => state.startPolling);
  const stopPolling = useSystemStore((state) => state.stopPolling);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    void bootstrap();
    startPolling();
    return () => stopPolling();
  }, [bootstrap, startPolling, stopPolling]);

  return (
    <div className="h-screen overflow-hidden bg-surface text-ink">
      <div className="flex h-full">
        <div className="hidden md:block">
          <Sidebar />
        </div>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-80 max-w-[85vw]" onClick={(event) => event.stopPropagation()}>
              <Sidebar />
            </div>
          </div>
        )}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-line bg-surface md:hidden">
            <button className="m-2 rounded-lg p-2 text-muted hover:bg-white/5 hover:text-ink" onClick={() => setSidebarOpen(true)} type="button" title="Open sidebar">
              <PanelLeft size={20} />
            </button>
            <div className="text-sm font-semibold">LLLMao</div>
          </div>
          <Header />
          <ChatView />
          <ChatInput />
        </section>
        <SystemDashboard />
      </div>
    </div>
  );
}
