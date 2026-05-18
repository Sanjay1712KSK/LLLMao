import clsx from 'clsx';
import { BookOpen, FileText, ImagePlus, RotateCw, TerminalSquare } from 'lucide-react';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChatStore } from '../store/chatStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { RetrievalSource } from '../types/api';
import { API_BASE_URL } from '../services/api';
import { MarkdownMessage } from './MarkdownMessage';
import { AudioPlayer } from './audio/AudioPlayer';

export function ChatView() {
  const { messages, isStreaming, health, error, bootstrap } = useChatStore();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const bottomRef = useAutoScroll(messages.map((message) => message.content).join('|'));

  if (!health.ok) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-xl rounded-xl border border-line bg-panel p-6 text-center shadow-soft">
          <h1 className="text-xl font-semibold text-ink">Local runtime needs attention</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Start Ollama and confirm it is serving at <code>http://localhost:11434</code>. LLLMao will use installed local models only.
          </p>
          <button className="mt-5 inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-ink" type="button" onClick={() => void bootstrap()}>
            <RotateCw size={14} /> Check again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-7">
        {!messages.length && (
          <EmptyState workspaceName={activeWorkspace?.name} />
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={clsx(
              'flex gap-4 rounded-2xl px-3 py-3',
              message.role === 'assistant' ? 'bg-transparent' : 'bg-subtle',
            )}
          >
            <div
              className={clsx(
                'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                message.role === 'assistant' ? 'bg-accent text-accent-ink' : 'bg-subtle text-ink',
              )}
            >
              {message.role === 'assistant' ? 'AI' : 'You'}
            </div>
            <div className="min-w-0 flex-1 text-sm leading-7 text-ink">
              {message.content ? (
                <>
                  <MarkdownMessage content={message.content} />
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.sources.map((source) => (
                        <span
                          key={sourceKey(source)}
                          className="rounded-lg border border-line bg-elevated px-2 py-1 text-xs text-muted"
                          title={sourceTitle(source)}
                        >
                          {sourceLabel(source)}
                        </span>
                      ))}
                    </div>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 flex flex-col gap-3">
                      {message.attachments.map((attachment) => {
                        if (attachment.type === 'audio') {
                          return (
                            <AudioPlayer
                              key={attachment.id}
                              src={`${API_BASE_URL}/media/${message.chat_id}/${attachment.id}`}
                              durationMs={attachment.duration_ms || undefined}
                              transcript={attachment.transcript || undefined}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </>
              ) : (
                <TypingIndicator />
              )}
            </div>
          </article>
        ))}
        {isStreaming && <div className="px-14 text-xs text-muted">Streaming from Ollama...</div>}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button className="inline-flex items-center gap-2 rounded-md border border-red-400/30 px-2 py-1 text-xs hover:bg-red-500/10" type="button" onClick={() => void bootstrap()}>
                <RotateCw size={13} /> Retry
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}

function EmptyState({ workspaceName }: { workspaceName?: string }) {
  const cards = [
    { icon: TerminalSquare, title: 'Ask about your ROS2 workspace', body: workspaceName ? `Using ${workspaceName} when workspace mode is enabled.` : 'Connect a workspace from the sidebar to ground answers in code.' },
    { icon: FileText, title: 'Upload PDFs for contextual retrieval', body: 'Use knowledge base mode for local document-backed answers.' },
    { icon: ImagePlus, title: 'Analyze screenshots with multimodal models', body: 'Drop PNG, JPG, or WEBP images here before sending a prompt.' },
    { icon: BookOpen, title: 'Suggested prompt', body: 'Summarize the architecture and call out risky TODOs.' },
  ];

  return (
    <div className="py-12">
      <h1 className="text-3xl font-semibold tracking-normal text-ink">What are we building locally?</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Chat with installed Ollama models, workspace context, documents, and images. Everything stays on this machine.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Icon size={16} className="text-accent" />
                {card.title}
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{card.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex h-7 items-center gap-1 text-muted" aria-label="Assistant is typing">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted/70 [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted/40 [animation-delay:240ms]" />
    </span>
  );
}

function sourceKey(source: RetrievalSource) {
  if ('file_path' in source) return `${source.file_path}-${source.start_line}-${source.end_line}`;
  return `${source.filename}-${source.chunk_index}-${source.section_title ?? ''}`;
}

function sourceTitle(source: RetrievalSource) {
  if ('file_path' in source) return `${source.file_path}:${source.start_line}-${source.end_line}`;
  return source.section_title ?? source.filename;
}

function sourceLabel(source: RetrievalSource) {
  if ('file_path' in source) {
    return `Retrieved from ${source.file_path}${source.symbol_name ? ` / ${source.symbol_name}` : ''} · lines ${source.start_line}-${source.end_line}`;
  }
  return `Retrieved from ${source.filename}${source.section_title ? ` / ${source.section_title}` : ''} · chunk ${source.chunk_index}`;
}
