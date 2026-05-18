import { Edit3, MessageSquare, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

import { useChatStore } from '../store/chatStore';
import { KnowledgeBasePanel } from './KnowledgeBasePanel';
import { RetrievalDebugPanel } from './RetrievalDebugPanel';
import { WorkspacePanel } from './WorkspacePanel';

export function Sidebar() {
  const { chats, currentChatId, createChat, selectChat, renameChat, togglePinned, deleteChat, searchQuery, setSearchQuery } =
    useChatStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
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
    <aside className="flex h-full w-full flex-col border-r border-line bg-panel-soft md:w-72">
      <div className="border-b border-line p-3">
        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:brightness-110"
          onClick={createChat}
          type="button"
        >
          <Plus size={17} />
          New Chat
        </button>
        <div className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-line bg-input px-3 text-muted">
          <Search size={15} />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {visibleChats.map((chat) => (
          <div
            key={chat.id}
            className={clsx(
              'group flex items-center gap-2 rounded-lg px-2 py-2 text-sm',
              currentChatId === chat.id ? 'bg-subtle text-ink' : 'text-muted hover:bg-hover hover:text-ink',
            )}
          >
            {chat.pinned ? <Pin size={16} className="shrink-0 text-accent" /> : <MessageSquare size={16} className="shrink-0" />}
            {editingId === chat.id ? (
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
              <button className="min-w-0 flex-1 truncate text-left" onClick={() => selectChat(chat.id)} type="button">
                {chat.title}
              </button>
            )}
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
          </div>
        ))}
      </nav>
      <WorkspacePanel />
      <KnowledgeBasePanel />
      <RetrievalDebugPanel />
    </aside>
  );
}
