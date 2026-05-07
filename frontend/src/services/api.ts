import type {
  Chat,
  ImageAsset,
  KnowledgeChunk,
  KnowledgeDocument,
  ContextDebug,
  ConversationSummary,
  DiagnosticsReport,
  GitStatus,
  MemoryEntry,
  MemoryStatus,
  Message,
  OllamaHealth,
  OllamaModel,
  PatchProposal,
  RagSource,
  RetrievalDebug,
  SystemStats,
  TerminalResult,
  Workspace,
  WorkspaceFile,
  WorkspaceSource,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  code?: string;
  details?: string;
  status?: number;

  constructor(message: string, options: { code?: string; details?: string; status?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.details = options.details;
    this.status = options.status;
  }
}

function parseErrorPayload(raw: string, status?: number): ApiError {
  try {
    const payload = JSON.parse(raw) as {
      error?: boolean;
      code?: string;
      message?: string;
      details?: string;
      detail?: string | { error?: boolean; code?: string; message?: string; details?: string };
    };
    const structured = typeof payload.detail === 'object' ? payload.detail : payload;
    if (structured?.message) {
      return new ApiError(structured.message, { code: structured.code, details: structured.details, status });
    }
    if (typeof payload.detail === 'string') return new ApiError(payload.detail, { status });
  } catch {
    // Fall through to a text error.
  }
  return new ApiError(raw || 'Request failed', { status });
}

async function responseError(response: Response): Promise<ApiError> {
  return parseErrorPayload(await response.text(), response.status);
}

function xhrError(request: XMLHttpRequest, fallback: string): ApiError {
  return parseErrorPayload(request.responseText || fallback || request.statusText, request.status);
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (error) {
    throw new ApiError('Backend unavailable.', {
      code: 'BACKEND_UNAVAILABLE',
      details: error instanceof Error ? error.message : 'Network request failed.',
    });
  }
  if (!response.ok) {
    throw await responseError(response);
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
    if (!response.ok) throw await responseError(response);
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
    if (!response.ok) throw await responseError(response);
  },
  deleteDocument: async (documentId: string) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, { method: 'DELETE' });
    if (!response.ok) throw await responseError(response);
  },
  reindexDocument: (documentId: string) => jsonRequest<KnowledgeDocument>(`/documents/${documentId}/reindex`, { method: 'POST' }),
  cancelDocument: (documentId: string) => jsonRequest<KnowledgeDocument>(`/documents/${documentId}/cancel`, { method: 'POST' }),
  uploadDocument: (file: File, onProgress?: (progress: number) => void) =>
    new Promise<KnowledgeDocument>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE_URL}/upload`);
      request.timeout = 120000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(JSON.parse(request.responseText) as KnowledgeDocument);
        } else {
          reject(xhrError(request, 'Upload failed'));
        }
      };
      request.onerror = () => reject(new ApiError('Backend unavailable.', { code: 'BACKEND_UNAVAILABLE', details: 'Document upload request failed.' }));
      request.ontimeout = () => reject(new ApiError('Upload timed out.', { code: 'UPLOAD_TIMEOUT', details: 'The backend did not finish the upload in time.' }));
      request.send(formData);
    }),
  uploadImage: (file: File, chatId?: number | null, onProgress?: (progress: number) => void) =>
    new Promise<ImageAsset>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      const request = new XMLHttpRequest();
      request.open('POST', `${API_BASE_URL}/images/upload${chatId ? `?chat_id=${chatId}` : ''}`);
      request.timeout = 90000;
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          resolve(JSON.parse(request.responseText) as ImageAsset);
        } else {
          reject(xhrError(request, 'Image upload failed'));
        }
      };
      request.onerror = () => reject(new ApiError('Backend unavailable.', { code: 'BACKEND_UNAVAILABLE', details: 'Image upload request failed.' }));
      request.ontimeout = () => reject(new ApiError('Image upload timed out.', { code: 'UPLOAD_TIMEOUT', details: 'The backend did not finish the image upload in time.' }));
      request.send(formData);
    }),
  imageThumbnailUrl: (imageId: string) => `${API_BASE_URL}/images/${imageId}/thumbnail`,
  retrievalDebug: (chatId?: number | null) => jsonRequest<RetrievalDebug[]>(`/retrieval/debug${chatId ? `?chat_id=${chatId}` : ''}`),
  memoryStatus: () => jsonRequest<MemoryStatus>('/memory/status'),
  summarizeMemory: (chatId: number, workspaceId?: string | null) =>
    jsonRequest<ConversationSummary>('/memory/summarize', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, persist: true, scope: workspaceId ? 'workspace' : 'conversation', workspace_id: workspaceId ?? null }),
    }),
  retrieveMemory: (query: string, workspaceId?: string | null) =>
    jsonRequest<MemoryEntry[]>(`/memory/retrieve?query=${encodeURIComponent(query)}${workspaceId ? `&workspace_id=${encodeURIComponent(workspaceId)}` : ''}`),
  contextDebug: (chatId?: number | null) => jsonRequest<ContextDebug[]>(`/context/debug${chatId ? `?chat_id=${chatId}` : ''}`),
  executeTerminal: (payload: { command: string; cwd: string; workspace_id?: string | null }) =>
    jsonRequest<TerminalResult>('/terminal/execute', { method: 'POST', body: JSON.stringify(payload) }),
  gitStatus: (cwd: string, workspaceId?: string | null) =>
    jsonRequest<GitStatus>(`/git/status?cwd=${encodeURIComponent(cwd)}${workspaceId ? `&workspace_id=${encodeURIComponent(workspaceId)}` : ''}`),
  gitDiff: (cwd: string, path?: string | null, workspaceId?: string | null) =>
    jsonRequest<{ diff: string }>(
      `/git/diff?cwd=${encodeURIComponent(cwd)}${path ? `&path=${encodeURIComponent(path)}` : ''}${workspaceId ? `&workspace_id=${encodeURIComponent(workspaceId)}` : ''}`,
    ),
  gitHistory: (cwd: string, workspaceId?: string | null) =>
    jsonRequest<{ commits: Array<{ hash: string; date: string; subject: string }> }>(
      `/git/history?cwd=${encodeURIComponent(cwd)}${workspaceId ? `&workspace_id=${encodeURIComponent(workspaceId)}` : ''}`,
    ),
  proposePatch: (payload: { cwd: string; patch_text: string; title: string; description?: string; workspace_id?: string | null }) =>
    jsonRequest<PatchProposal>('/patch/generate', { method: 'POST', body: JSON.stringify(payload) }),
  applyPatchProposal: (payload: { cwd: string; patch_id: string; approved: boolean }) =>
    jsonRequest<PatchProposal>('/patch/apply', { method: 'POST', body: JSON.stringify(payload) }),
  workspaceSearch: (workspaceId: string, query: string) =>
    jsonRequest<{ query: string; keyword: Array<Record<string, unknown>>; semantic: Array<Record<string, unknown>> }>(
      `/workspace/search?workspace_id=${encodeURIComponent(workspaceId)}&query=${encodeURIComponent(query)}`,
    ),
  workspaceDiagnostics: (workspaceId?: string | null) =>
    jsonRequest<DiagnosticsReport>(`/workspace/diagnostics${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''}`),
  ros2Overview: (workspaceId: string) => jsonRequest<Record<string, unknown>>(`/ros2/overview?workspace_id=${encodeURIComponent(workspaceId)}`),
  readFile: (payload: { cwd: string; path: string }) =>
    jsonRequest<{ path: string; content: string }>('/file/read', { method: 'POST', body: JSON.stringify(payload) }),
  saveFile: (payload: { cwd: string; path: string; content: string }) =>
    jsonRequest<{ path: string; content: string }>('/file/save', { method: 'POST', body: JSON.stringify(payload) }),
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
      throw await responseError(response);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
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
      throw await responseError(response);
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
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        events.forEach(dispatchEvent);
      }
    } finally {
      reader.releaseLock();
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
      throw await responseError(response);
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
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        events.forEach(dispatchEvent);
      }
    } finally {
      reader.releaseLock();
    }
    if (buffer.trim()) dispatchEvent(buffer);
  },
  streamMultimodalChat: async (
    payload: {
      chat_id: number;
      model: string;
      message: string;
      image_ids: string[];
      workspace_id?: string | null;
      use_workspace: boolean;
      use_knowledge_base: boolean;
    },
    onChunk: (chunk: string) => void,
    onSources: (sources: WorkspaceSource[]) => void,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(`${API_BASE_URL}/multimodal/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok || !response.body) {
      throw await responseError(response);
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
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        events.forEach(dispatchEvent);
      }
    } finally {
      reader.releaseLock();
    }
    if (buffer.trim()) dispatchEvent(buffer);
  },
  streamIntelligentChat: async (
    payload: {
      chat_id: number;
      model: string;
      message: string;
      workspace_id?: string | null;
      use_workspace: boolean;
      use_documents: boolean;
    },
    onChunk: (chunk: string) => void,
    onContext: (context: ContextDebug['composition']) => void,
    signal?: AbortSignal,
  ) => {
    const response = await fetch(`${API_BASE_URL}/chat/intelligent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok || !response.body) {
      throw await responseError(response);
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
      if (event === 'context') onContext(JSON.parse(data) as ContextDebug['composition']);
      if (event === 'token') onChunk(JSON.parse(data) as string);
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        events.forEach(dispatchEvent);
      }
    } finally {
      reader.releaseLock();
    }
    if (buffer.trim()) dispatchEvent(buffer);
  },
};
