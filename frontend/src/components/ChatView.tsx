import clsx from 'clsx';
import { BookOpen, FileText, ImagePlus, RotateCw, TerminalSquare } from 'lucide-react';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChatStore } from '../store/chatStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAudioStore } from '../store/audioStore';
import type { RetrievalSource } from '../types/api';
import { API_BASE_URL } from '../services/api';
import { MarkdownMessage } from './MarkdownMessage';
import { AudioPlayer } from './audio/AudioPlayer';

export function ChatView() {
  const { messages, isStreaming, health, error, bootstrap, selectedModel, models } = useChatStore();
  const username = useSettingsStore((state) => state.diagnostics?.username) || 'You';
  const autoPlayMessageId = useAudioStore((state) => state.autoPlayMessageId);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const bottomRef = useAutoScroll(messages.map((message) => message.content).join('|'));

  if (!health.backend_ok) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-line bg-elevated/40 p-8 text-center shadow-float backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <RotateCw size={24} className="animate-spin" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Backend Offline</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            The Python FastAPI backend is not responding. Please check your system logs or restart the application.
          </p>
          <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110" type="button" onClick={() => void bootstrap()}>
            <RotateCw size={16} /> Reconnect Backend
          </button>
        </div>
      </main>
    );
  }

  if (!health.ollama_installed) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-3xl border border-line bg-elevated/40 p-8 text-center shadow-float backdrop-blur-md">
          <h1 className="text-3xl font-semibold text-ink">Ollama Required</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            LLLMao is a local-first workstation that relies on the Ollama runtime to run AI models on your own hardware. We could not detect Ollama on your system.
          </p>
          <div className="mt-8 text-left space-y-6">
             <div className="rounded-2xl border border-line bg-black/40 p-5">
                <h3 className="text-sm font-semibold text-ink mb-2">Ubuntu / Debian / Snap Users</h3>
                <code className="block bg-black/60 p-3 rounded-lg text-sm text-accent font-mono border border-line">snap install ollama</code>
             </div>
             <div className="rounded-2xl border border-line bg-black/40 p-5">
                <h3 className="text-sm font-semibold text-ink mb-2">Generic Linux</h3>
                <code className="block bg-black/60 p-3 rounded-lg text-sm text-accent font-mono border border-line">curl -fsSL https://ollama.com/install.sh | sh</code>
             </div>
          </div>
          <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:brightness-110 shadow-[0_0_15px_rgba(235,208,26,0.4)]" type="button" onClick={() => void bootstrap()}>
            <RotateCw size={16} /> I have installed Ollama
          </button>
        </div>
      </main>
    );
  }

  if (!health.ollama_ok) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-line bg-elevated/40 p-8 text-center shadow-float backdrop-blur-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <RotateCw size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Ollama is Offline</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Ollama is installed on your system but the daemon is not running. Please start the Ollama service to continue.
          </p>
          <code className="mt-6 block bg-black/40 p-3 rounded-lg text-sm text-accent font-mono border border-line">systemctl start ollama</code>
          <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110" type="button" onClick={() => void bootstrap()}>
            <RotateCw size={16} /> Reconnect
          </button>
        </div>
      </main>
    );
  }

  if (models.length === 0) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-3xl border border-line bg-elevated/40 p-8 text-center shadow-float backdrop-blur-md">
          <h1 className="text-3xl font-semibold text-ink">No Models Installed</h1>
          <p className="mt-4 text-base leading-relaxed text-muted">
            Ollama is running, but you don't have any models downloaded yet.
          </p>
          <div className="mt-8 text-left space-y-4">
             <div className="rounded-2xl border border-line bg-black/40 p-5">
                <h3 className="text-sm font-semibold text-ink mb-2">Recommended for general chat (8GB+ RAM):</h3>
                <code className="block bg-black/60 p-3 rounded-lg text-sm text-accent font-mono border border-line">ollama run llama3</code>
             </div>
             <div className="rounded-2xl border border-line bg-black/40 p-5">
                <h3 className="text-sm font-semibold text-ink mb-2">Recommended for vision/multimodal:</h3>
                <code className="block bg-black/60 p-3 rounded-lg text-sm text-accent font-mono border border-line">ollama run llava</code>
             </div>
          </div>
          <button className="mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:brightness-110" type="button" onClick={() => void bootstrap()}>
            <RotateCw size={16} /> Refresh Models
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {!messages.length && (
          <EmptyState workspaceName={activeWorkspace?.name} username={username !== 'You' ? username : ''} />
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={clsx(
              'flex flex-col gap-3 rounded-3xl px-6 py-8 transition-colors',
              message.role === 'assistant' ? 'bg-transparent' : 'bg-elevated/30 border border-line shadow-float backdrop-blur-md',
            )}
          >
            <div className="flex items-center gap-3">
              {message.role === 'assistant' ? (
                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 shadow-[0_0_15px_rgba(235,208,26,0.5)] border border-accent/40">
                   <div className="h-4 w-4 rounded-full bg-accent animate-[pulse_3s_ease-in-out_infinite]" />
                 </div>
              ) : (
                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-subtle border border-line text-xs font-semibold text-ink uppercase">
                    {username.charAt(0)}
                 </div>
              )}
              <div className="text-sm font-semibold text-ink tracking-wide">
                {message.role === 'assistant' ? (message.model_name || selectedModel || 'Assistant') : username}
              </div>
            </div>
            <div className="min-w-0 flex-1 text-sm md:text-[15px] leading-relaxed text-ink pl-11">
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
                              autoPlay={message.id === autoPlayMessageId}
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

function EmptyState({ workspaceName, username }: { workspaceName?: string; username?: string }) {
  const cards = [
    { icon: TerminalSquare, title: 'Ask about your ROS2 workspace', body: workspaceName ? `Using ${workspaceName} when workspace mode is enabled.` : 'Connect a workspace from the sidebar to ground answers in code.' },
    { icon: FileText, title: 'Upload PDFs for contextual retrieval', body: 'Use knowledge base mode for local document-backed answers.' },
    { icon: ImagePlus, title: 'Analyze screenshots with multimodal models', body: 'Drop PNG, JPG, or WEBP images here before sending a prompt.' },
    { icon: BookOpen, title: 'Suggested prompt', body: 'Summarize the architecture and call out risky TODOs.' },
  ];

  return (
    <div className="py-20 flex flex-col items-center text-center">
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-accent/10 shadow-[0_0_50px_rgba(235,208,26,0.4)] border border-accent/30">
         <div className="h-12 w-12 rounded-full bg-accent shadow-[0_0_30px_rgba(235,208,26,0.8)] animate-[pulse_4s_ease-in-out_infinite]" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight text-ink">Welcome back{username ? <span className="text-accent"> {username}</span> : ''}!</h1>
      <p className="mt-4 max-w-2xl text-base leading-6 text-muted">Which workspace or project do you want to analyze today?</p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 max-w-3xl w-full text-left">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-3xl border border-line bg-elevated/40 p-5 shadow-float backdrop-blur-md transition-colors hover:border-accent/50 hover:bg-elevated/60">
              <div className="flex items-center gap-3 text-sm font-semibold text-ink">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon size={16} />
                </div>
                {card.title}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted pl-11">{card.body}</p>
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
