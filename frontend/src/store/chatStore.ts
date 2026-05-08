import { create } from 'zustand';

import { api, API_BASE_URL } from '../services/api';
import type { Chat, Message, OllamaHealth, OllamaModel } from '../types/api';
import { useMultimodalStore } from './multimodalStore';
import { useNotificationStore } from './notificationStore';
import { useWorkspaceStore } from './workspaceStore';
import { useAudioStore } from './audioStore';

type ChatState = {
  chats: Chat[];
  messages: Message[];
  models: OllamaModel[];
  currentChatId: number | null;
  selectedModel: string;
  health: OllamaHealth;
  isLoading: boolean;
  isStreaming: boolean;
  tokensPerSecond: number | null;
  searchQuery: string;
  error: string | null;
  controller: AbortController | null;
  streamFrame: number | null;
  useKnowledgeBase: boolean;
  useWorkspace: boolean;
  bootstrap: () => Promise<void>;
  createChat: () => Promise<void>;
  selectChat: (chatId: number) => Promise<void>;
  renameChat: (chatId: number, title: string) => Promise<void>;
  togglePinned: (chatId: number) => Promise<void>;
  deleteChat: (chatId: number) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedModel: (model: string) => void;
  setUseKnowledgeBase: (enabled: boolean) => void;
  setUseWorkspace: (enabled: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
};

const optimisticId = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: [],
  models: [],
  currentChatId: null,
  selectedModel: '',
  health: { ok: false, message: 'Checking Ollama...', backend_ok: false, ollama_ok: false, database_ok: false },
  isLoading: false,
  isStreaming: false,
  tokensPerSecond: null,
  searchQuery: '',
  error: null,
  controller: null,
  streamFrame: null,
  useKnowledgeBase: false,
  useWorkspace: false,

  bootstrap: async () => {
    set({ isLoading: true, error: null });
    try {
      const health = await api.health();
      let models: OllamaModel[] = [];
      if (health.ok) models = await api.models();
      const chats = await api.chats();
      const selectedModel = get().selectedModel || models[0]?.name || '';
      const currentChatId = chats[0]?.id ?? null;
      const messages = currentChatId ? await api.messages(currentChatId) : [];
      set({ health, models, chats, selectedModel, currentChatId, messages, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        health: {
          ok: false,
          message: 'Unable to connect to the local backend or Ollama.',
          backend_ok: false,
          ollama_ok: false,
          database_ok: false,
        },
        error: error instanceof Error ? error.message : 'Startup failed',
      });
      useNotificationStore.getState().notify({
        kind: 'error',
        title: 'Backend unavailable',
        message: error instanceof Error ? error.message : 'Startup failed',
      });
    }
  },

  createChat: async () => {
    const chat = await api.createChat();
    set((state) => ({ chats: [chat, ...state.chats], currentChatId: chat.id, messages: [] }));
  },

  selectChat: async (chatId) => {
    set({ currentChatId: chatId, isLoading: true });
    const messages = await api.messages(chatId);
    set({ messages, isLoading: false });
  },

  renameChat: async (chatId, title) => {
    const chat = await api.renameChat(chatId, title);
    set((state) => ({ chats: state.chats.map((item) => (item.id === chatId ? chat : item)) }));
  },

  togglePinned: async (chatId) => {
    const current = get().chats.find((chat) => chat.id === chatId);
    if (!current) return;
    const chat = await api.updateChat(chatId, { pinned: !current.pinned });
    const chats = get()
      .chats.map((item) => (item.id === chatId ? chat : item))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updated_at) - Date.parse(a.updated_at));
    set({ chats });
  },

  deleteChat: async (chatId) => {
    await api.deleteChat(chatId);
    const chats = get().chats.filter((chat) => chat.id !== chatId);
    const nextChatId = get().currentChatId === chatId ? chats[0]?.id ?? null : get().currentChatId;
    const messages = nextChatId ? await api.messages(nextChatId) : [];
    set({ chats, currentChatId: nextChatId, messages });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setUseKnowledgeBase: (useKnowledgeBase) => set({ useKnowledgeBase, useWorkspace: useKnowledgeBase ? false : get().useWorkspace }),
  setUseWorkspace: (useWorkspace) => set({ useWorkspace, useKnowledgeBase: useWorkspace ? false : get().useKnowledgeBase }),

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().isStreaming) return;

    let chatId = get().currentChatId;
    if (!chatId) {
      const chat = await api.createChat();
      chatId = chat.id;
      set((state) => ({ chats: [chat, ...state.chats], currentChatId: chat.id }));
    }

    const selectedModel = get().selectedModel;
    if (!selectedModel) {
      set({ error: 'Select an installed local Ollama model first.' });
      useNotificationStore.getState().notify({ kind: 'error', title: 'No model selected', message: 'Select an installed local Ollama model first.' });
      return;
    }
    if (get().useWorkspace && !useWorkspaceStore.getState().activeWorkspaceId) {
      set({ error: 'Connect and select a workspace first.' });
      useNotificationStore.getState().notify({ kind: 'error', title: 'Workspace unavailable', message: 'Connect and select a workspace first.' });
      return;
    }

    const controller = new AbortController();
    const assistantId = optimisticId();
    const now = new Date().toISOString();
    const startedAt = performance.now();
    let streamedChars = 0;
    let pendingChunk = '';
    let frame: number | null = null;
    let retrievedSources: Message['sources'] = [];
    const flushChunk = () => {
      const chunk = pendingChunk;
      pendingChunk = '';
      frame = null;
      if (!chunk) return;
      streamedChars += chunk.length;
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.1);
      const estimatedTokens = streamedChars / 4;
      set((state) => ({
        tokensPerSecond: estimatedTokens / elapsedSeconds,
        messages: state.messages.map((message) =>
          message.id === assistantId ? { ...message, content: message.content + chunk } : message,
        ),
      }));
    };
    set((state) => ({
      error: null,
      isStreaming: true,
      tokensPerSecond: null,
      controller,
      streamFrame: null,
      messages: [
        ...state.messages,
        { id: optimisticId(), chat_id: chatId!, role: 'user', content: trimmed, created_at: now },
        { id: assistantId, chat_id: chatId!, role: 'assistant', content: '', created_at: now },
      ],
    }));

    try {
      const onChunk = (chunk: string) => {
        pendingChunk += chunk;
        if (frame == null) {
          frame = window.requestAnimationFrame(flushChunk);
          set({ streamFrame: frame });
        }
      };
      const pendingImages = useMultimodalStore.getState().pendingImages;
      const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      if (pendingImages.length) {
        const uploadedImages = await useMultimodalStore.getState().ensureUploaded(chatId);
        await api.streamMultimodalChat(
          {
            chat_id: chatId,
            model: selectedModel,
            message: trimmed,
            image_ids: uploadedImages.map((image) => image.id),
            workspace_id: activeWorkspaceId || null,
            use_workspace: get().useWorkspace,
            use_knowledge_base: get().useKnowledgeBase,
          },
          onChunk,
          (sources) => {
            retrievedSources = sources;
            set((state) => ({
              messages: state.messages.map((message) => (message.id === assistantId ? { ...message, sources } : message)),
            }));
          },
          controller.signal,
        );
        useMultimodalStore.getState().clearImages();
      } else if (get().useWorkspace) {
        if (!activeWorkspaceId) {
          set({ error: 'Connect and select a workspace first.', isStreaming: false, controller: null });
          return;
        }
        await api.streamWorkspaceChat(
          { chat_id: chatId, workspace_id: activeWorkspaceId, model: selectedModel, message: trimmed },
          onChunk,
          (sources) => {
            retrievedSources = sources;
            set((state) => ({
              messages: state.messages.map((message) => (message.id === assistantId ? { ...message, sources } : message)),
            }));
          },
          controller.signal,
        );
      } else if (get().useKnowledgeBase) {
        await api.streamRagChat(
          { chat_id: chatId, model: selectedModel, message: trimmed },
          onChunk,
          (sources) => {
            retrievedSources = sources;
            set((state) => ({
              messages: state.messages.map((message) => (message.id === assistantId ? { ...message, sources } : message)),
            }));
          },
          controller.signal,
        );
      } else {
        await api.streamChat(
          { chat_id: chatId, model: selectedModel, message: trimmed },
          onChunk,
          controller.signal,
        );
      }
      const [chats, messages] = await Promise.all([api.chats(), api.messages(chatId)]);
      const hydratedMessages =
        (get().useKnowledgeBase || get().useWorkspace) && retrievedSources.length
          ? messages.map((message, index) =>
              index === messages.length - 1 && message.role === 'assistant' ? { ...message, sources: retrievedSources } : message,
            )
          : messages;
      if (frame != null) window.cancelAnimationFrame(frame);
      flushChunk();
      set({ chats, messages: hydratedMessages, isStreaming: false, controller: null, streamFrame: null });

      const audioState = useAudioStore.getState().state;
      const activeModelId = useAudioStore.getState().activeModelId;
      
      if (audioState === 'WAITING_FOR_LLM' && activeModelId) {
        useAudioStore.getState().setState('GENERATING_TTS');
        const assistantMsg = hydratedMessages[hydratedMessages.length - 1];
        
        if (assistantMsg && assistantMsg.role === 'assistant' && assistantMsg.content && typeof assistantMsg.id === 'number') {
            fetch(`${API_BASE_URL}/audio/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: assistantMsg.content, 
                model_id: activeModelId,
                chat_id: chatId,
                message_id: assistantMsg.id
              })
            }).then(res => {
              if (res.ok) return res.json();
              throw new Error('TTS failed');
            }).then(attachment => {
              set(state => ({
                 messages: state.messages.map(m => 
                   m.id === assistantMsg.id ? { ...m, attachments: [...(m.attachments || []), attachment] } : m
                 )
              }));
              useAudioStore.getState().setState('IDLE');
            }).catch(e => {
              console.error("Failed to generate TTS", e);
              useAudioStore.getState().setState('IDLE');
            });
        } else {
           useAudioStore.getState().setState('IDLE');
        }
      }
    } catch (error) {
      if (frame != null) window.cancelAnimationFrame(frame);
      flushChunk();
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Chat request failed';
        const details = error && typeof error === 'object' && 'details' in error ? String(error.details ?? '') : undefined;
        set({ error: message });
        useNotificationStore.getState().notify({ kind: 'error', title: 'Request failed', message, details });
      }
      set({ isStreaming: false, controller: null, streamFrame: null });
    }
  },

  stopGeneration: () => {
    const frame = get().streamFrame;
    if (frame != null) window.cancelAnimationFrame(frame);
    get().controller?.abort();
    set({ isStreaming: false, controller: null, streamFrame: null });
  },
}));
