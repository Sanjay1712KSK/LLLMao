import { create } from 'zustand';

import { api } from '../services/api';
import type { Workspace, WorkspaceFile } from '../types/api';

type WorkspaceState = {
  workspaces: Workspace[];
  files: WorkspaceFile[];
  activeWorkspaceId: string;
  isLoading: boolean;
  error: string | null;
  setActiveWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  connectWorkspace: (path: string) => Promise<void>;
  reindexWorkspace: (workspaceId: string) => Promise<void>;
  disconnectWorkspace: (workspaceId: string) => Promise<void>;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  files: [],
  activeWorkspaceId: '',
  isLoading: false,
  error: null,

  refreshWorkspaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const workspaces = await api.workspaces();
      const activeWorkspaceId = get().activeWorkspaceId || workspaces[0]?.id || '';
      const files = activeWorkspaceId ? await api.workspaceFiles(activeWorkspaceId) : [];
      set({ workspaces, activeWorkspaceId, files, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Unable to load workspaces' });
    }
  },

  setActiveWorkspace: async (activeWorkspaceId) => {
    const files = activeWorkspaceId ? await api.workspaceFiles(activeWorkspaceId) : [];
    set({ activeWorkspaceId, files });
  },

  connectWorkspace: async (path) => {
    const workspace = await api.connectWorkspace(path);
    set({ activeWorkspaceId: workspace.id });
    await get().refreshWorkspaces();
  },

  reindexWorkspace: async (workspaceId) => {
    await api.reindexWorkspace(workspaceId);
    await get().refreshWorkspaces();
  },

  disconnectWorkspace: async (workspaceId) => {
    await api.disconnectWorkspace(workspaceId);
    set((state) => ({ activeWorkspaceId: state.activeWorkspaceId === workspaceId ? '' : state.activeWorkspaceId }));
    await get().refreshWorkspaces();
  },
}));
