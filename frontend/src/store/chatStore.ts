import { create } from 'zustand';

import { api } from '../services/api';
import type { Chat, Message, OllamaHealth, OllamaModel } from '../types/api';

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
  useKnowledgeBase: boolean;
  bootstrap: () => Promise<void>;
  createChat: () => Promise<void>;
  selectChat: (chatId: number) => Promise<void>;
  renameChat: (chatId: number, title: string) => Promise<void>;
  togglePinned: (chatId: number) => Promise<void>;
  deleteChat: (chatId: number) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedModel: (model: string) => void;
  setUseKnowledgeBase: (enabled: boolean) => void;
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
  useKnowledgeBase: false,

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
  setUseKnowledgeBase: (useKnowledgeBase) => set({ useKnowledgeBase }),

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
      return;
    }

    const controller = new AbortController();
    const assistantId = optimisticId();
    const now = new Date().toISOString();
    const startedAt = performance.now();
    let streamedChars = 0;
    set((state) => ({
      error: null,
      isStreaming: true,
      tokensPerSecond: null,
      controller,
      messages: [
        ...state.messages,
        { id: optimisticId(), chat_id: chatId!, role: 'user', content: trimmed, created_at: now },
        { id: assistantId, chat_id: chatId!, role: 'assistant', content: '', created_at: now },
      ],
    }));

    try {
      const onChunk = (chunk: string) => {
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
      if (get().useKnowledgeBase) {
        await api.streamRagChat(
          { chat_id: chatId, model: selectedModel, message: trimmed },
          onChunk,
          (sources) => {
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
      set({ chats, messages, isStreaming: false, controller: null });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        set({ error: error instanceof Error ? error.message : 'Chat request failed' });
      }
      set({ isStreaming: false, controller: null });
    }
  },

  stopGeneration: () => {
    get().controller?.abort();
    set({ isStreaming: false, controller: null });
  },
}));
