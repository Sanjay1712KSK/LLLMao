import { create } from 'zustand';

import { api } from '../services/api';
import type { KnowledgeDocument } from '../types/api';
import { useNotificationStore } from './notificationStore';

type KnowledgeState = {
  documents: KnowledgeDocument[];
  uploadProgress: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  retryUpload: (file: File) => Promise<void>;
  refreshDocuments: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  reindexDocument: (documentId: string) => Promise<void>;
  cancelDocument: (documentId: string) => Promise<void>;
};

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  documents: [],
  uploadProgress: {},
  isLoading: false,
  error: null,

  refreshDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const documents = await api.documents();
      set({ documents, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Unable to load documents' });
    }
  },

  uploadFiles: async (files) => {
    set({ error: null });
    for (const file of files) {
      const key = `${file.name}-${file.lastModified}`;
      set((state) => ({ uploadProgress: { ...state.uploadProgress, [key]: 0 } }));
      try {
        await uploadWithRetry(file, (progress) => set((state) => ({ uploadProgress: { ...state.uploadProgress, [key]: progress } })));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        const details = error && typeof error === 'object' && 'details' in error ? String(error.details ?? '') : undefined;
        set({ error: message });
        useNotificationStore.getState().notify({ kind: 'error', title: 'Document upload failed', message, details });
      } finally {
        set((state) => {
          const next = { ...state.uploadProgress };
          delete next[key];
          return { uploadProgress: next };
        });
        await get().refreshDocuments();
      }
    }
  },

  retryUpload: async (file) => get().uploadFiles([file]),

  deleteDocument: async (documentId) => {
    await api.deleteDocument(documentId);
    await get().refreshDocuments();
  },

  reindexDocument: async (documentId) => {
    await api.reindexDocument(documentId);
    await get().refreshDocuments();
  },

  cancelDocument: async (documentId) => {
    await api.cancelDocument(documentId);
    await get().refreshDocuments();
  },
}));

async function uploadWithRetry(file: File, onProgress: (progress: number) => void) {
  try {
    return await api.uploadDocument(file, onProgress);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'BACKEND_UNAVAILABLE') {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      return api.uploadDocument(file, onProgress);
    }
    throw error;
  }
}
