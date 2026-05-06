import type {
  Chat,
  KnowledgeChunk,
  KnowledgeDocument,
  Message,
  OllamaHealth,
  OllamaModel,
  RagSource,
  SystemStats,
  Workspace,
  WorkspaceFile,
  WorkspaceSource,
} from '../types/api';

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
  stats: () => jsonRequest<SystemStats>('/stats'),
  models: () => jsonRequest<OllamaModel[]>('/models'),
  chats: () => jsonRequest<Chat[]>('/chats'),
  createChat: (title = 'New chat') =>
    jsonRequest<Chat>('/chats', { method: 'POST', body: JSON.stringify({ title }) }),
  renameChat: (chatId: number, title: string) =>
    jsonRequest<Chat>(`/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  updateChat: (chatId: number, payload: { title?: string; pinned?: boolean }) =>
    jsonRequest<Chat>(`/chats/${chatId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteChat: async (chatId: number) => {
    const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await response.text());
  },
  messages: (chatId: number) => jsonRequest<Message[]>(`/messages/${chatId}`),
  documents: () => jsonRequest<KnowledgeDocument[]>('/documents'),
  chunks: (documentId: string) => jsonRequest<KnowledgeChunk[]>(`/documents/${documentId}/chunks`),
  workspaces: () => jsonRequest<Workspace[]>('/workspaces'),
  connectWorkspace: (path: string, name?: string) =>
    jsonRequest<Workspace>('/workspace/connect', { method: 'POST', body: JSON.stringify({ path, name }) }),
  workspaceFiles: (workspaceId: string) => jsonRequest<WorkspaceFile[]>(`/workspace/${workspaceId}/files`),
  reindexWorkspace: (workspaceId: string) => jsonRequest<Workspace>(`/workspace/${workspaceId}/reindex`, { method: 'POST' }),
  disconnectWorkspace: async (workspaceId: string) => {
    const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await response.text());
  },
  deleteDocument: async (documentId: string) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await response.text());
  },
  reindexDocument: (documentId: string) => jsonRequest<KnowledgeDocument>(`/documents/${documentId}/reindex`, { method: 'POST' }),
  cancelDocument: (documentId: string) => jsonRequest<KnowledgeDocument>(`/documents/${documentId}/cancel`, { method: 'POST' }),
  uploadDocument: (file: File, onProgress?: (progress: number) => void) =>
    new Promise<KnowledgeDocument>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE_URL}/upload`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(JSON.parse(request.responseText) as KnowledgeDocument);
        } else {
          reject(new Error(request.responseText || request.statusText));
        }
      };
      request.onerror = () => reject(new Error('Upload failed'));
      request.send(formData);
    }),
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
  streamRagChat: async (
    payload: { chat_id: number; model: string; message: string },
    onChunk: (chunk: string) => void,
    onSources: (sources: RagSource[]) => void,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(`${API_BASE_URL}/rag/chat`, {
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
    let buffer = '';
    const dispatchEvent = (raw: string) => {
      const lines = raw.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
      if (!event || !data) return;
      if (event === 'sources') onSources(JSON.parse(data) as RagSource[]);
      if (event === 'token') onChunk(JSON.parse(data) as string);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      events.forEach(dispatchEvent);
    }
    if (buffer.trim()) dispatchEvent(buffer);
  },
  streamWorkspaceChat: async (
    payload: { chat_id: number; workspace_id: string; model: string; message: string },
    onChunk: (chunk: string) => void,
    onSources: (sources: WorkspaceSource[]) => void,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(`${API_BASE_URL}/workspace/chat`, {
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
    let buffer = '';
    const dispatchEvent = (raw: string) => {
      const lines = raw.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
      if (!event || !data) return;
      if (event === 'sources') onSources(JSON.parse(data) as WorkspaceSource[]);
      if (event === 'token') onChunk(JSON.parse(data) as string);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      events.forEach(dispatchEvent);
    }
    if (buffer.trim()) dispatchEvent(buffer);
  },
};
