import { Send, Square } from 'lucide-react';
import { useState } from 'react';

import { useChatStore } from '../store/chatStore';

export function ChatInput() {
  const [value, setValue] = useState('');
  const { sendMessage, stopGeneration, isStreaming, selectedModel, health } = useChatStore();

  const submit = async () => {
    if (!value.trim() || isStreaming) return;
    const content = value;
    setValue('');
    await sendMessage(content);
  };

  return (
    <div className="sticky bottom-0 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-xl border border-line bg-panel p-2 shadow-soft">
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
  );
}
