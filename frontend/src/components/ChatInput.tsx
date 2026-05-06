import { BookOpen, Send, Square } from 'lucide-react';
import { useState } from 'react';

import { useChatStore } from '../store/chatStore';

export function ChatInput() {
  const [value, setValue] = useState('');
  const { sendMessage, stopGeneration, isStreaming, selectedModel, health, useKnowledgeBase, setUseKnowledgeBase } = useChatStore();

  const submit = async () => {
    if (!value.trim() || isStreaming) return;
    const content = value;
    setValue('');
    await sendMessage(content);
  };

  return (
    <div className="sticky bottom-0 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto max-w-4xl rounded-xl border border-line bg-panel p-2 shadow-soft">
        <div className="mb-2 flex items-center justify-between px-2">
          <button
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
              useKnowledgeBase ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:bg-white/5 hover:text-ink'
            }`}
            type="button"
            onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
            title="Use Knowledge Base"
          >
            <BookOpen size={14} />
            Use Knowledge Base
          </button>
          {useKnowledgeBase && <span className="text-xs text-muted">RAG mode</span>}
        </div>
        <div className="flex items-end gap-3">
        <textarea
          className="max-h-48 min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted"
          placeholder={health.ok ? 'Ask a local model...' : 'Start Ollama, then refresh the app'}
          value={value}
          disabled={!health.ok || !selectedModel}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {isStreaming ? (
          <button
            className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-red-300 hover:bg-red-500/15"
            onClick={stopGeneration}
            type="button"
            title="Stop generation"
          >
            <Square size={17} />
          </button>
        ) : (
          <button
            className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-[#07110e] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={submit}
            disabled={!value.trim() || !health.ok || !selectedModel}
            type="button"
            title="Send message"
          >
            <Send size={18} />
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
