import { create } from 'zustand';

import { api } from '../services/api';
import type { ImageAsset, RetrievalDebug } from '../types/api';

type PendingImage = {
  file: File;
  previewUrl: string;
  uploaded?: ImageAsset;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
};

type MultimodalState = {
  pendingImages: PendingImage[];
  debugLogs: RetrievalDebug[];
  error: string | null;
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

  addImages: (files) => {
    const images = files
      .filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file), status: 'pending' as const }));
    set((state) => ({ pendingImages: [...state.pendingImages, ...images].slice(0, 4), error: null }));
  },

  removeImage: (index) => {
    const image = get().pendingImages[index];
    if (image) URL.revokeObjectURL(image.previewUrl);
    set((state) => ({ pendingImages: state.pendingImages.filter((_, itemIndex) => itemIndex !== index) }));
  },

  clearImages: () => {
    get().pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    set({ pendingImages: [] });
  },

  ensureUploaded: async (chatId) => {
    const uploaded: ImageAsset[] = [];
    for (const [index, image] of get().pendingImages.entries()) {
      if (image.uploaded) {
        uploaded.push(image.uploaded);
        continue;
      }
      set((state) => ({
        pendingImages: state.pendingImages.map((item, itemIndex) => (itemIndex === index ? { ...item, status: 'uploading' } : item)),
      }));
      const result = await api.uploadImage(image.file, chatId);
      uploaded.push(result);
      set((state) => ({
        pendingImages: state.pendingImages.map((item, itemIndex) =>
          itemIndex === index ? { ...item, uploaded: result, status: 'uploaded' } : item,
        ),
      }));
    }
    return uploaded;
  },

  refreshDebug: async (chatId) => {
    const debugLogs = await api.retrievalDebug(chatId);
    set({ debugLogs });
  },
}));
