import { BookOpen, FolderGit2, ImagePlus, Send, Square, X } from 'lucide-react';
import { useRef, useState } from 'react';

import { useChatStore } from '../store/chatStore';
import { useMultimodalStore } from '../store/multimodalStore';

export function ChatInput() {
  const [value, setValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    sendMessage,
    stopGeneration,
    isStreaming,
    selectedModel,
    health,
    useKnowledgeBase,
    useWorkspace,
    setUseKnowledgeBase,
    setUseWorkspace,
  } = useChatStore();
  const { pendingImages, addImages, removeImage } = useMultimodalStore();

  const submit = async () => {
    if (!value.trim() || isStreaming) return;
    const content = value;
    setValue('');
    await sendMessage(content);
  };

  return (
    <div
      className="sticky bottom-0 border-t border-line bg-surface/95 px-4 py-4 backdrop-blur"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addImages(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="mx-auto max-w-4xl rounded-xl border border-line bg-panel p-2 shadow-soft">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="flex flex-wrap gap-2">
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
          <button
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
              useWorkspace ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:bg-white/5 hover:text-ink'
            }`}
            type="button"
            onClick={() => setUseWorkspace(!useWorkspace)}
            title="Use Workspace"
          >
            <FolderGit2 size={14} />
            Use Workspace
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:bg-white/5 hover:text-ink"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach images"
          >
            <ImagePlus size={14} />
            Images
          </button>
          </div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => addImages(Array.from(event.target.files ?? []))}
          />
        </div>
        {pendingImages.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto px-2">
            {pendingImages.map((image, index) => (
              <div key={image.previewUrl} className="group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                <img className="h-full w-full object-cover" src={image.previewUrl} alt={image.file.name} />
                <button
                  className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100"
                  type="button"
                  title="Remove image"
                  onClick={() => removeImage(index)}
                >
                  <X size={12} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-[10px] text-white">{image.status}</div>
              </div>
            ))}
          </div>
        )}
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
