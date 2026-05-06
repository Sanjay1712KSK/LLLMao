import type { Chat, Message, OllamaHealth, OllamaModel } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => jsonRequest<OllamaHealth>('/health'),
  models: () => jsonRequest<OllamaModel[]>('/models'),
  chats: () => jsonRequest<Chat[]>('/chats'),
  createChat: (title = 'New chat') =>
    jsonRequest<Chat>('/chats', { method: 'POST', body: JSON.stringify({ title }) }),
  renameChat: (chatId: number, title: string) =>
    jsonRequest<Chat>(`/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteChat: async (chatId: number) => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await response.text());
  },
  messages: (chatId: number) => jsonRequest<Message[]>(`/messages/${chatId}`),
  streamChat: async (
    payload: { chat_id: number; model: string; message: string },
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error((await response.text()) || response.statusText);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  },
};
