import { FileText, RefreshCw, Trash2, Upload, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';

import { useKnowledgeStore } from '../store/knowledgeStore';

const acceptedTypes = '.pdf,.txt,.md,.markdown,.docx,.csv,.json';

export function KnowledgeBasePanel() {
  const { documents, uploadProgress, error, refreshDocuments, uploadFiles, deleteDocument, reindexDocument, cancelDocument } =
    useKnowledgeStore();
  const [dragging, setDragging] = useState(false);
  const activeUploads = Object.entries(uploadProgress);
  const hasIndexingWork = useMemo(
    () => documents.some((document) => ['queued', 'indexing', 'cancelling'].includes(document.status)),
    [documents],
  );

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    if (!hasIndexingWork) return;
    const interval = window.setInterval(() => {
      void refreshDocuments();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [hasIndexingWork, refreshDocuments]);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length) void uploadFiles(files);
    },
    [uploadFiles],
  );

  return (
    <section className="border-t border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
          <FileText size={14} />
          Knowledge
        </div>
        <button className="rounded p-1 text-muted hover:bg-white/10 hover:text-ink" type="button" title="Refresh documents" onClick={() => refreshDocuments()}>
          <RefreshCw size={14} />
        </button>
      </div>

      <label
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted transition',
          dragging ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface hover:border-accent/70 hover:text-ink',
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <Upload size={18} className="mb-2 text-accent" />
        Drop files or click to upload
        <input className="hidden" type="file" accept={acceptedTypes} multiple onChange={(event) => handleFiles(event.target.files)} />
      </label>

      {activeUploads.length > 0 && (
        <div className="mt-2 space-y-2">
          {activeUploads.map(([name, progress]) => (
            <div key={name} className="rounded-lg border border-line bg-panel p-2">
              <div className="truncate text-xs text-ink">{name.split('-').slice(0, -1).join('-')}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {documents.map((document) => (
          <div key={document.id} className="rounded-lg border border-line bg-panel p-2">
            <div className="flex items-start gap-2">
              <FileText size={15} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-ink" title={document.filename}>
                  {document.filename}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                  <span className={clsx('rounded px-1.5 py-0.5', statusClass(document.status))}>{document.status}</span>
                  <span>{document.chunk_count} chunks</span>
                  <span>{document.file_type.toUpperCase()}</span>
                </div>
                {document.error_message && <div className="mt-1 max-h-8 overflow-hidden text-[11px] text-red-300">{document.error_message}</div>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1">
              {['queued', 'indexing'].includes(document.status) && (
                <button
                  className="rounded p-1 text-muted hover:bg-white/10 hover:text-red-300"
                  type="button"
                  title="Cancel indexing"
                  onClick={() => cancelDocument(document.id)}
                >
                  <XCircle size={14} />
                </button>
              )}
              <button
                className="rounded p-1 text-muted hover:bg-white/10 hover:text-ink"
                type="button"
                title="Reindex document"
                onClick={() => reindexDocument(document.id)}
              >
                <RefreshCw size={14} />
              </button>
              <button
                className="rounded p-1 text-muted hover:bg-red-500/20 hover:text-red-300"
                type="button"
                title="Delete document"
                onClick={() => deleteDocument(document.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!documents.length && <div className="rounded-lg border border-line bg-panel p-3 text-xs text-muted">No indexed documents yet.</div>}
      </div>
      {error && <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error}</div>}
    </section>
  );
}

function statusClass(status: string) {
  if (status === 'indexed') return 'bg-accent/15 text-accent';
  if (status === 'failed') return 'bg-red-500/15 text-red-300';
  if (['queued', 'indexing', 'cancelling'].includes(status)) return 'bg-blue-500/15 text-blue-200';
  return 'bg-white/10 text-muted';
}
