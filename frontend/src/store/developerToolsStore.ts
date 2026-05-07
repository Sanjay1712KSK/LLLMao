import { create } from 'zustand';

import { api } from '../services/api';
import type { DiagnosticsReport, GitStatus, TerminalResult } from '../types/api';

type DeveloperToolsState = {
  terminalHistory: TerminalResult[];
  gitStatus: GitStatus | null;
  gitDiff: string;
  diagnostics: DiagnosticsReport | null;
  searchResults: { query: string; keyword: Array<Record<string, unknown>>; semantic: Array<Record<string, unknown>> } | null;
  openFile: { path: string; content: string; dirty: boolean } | null;
  error: string | null;
  runCommand: (command: string, cwd: string, workspaceId?: string | null) => Promise<void>;
  refreshGit: (cwd: string, workspaceId?: string | null) => Promise<void>;
  loadDiff: (cwd: string, path?: string | null, workspaceId?: string | null) => Promise<void>;
  runDiagnostics: (workspaceId?: string | null) => Promise<void>;
  searchWorkspace: (workspaceId: string, query: string) => Promise<void>;
  readFile: (cwd: string, path: string) => Promise<void>;
  setOpenFileContent: (content: string) => void;
  saveOpenFile: (cwd: string) => Promise<void>;
};

export const useDeveloperToolsStore = create<DeveloperToolsState>((set) => ({
  terminalHistory: [],
  gitStatus: null,
  gitDiff: '',
  diagnostics: null,
  searchResults: null,
  openFile: null,
  error: null,

  runCommand: async (command, cwd, workspaceId) => {
    set({ error: null });
    try {
      const result = await api.executeTerminal({ command, cwd, workspace_id: workspaceId });
      set((state) => ({ terminalHistory: [result, ...state.terminalHistory].slice(0, 20) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Command failed' });
    }
  },

  refreshGit: async (cwd, workspaceId) => {
    try {
      set({ gitStatus: await api.gitStatus(cwd, workspaceId), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Git status failed' });
    }
  },

  loadDiff: async (cwd, path, workspaceId) => {
    try {
      const result = await api.gitDiff(cwd, path, workspaceId);
      set({ gitDiff: result.diff, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Git diff failed' });
    }
  },

  runDiagnostics: async (workspaceId) => {
    try {
      set({ diagnostics: await api.workspaceDiagnostics(workspaceId), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Diagnostics failed' });
    }
  },

  searchWorkspace: async (workspaceId, query) => {
    try {
      set({ searchResults: await api.workspaceSearch(workspaceId, query), error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Workspace search failed' });
    }
  },

  readFile: async (cwd, path) => {
    try {
      const file = await api.readFile({ cwd, path });
      set({ openFile: { ...file, dirty: false }, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'File read failed' });
    }
  },

  setOpenFileContent: (content) => set((state) => ({ openFile: state.openFile ? { ...state.openFile, content, dirty: true } : null })),

  saveOpenFile: async (cwd) => {
    const file = useDeveloperToolsStore.getState().openFile;
    if (!file) return;
    try {
      const saved = await api.saveFile({ cwd, path: file.path, content: file.content });
      set({ openFile: { ...saved, dirty: false }, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'File save failed' });
    }
  },
}));
