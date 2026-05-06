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
