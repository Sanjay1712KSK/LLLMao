import { create } from 'zustand';

import { api } from '../services/api';
import type { OllamaHealth, SystemStats, OrchestrationStatus } from '../types/api';
import { useChatStore } from './chatStore';
import { useSettingsStore } from './settingsStore';

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
      const orchestration = await api.orchestrationStatus();
      set({ orchestration, error: null });
    } catch (error) {
      // Suppress missing orchestration backend for now
    }
  },

  setPolicy: async (policy: string) => {
    try {
      const orchestration = await api.setOrchestrationPolicy(policy);
      set({ orchestration });
    } catch (error) {
      console.error(error);
    }
  },

  setCoexistence: async (level: string) => {
    try {
      const orchestration = await api.setOrchestrationCoexistence(level);
      set({ orchestration });
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
    }, useSettingsStore.getState().telemetryEnabled ? 2000 : 10000);
    const healthTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void get().fetchHealth();
    }, 7000);
    const orchestrationTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && useSettingsStore.getState().telemetryEnabled) void get().fetchOrchestration();
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
