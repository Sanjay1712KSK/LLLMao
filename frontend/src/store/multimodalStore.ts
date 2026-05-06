import { create } from 'zustand';

import { api } from '../services/api';
import type { ImageAsset, RetrievalDebug } from '../types/api';
import { useNotificationStore } from './notificationStore';

type PendingImage = {
  file: File;
  previewUrl: string;
  uploaded?: ImageAsset;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  progress: number;
  error?: string;
};

type MultimodalState = {
  pendingImages: PendingImage[];
  debugLogs: RetrievalDebug[];
  error: string | null;
  errorDetails: string | null;
  addImages: (files: File[]) => void;
  removeImage: (index: number) => void;
  clearImages: () => void;
  ensureUploaded: (chatId: number) => Promise<ImageAsset[]>;
  refreshDebug: (chatId?: number | null) => Promise<void>;
};

export const useMultimodalStore = create<MultimodalState>((set, get) => ({
  pendingImages: [],
  debugLogs: [],
  error: null,
  errorDetails: null,

  addImages: (files) => {
    const rejected = files.filter((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
    const images = files
      .filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file), status: 'pending' as const, progress: 0 }));
    if (rejected.length) {
      useNotificationStore.getState().notify({
        kind: 'error',
        title: 'Image not added',
        message: 'Use PNG, JPG, JPEG, or WEBP files.',
        details: rejected.map((file) => `${file.name}: ${file.type || 'unknown type'}`).join('\n'),
      });
    }
    set((state) => {
      const next = [...state.pendingImages, ...images];
      next.slice(4).forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return { pendingImages: next.slice(0, 4), error: null, errorDetails: null };
    });
  },

  removeImage: (index) => {
    const image = get().pendingImages[index];
    if (image) URL.revokeObjectURL(image.previewUrl);
    set((state) => ({ pendingImages: state.pendingImages.filter((_, itemIndex) => itemIndex !== index) }));
  },

  clearImages: () => {
    get().pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    set({ pendingImages: [], error: null, errorDetails: null });
  },

  ensureUploaded: async (chatId) => {
    const uploaded: ImageAsset[] = [];
    for (const [index, image] of get().pendingImages.entries()) {
      if (image.uploaded) {
        uploaded.push(image.uploaded);
        continue;
      }
      set((state) => ({
        pendingImages: state.pendingImages.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: 'uploading', progress: 1, error: undefined } : item,
        ),
      }));
      try {
        const result = await api.uploadImage(image.file, chatId, (progress) => {
          set((state) => ({
            pendingImages: state.pendingImages.map((item, itemIndex) => (itemIndex === index ? { ...item, progress } : item)),
          }));
        });
        uploaded.push(result);
        set((state) => ({
          pendingImages: state.pendingImages.map((item, itemIndex) =>
            itemIndex === index ? { ...item, uploaded: result, status: 'uploaded', progress: 100 } : item,
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Image upload failed';
        const details = error && typeof error === 'object' && 'details' in error ? String(error.details ?? '') : null;
        set((state) => ({
          error: message,
          errorDetails: details,
          pendingImages: state.pendingImages.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: 'failed', error: message, progress: 0 } : item,
          ),
        }));
        useNotificationStore.getState().notify({
          kind: 'error',
          title: 'Image upload failed',
          message,
          details: details || undefined,
        });
        throw error;
      }
    }
    return uploaded;
  },

  refreshDebug: async (chatId) => {
    const debugLogs = await api.retrievalDebug(chatId);
    set({ debugLogs });
  },
}));
