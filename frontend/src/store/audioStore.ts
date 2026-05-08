import { create } from 'zustand';
import { api } from '../services/api';

export type AudioState = 
  | 'IDLE' 
  | 'RECORDING' 
  | 'PROCESSING_STT' 
  | 'WAITING_FOR_LLM' 
  | 'STREAMING_TEXT' 
  | 'GENERATING_TTS' 
  | 'PLAYING_AUDIO' 
  | 'INTERRUPTED' 
  | 'FAILED';

export type PiperVoice = {
  model_id: string;
  name?: string;
  size_bytes: number;
  is_installed: boolean;
  onnx_url?: string;
  json_url?: string;
};

interface AudioStoreState {
  state: AudioState;
  voices: PiperVoice[];
  activeModelId: string | null;
  downloadProgress: Record<string, number>; // model_id -> percent
  
  // Settings
  silenceDetectionEnabled: boolean;
  silenceSensitivity: number; // 0-100
  silenceTimeoutMs: number;
  
  // Telemetry
  latencies: {
    stt?: number;
    llm?: number;
    tts?: number;
  };
  
  // Actions
  setState: (state: AudioState) => void;
  fetchVoices: () => Promise<void>;
  downloadVoice: (model_id: string, onnx_url: string, json_url: string) => Promise<void>;
  setActiveModel: (model_id: string) => void;
  setLatencies: (latencies: Partial<AudioStoreState['latencies']>) => void;
  updateSettings: (settings: Partial<{
    silenceDetectionEnabled: boolean;
    silenceSensitivity: number;
    silenceTimeoutMs: number;
  }>) => void;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  state: 'IDLE',
  voices: [],
  activeModelId: null,
  downloadProgress: {},
  
  silenceDetectionEnabled: true,
  silenceSensitivity: 50,
  silenceTimeoutMs: 1500,
  
  latencies: {},
  
  setState: (state) => set({ state }),
  
  fetchVoices: async () => {
    try {
      const response = await fetch('/api/audio/models/piper/available');
      if (response.ok) {
        const data = await response.json();
        set({ voices: data.available });
        
        // Auto-select first installed
        const installed = data.available.filter((v: PiperVoice) => v.is_installed);
        if (installed.length > 0 && !get().activeModelId) {
          set({ activeModelId: installed[0].model_id });
        }
      }
    } catch (error) {
      console.error("Failed to fetch voices:", error);
    }
  },
  
  downloadVoice: async (model_id, onnx_url, json_url) => {
    try {
      set((state) => ({
        downloadProgress: { ...state.downloadProgress, [model_id]: 0 }
      }));
      
      const response = await fetch('/api/audio/models/piper/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id, onnx_url, json_url })
      });
      
      if (response.ok) {
        // Polling for download completion could be added here, 
        // for now just mock progress
        let progress = 0;
        const interval = setInterval(async () => {
          progress += 10;
          if (progress >= 100) {
            clearInterval(interval);
            await get().fetchVoices(); // Refresh to see it installed
            set((state) => {
              const newProgress = { ...state.downloadProgress };
              delete newProgress[model_id];
              return { downloadProgress: newProgress };
            });
          } else {
            set((state) => ({
              downloadProgress: { ...state.downloadProgress, [model_id]: progress }
            }));
          }
        }, 500);
      }
    } catch (error) {
      console.error("Download failed:", error);
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[model_id];
        return { downloadProgress: newProgress };
      });
    }
  },
  
  setActiveModel: (model_id) => set({ activeModelId: model_id }),
  
  setLatencies: (latencies) => set((state) => ({ 
    latencies: { ...state.latencies, ...latencies } 
  })),
  
  updateSettings: (settings) => set(settings),
}));
