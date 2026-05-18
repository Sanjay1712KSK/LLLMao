import { BookOpen, FolderGit2, ImagePlus, Send, Square, X } from 'lucide-react';
import { useRef, useState } from 'react';
import clsx from 'clsx';

import { useChatStore } from '../store/chatStore';
import { useMultimodalStore } from '../store/multimodalStore';
import { AudioRecorder } from './audio/AudioRecorder';

export function ChatInput() {
  const [value, setValue] = useState('');
  const [dragActive, setDragActive] = useState(false);
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
  const { pendingImages, addImages, removeImage, error, errorDetails } = useMultimodalStore();

  const submit = async () => {
    if (!value.trim() || isStreaming) return;
    const content = value;
    setValue('');
    await sendMessage(content);
  };

  const submitTranscript = async (transcript: string) => {
    setValue(transcript);
    await sendMessage(transcript);
    setValue('');
  };

  return (
    <div
      className={clsx('sticky bottom-0 border-t bg-surface/95 px-4 py-4 backdrop-blur', dragActive ? 'border-accent' : 'border-line')}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        addImages(Array.from(event.dataTransfer.files));
      }}
    >
      <div className={clsx('mx-auto max-w-4xl rounded-xl border bg-panel p-2 shadow-soft transition-colors', dragActive ? 'border-accent bg-accent/5' : 'border-line')}>
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
          <AudioRecorder onTranscript={submitTranscript} />
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
        {dragActive && (
          <div className="mb-2 rounded-lg border border-dashed border-accent bg-accent/10 px-3 py-2 text-xs text-accent">
            Drop images to attach them to this message.
          </div>
        )}
        {pendingImages.length > 0 && (
          <div className="mb-2 flex gap-3 overflow-x-auto px-2 pb-1">
            {pendingImages.map((image, index) => (
              <div key={image.previewUrl} className="group relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                <img className="h-full w-full object-cover" src={image.previewUrl} alt={image.file.name} />
                <button
                  className="absolute right-1 top-1 rounded-md bg-black/75 p-1 text-white opacity-90 hover:bg-red-500"
                  type="button"
                  title="Remove image"
                  onClick={() => removeImage(index)}
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 px-2 py-1 text-[11px] text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{image.error || image.status}</span>
                    {image.status === 'uploading' && <span>{image.progress}%</span>}
                  </div>
                  {image.status === 'uploading' && <div className="mt-1 h-1 rounded bg-white/20"><div className="h-full rounded bg-accent" style={{ width: `${image.progress}%` }} /></div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
            {errorDetails && (
              <details className="mt-1 text-red-100/80">
                <summary className="cursor-pointer">Technical details</summary>
                <div className="mt-1 font-mono text-[11px]">{errorDetails}</div>
              </details>
            )}
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
