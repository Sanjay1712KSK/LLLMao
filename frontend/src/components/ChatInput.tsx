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
    isModelLoading,
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
      className={clsx('sticky bottom-0 px-4 py-6 z-10', dragActive ? 'border-accent' : 'border-transparent')}
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
      <div className={clsx('mx-auto max-w-4xl rounded-3xl border bg-elevated/90 p-3 shadow-float backdrop-blur-md transition-colors', dragActive ? 'border-accent bg-accent/5' : 'border-line')}>
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="flex flex-wrap gap-2">
          <button
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              useKnowledgeBase ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-muted hover:bg-hover hover:text-ink'
            }`}
            type="button"
            onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
            title="Use Knowledge Base"
          >
            <BookOpen size={14} />
            Use Knowledge Base
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              useWorkspace ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-muted hover:bg-hover hover:text-ink'
            }`}
            type="button"
            onClick={() => setUseWorkspace(!useWorkspace)}
            title="Use Workspace"
          >
            <FolderGit2 size={14} />
            Use Workspace
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-ink"
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
              <div key={image.previewUrl} className="group relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-line bg-input">
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
                  {image.status === 'uploading' && <div className="mt-1 h-1 rounded bg-subtle"><div className="h-full rounded bg-accent" style={{ width: `${image.progress}%` }} /></div>}
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
          className="max-h-48 min-h-[56px] flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-tertiary disabled:opacity-50"
          placeholder={!health.ok ? 'Start Ollama, then refresh the app' : isModelLoading ? 'Warming up model...' : 'Ask a local model...'}
          value={value}
          disabled={!health.ok || !selectedModel || isModelLoading}
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
            className="mb-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line text-red-300 hover:bg-red-500/15"
            onClick={stopGeneration}
            type="button"
            title="Stop generation"
          >
            <Square size={17} />
          </button>
        ) : (
          <button
            className="mb-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink disabled:cursor-not-allowed disabled:opacity-40 transition-opacity hover:brightness-110"
            onClick={submit}
            disabled={!value.trim() || !health.ok || !selectedModel || isModelLoading}
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
