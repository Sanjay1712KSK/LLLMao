import clsx from 'clsx';

import { useAutoScroll } from '../hooks/useAutoScroll';
import { useChatStore } from '../store/chatStore';
import { MarkdownMessage } from './MarkdownMessage';

export function ChatView() {
  const { messages, isStreaming, health, error } = useChatStore();
  const bottomRef = useAutoScroll(messages.map((message) => message.content).join('|'));

  if (!health.ok) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-line bg-panel p-6 text-center shadow-soft">
          <h1 className="text-xl font-semibold text-ink">Ollama is not available</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Install or start Ollama locally, confirm it is serving at <code>http://localhost:11434</code>, then restart this workspace.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {!messages.length && (
          <div className="py-20 text-center">
            <h1 className="text-3xl font-semibold tracking-normal text-ink">What are we building locally?</h1>
            <p className="mt-3 text-sm text-muted">Chat with already-installed Ollama models. No cloud inference, no model management.</p>
          </div>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={clsx(
              'flex gap-4 rounded-xl px-3 py-2',
              message.role === 'assistant' ? 'bg-transparent' : 'bg-white/[0.045]',
            )}
          >
            <div
              className={clsx(
                'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                message.role === 'assistant' ? 'bg-accent text-[#07110e]' : 'bg-white/10 text-ink',
              )}
            >
              {message.role === 'assistant' ? 'AI' : 'You'}
            </div>
            <div className="min-w-0 flex-1 text-sm leading-7 text-ink">
              {message.content ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <span className="inline-flex items-center gap-1 text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted/40" />
                </span>
              )}
            </div>
          </article>
        ))}
        {isStreaming && <div className="px-14 text-xs text-muted">Streaming from Ollama...</div>}
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        <div ref={bottomRef} />
      </div>
    </main>
  );
}
