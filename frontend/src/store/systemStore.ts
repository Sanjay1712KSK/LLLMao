import { create } from 'zustand';

import { api } from '../services/api';
import type { OllamaHealth, SystemStats } from '../types/api';
import { useChatStore } from './chatStore';

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

type SystemState = {
  stats: SystemStats | null;
  health: OllamaHealth | null;
  orchestration: OrchestrationStatus | null;
  statsTimer: number | null;
  healthTimer: number | null;
  orchestrationTimer: number | null;
  error: string | null;
  fetchStats: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchOrchestration: () => Promise<void>;
  setPolicy: (policy: string) => Promise<void>;
  setCoexistence: (level: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
};

export const useSystemStore = create<SystemState>((set, get) => ({
  stats: null,
  health: null,
  orchestration: null,
  statsTimer: null,
  healthTimer: null,
  orchestrationTimer: null,
  error: null,

  fetchStats: async () => {
    try {
      const stats = await api.stats();
      set({ stats, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Stats unavailable' });
    }
  },

  fetchHealth: async () => {
    try {
      const health = await api.health();
      useChatStore.setState({ health });
      set({ health, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Health check failed' });
    }
  },

  fetchOrchestration: async () => {
    try {
      // Direct fetch call since we didn't add it to api.ts yet
      const response = await fetch('http://localhost:11434/api/orchestration/status');
      if (response.ok) {
        const orchestration = await response.json();
        set({ orchestration, error: null });
      }
    } catch (error) {
      // Suppress missing orchestration backend for now
    }
  },

  setPolicy: async (policy: string) => {
    try {
      const response = await fetch('http://localhost:11434/api/orchestration/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy }),
      });
      if (response.ok) {
        const orchestration = await response.json();
        set({ orchestration });
      }
    } catch (error) {
      console.error(error);
    }
  },

  setCoexistence: async (level: string) => {
    try {
      const response = await fetch('http://localhost:11434/api/orchestration/coexistence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      if (response.ok) {
        const orchestration = await response.json();
        set({ orchestration });
      }
    } catch (error) {
      console.error(error);
    }
  },

  startPolling: () => {
    if (get().statsTimer || get().healthTimer) return;
    void get().fetchStats();
    void get().fetchHealth();
    void get().fetchOrchestration();
    const statsTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void get().fetchStats();
    }, 2000);
    const healthTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void get().fetchHealth();
    }, 7000);
    const orchestrationTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void get().fetchOrchestration();
    }, 2000);
    set({ statsTimer, healthTimer, orchestrationTimer });
  },

  stopPolling: () => {
    const { statsTimer, healthTimer, orchestrationTimer } = get();
    if (statsTimer) window.clearInterval(statsTimer);
    if (healthTimer) window.clearInterval(healthTimer);
    if (orchestrationTimer) window.clearInterval(orchestrationTimer);
    set({ statsTimer: null, healthTimer: null, orchestrationTimer: null });
  },
}));
