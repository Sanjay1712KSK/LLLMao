export type OllamaHealth = {
  ok: boolean;
  message: string;
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
  created_at: string;
};

export type Message = {
  id: number | string;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
};
