import { create } from 'zustand';

import { api } from '../services/api';
import type { OllamaHealth, SystemStats } from '../types/api';
import { useChatStore } from './chatStore';

type SystemState = {
  stats: SystemStats | null;
  health: OllamaHealth | null;
  statsTimer: number | null;
  healthTimer: number | null;
  error: string | null;
  fetchStats: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
};

export const useSystemStore = create<SystemState>((set, get) => ({
  stats: null,
  health: null,
  statsTimer: null,
  healthTimer: null,
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

  startPolling: () => {
    if (get().statsTimer || get().healthTimer) return;
    void get().fetchStats();
    void get().fetchHealth();
    const statsTimer = window.setInterval(() => void get().fetchStats(), 1000);
    const healthTimer = window.setInterval(() => void get().fetchHealth(), 5000);
    set({ statsTimer, healthTimer });
  },

  stopPolling: () => {
    const { statsTimer, healthTimer } = get();
    if (statsTimer) window.clearInterval(statsTimer);
    if (healthTimer) window.clearInterval(healthTimer);
    set({ statsTimer: null, healthTimer: null });
  },
}));
