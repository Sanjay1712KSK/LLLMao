export type OllamaHealth = {
  ok: boolean;
  message: string;
  backend?: string;
  ollama?: boolean;
  chromadb?: boolean;
  pillow?: boolean;
  database?: boolean;
  backend_ok: boolean;
  ollama_ok: boolean;
  database_ok: boolean;
  dependencies?: Record<string, { ok: boolean; message: string }>;
};

export type OllamaModel = {
  name: string;
  modified_at?: string | null;
  size?: number | null;
  family?: string | null;
  parameter_size?: string | null;
  quantization_level?: string | null;
  capabilities?: string[];
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
  score?: number | null;
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

export type ImageAsset = {
  id: string;
  chat_id?: number | null;
  filename: string;
  mime_type: string;
  width: number;
  height: number;
  size_bytes: number;
  created_at: string;
};

export type RetrievalDebug = {
  id: string;
  chat_id?: number | null;
  mode: string;
  strategy?: string | null;
  query: string;
  sources: Record<string, unknown>[];
  context_summary: string;
  token_budget: number;
  chunks_allocated?: number | null;
  chunks_retrieved?: number | null;
  created_at: string;
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

export type MemoryStatus = {
  enabled: boolean;
  chromadb: boolean;
  entries: number;
  summaries: number;
  collections: string[];
};

export type MemoryEntry = {
  id: string;
  collection: string;
  scope: string;
  chat_id?: number | null;
  workspace_id?: string | null;
  title: string;
  summary: string;
  importance: number;
  score?: number | null;
  created_at: string;
};

export type ConversationSummary = {
  id?: string | null;
  chat_id: number;
  summary: string;
  message_count: number;
  token_estimate: number;
};

export type ContextDebug = {
  id: string;
  chat_id?: number | null;
  mode: string;
  query: string;
  token_budget: number;
  token_estimate: number;
  composition: {
    memory_count?: number;
    document_count?: number;
    workspace_count?: number;
    selected_count?: number;
    candidate_count?: number;
    history_count?: number;
    sources?: Array<{ source_type?: string; source_id?: string; title?: string; score?: number; token_estimate?: number }>;
  };
  created_at: string;
};

export type TerminalResult = {
  id: string;
  cwd: string;
  command: string;
  exit_code?: number | null;
  output: string;
  created_at: string;
};

export type GitStatus = {
  branch: string;
  changed_files: Array<{ status: string; path: string }>;
};

export type PatchProposal = {
  id: string;
  title: string;
  description: string;
  patch_text: string;
  approved: boolean;
  applied: boolean;
  created_at: string;
  applied_at?: string | null;
};

export type DiagnosticsReport = {
  status: string;
  issues: Array<{ severity: string; title: string; detail?: string | null }>;
};

export type OrchestrationStatus = {
  policy: string;
  coexistence_level: string;
  vram_pressure: number;
  ram_pressure: number;
  thermal_throttling: boolean;
  status: string;
  degraded_mode: boolean;
  suspend_indexing: boolean;
  concurrency: number;
};
