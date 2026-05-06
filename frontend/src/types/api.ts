export type OllamaHealth = {
  ok: boolean;
  message: string;
  backend_ok: boolean;
  ollama_ok: boolean;
  database_ok: boolean;
};

export type OllamaModel = {
  name: string;
  modified_at?: string | null;
  size?: number | null;
  family?: string | null;
  parameter_size?: string | null;
  quantization_level?: string | null;
};

export type Chat = {
  id: number;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: number | string;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  sources?: RetrievalSource[];
};

export type DocumentStatus = 'queued' | 'indexing' | 'indexed' | 'failed' | 'cancelled' | 'cancelling' | string;

export type KnowledgeDocument = {
  id: string;
  filename: string;
  file_type: string;
  status: DocumentStatus;
  error_message?: string | null;
  indexed_at?: string | null;
  chunk_count: number;
  embedding_model: string;
  progress_done: number;
  progress_total: number;
  created_at: string;
  updated_at: string;
};

export type KnowledgeChunk = {
  id: string;
  document_id: string;
  filename: string;
  source_type: string;
  chunk_index: number;
  section_title?: string | null;
  token_count: number;
  content: string;
  created_at: string;
};

export type RagSource = {
  filename: string;
  section_title?: string | null;
  chunk_index: number;
  source_type: string;
  distance?: number | null;
};

export type Workspace = {
  id: string;
  name: string;
  root_path: string;
  status: string;
  error_message?: string | null;
  indexed_at?: string | null;
  file_count: number;
  symbol_count: number;
  embedding_model: string;
  progress_done: number;
  progress_total: number;
  created_at: string;
  updated_at: string;
};

export type WorkspaceFile = {
  id: string;
  workspace_id: string;
  relative_path: string;
  language: string;
  status: string;
  size_bytes: number;
  last_modified: string;
  indexed_at?: string | null;
  chunk_count: number;
};

export type WorkspaceSource = {
  file_path: string;
  language: string;
  chunk_type: string;
  symbol_name?: string | null;
  start_line: number;
  end_line: number;
  score: number;
};

export type RetrievalSource = RagSource | WorkspaceSource;

export type GpuStats = {
  name?: string | null;
  vendor?: string | null;
  utilization_percent?: number | null;
  vram_used_mb?: number | null;
  vram_total_mb?: number | null;
};

export type SystemStats = {
  cpu_percent: number;
  ram_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  gpu?: GpuStats | null;
  active_model?: string | null;
  backend_ok: boolean;
  ollama_ok: boolean;
  database_ok: boolean;
};
