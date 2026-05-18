import { create } from 'zustand';

import { api } from '../services/api';
import type { RuntimeDiagnostics } from '../types/api';
import { useNotificationStore } from './notificationStore';

type Theme = 'dark' | 'light';

type SettingsState = {
  theme: Theme;
  settingsOpen: boolean;
  devToolsEnabled: boolean;
  telemetryEnabled: boolean;
  diagnostics: RuntimeDiagnostics | null;
  loadingDiagnostics: boolean;
  setTheme: (theme: Theme) => void;
  setSettingsOpen: (open: boolean) => void;
  setDevToolsEnabled: (enabled: boolean) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  refreshDiagnostics: () => Promise<void>;
  clearCache: () => Promise<void>;
};

const storedTheme = (localStorage.getItem('lllmao-theme') as Theme | null) ?? 'dark';
const storedDevTools = localStorage.getItem('lllmao-dev-tools') === 'true';
const storedTelemetry = localStorage.getItem('lllmao-telemetry') !== 'false';

document.documentElement.dataset.theme = storedTheme;

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: storedTheme,
  settingsOpen: false,
  devToolsEnabled: storedDevTools,
  telemetryEnabled: storedTelemetry,
  diagnostics: null,
  loadingDiagnostics: false,

  setTheme: (theme) => {
    localStorage.setItem('lllmao-theme', theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setDevToolsEnabled: (devToolsEnabled) => {
    localStorage.setItem('lllmao-dev-tools', String(devToolsEnabled));
    set({ devToolsEnabled });
  },
  setTelemetryEnabled: (telemetryEnabled) => {
    localStorage.setItem('lllmao-telemetry', String(telemetryEnabled));
    set({ telemetryEnabled });
  },
  refreshDiagnostics: async () => {
    set({ loadingDiagnostics: true });
    try {
      set({ diagnostics: await api.runtimeDiagnostics(), loadingDiagnostics: false });
    } catch (error) {
      set({ loadingDiagnostics: false });
      useNotificationStore.getState().notify({
        kind: 'error',
        title: 'Diagnostics unavailable',
        message: error instanceof Error ? error.message : 'Runtime diagnostics failed.',
      });
    }
  },
  clearCache: async () => {
    const result = await api.clearCache();
    useNotificationStore.getState().notify({
      kind: 'success',
      title: 'Cache cleared',
      message: result.cleared.length ? `Cleared ${result.cleared.length} runtime cache locations.` : 'Cache was already empty.',
    });
  },
}));
