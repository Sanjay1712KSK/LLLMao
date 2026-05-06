import { create } from 'zustand';

import { api } from '../services/api';
import type { KnowledgeDocument } from '../types/api';

type KnowledgeState = {
  documents: KnowledgeDocument[];
  uploadProgress: Record<string, number>;
  isLoading: boolean;
  error: string | null;
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
        await api.uploadDocument(file, (progress) =>
          set((state) => ({ uploadProgress: { ...state.uploadProgress, [key]: progress } })),
        );
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Upload failed' });
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
