import { Cpu, Edit3, MessageSquare, PanelLeft, Pin, PinOff, Plus, Search, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

import { useChatStore } from '../store/chatStore';
import { KnowledgeBasePanel } from './KnowledgeBasePanel';
import { RetrievalDebugPanel } from './RetrievalDebugPanel';
import { WorkspacePanel } from './WorkspacePanel';
import { DeveloperToolsPanel } from './DeveloperToolsPanel';
import { useSettingsStore } from '../store/settingsStore';

type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { chats, currentChatId, createChat, selectChat, renameChat, togglePinned, deleteChat, searchQuery, setSearchQuery } =
    useChatStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const devToolsEnabled = useSettingsStore((state) => state.devToolsEnabled);
  const setSettingsOpen = useSettingsStore((state) => state.setSettingsOpen);
  const { models, selectedModel, setSelectedModel } = useChatStore();
  const visibleChats = chats.filter((chat) => chat.title.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const startRename = (id: number, title: string) => {
    setEditingId(id);
    setDraft(title);
  };

  const submitRename = async () => {
    if (editingId && draft.trim()) await renameChat(editingId, draft.trim());
    setEditingId(null);
    setDraft('');
  };

  return (
    <div className="h-full py-3 pl-3 pr-1.5 flex">
      <aside className={clsx("flex h-full w-full flex-col border border-line bg-panel shadow-float transition-all duration-300 rounded-3xl overflow-hidden relative", collapsed ? "items-center" : "")}>
      <div className={clsx("border-b border-line p-3 flex flex-col gap-3", collapsed ? "items-center" : "")}>
        <div className="flex gap-2 w-full">
          {onToggle && (
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-elevated text-muted hover:text-ink hover:bg-hover" onClick={onToggle} type="button" title="Toggle Sidebar">
              <PanelLeft size={17} />
            </button>
          )}
          <button
            className={clsx("flex h-11 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink hover:brightness-110", collapsed ? "w-11 px-0" : "w-full px-3")}
            onClick={createChat}
            type="button"
            title="New Chat"
          >
            <Plus size={17} />
            {!collapsed && 'New Chat'}
          </button>
        </div>
        {!collapsed ? (
          <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-input px-3 text-muted">
            <Search size={15} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        ) : (
          <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-input text-muted hover:text-ink hover:bg-hover" type="button" title="Search chats">
            <Search size={17} />
          </button>
        )}
      </div>
      <nav className={clsx("min-h-0 flex-1 overflow-y-auto p-2", collapsed ? "space-y-2 flex flex-col items-center" : "space-y-1")}>
        {visibleChats.map((chat) => (
          <div
            key={chat.id}
            className={clsx(
              'group flex items-center gap-2 rounded-lg text-sm',
              collapsed ? 'justify-center p-2' : 'px-2 py-2',
              currentChatId === chat.id ? 'bg-subtle text-ink' : 'text-muted hover:bg-hover hover:text-ink',
            )}
            title={collapsed ? chat.title : undefined}
          >
            <button className={clsx("flex items-center", collapsed ? "justify-center" : "gap-2 min-w-0 flex-1 text-left truncate")} onClick={() => selectChat(chat.id)} type="button">
              {chat.pinned ? <Pin size={16} className="shrink-0 text-accent" /> : <MessageSquare size={16} className="shrink-0" />}
              {!collapsed && (
                editingId === chat.id ? (
                  <input
                    className="min-w-0 flex-1 rounded border border-line bg-input px-2 py-1 text-sm text-ink outline-none"
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void submitRename();
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="truncate">{chat.title}</span>
                )
              )}
            </button>
            {!collapsed && (
              <>
                <button
                  className="rounded p-1 opacity-0 hover:bg-hover group-hover:opacity-100"
                  onClick={() => togglePinned(chat.id)}
                  type="button"
                  title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                >
                  {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button
                  className="rounded p-1 opacity-0 hover:bg-hover group-hover:opacity-100"
                  onClick={() => startRename(chat.id, chat.title)}
                  type="button"
                  title="Rename chat"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="rounded p-1 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                  onClick={() => deleteChat(chat.id)}
                  type="button"
                  title="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        ))}
      </nav>
      {!collapsed && (
        <>
          <WorkspacePanel />
          <KnowledgeBasePanel />
          <RetrievalDebugPanel />
          {devToolsEnabled && <DeveloperToolsPanel />}
        </>
      )}
      <div className={clsx("border-t border-line p-3 flex flex-col gap-2", collapsed ? "items-center" : "")}>
        {!collapsed && (
          <div className="flex flex-col gap-2 w-full">
            <select
              className="w-full rounded-xl border border-line bg-input p-2 text-xs text-ink outline-none focus:border-accent"
              value={selectedModel}
              onChange={(event) => void setSelectedModel(event.target.value)}
              disabled={!models.length}
            >
              {!models.length && <option value="">No models</option>}
              {models.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          className={clsx("flex items-center justify-center gap-2 rounded-xl border border-line bg-elevated text-sm font-semibold text-muted hover:text-ink hover:border-accent", collapsed ? "h-11 w-11" : "h-11 w-full px-3")}
          onClick={() => setSettingsOpen(true)}
          type="button"
          title="Settings"
        >
          <Settings size={17} />
          {!collapsed && 'Settings'}
        </button>
      </div>
    </aside>
    </div>
  );
}
