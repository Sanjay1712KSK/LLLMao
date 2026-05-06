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
  sources?: RagSource[];
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
