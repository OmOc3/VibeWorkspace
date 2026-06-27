import { create } from 'zustand';
import type { VibeWorkspaceApi } from '../../shared/electron-api';
import type { AgentSubtabPreset, WorkspaceState } from '../../shared/models';

interface WorkspaceStore {
  state: WorkspaceState | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  subscribeToWorkspaceEvents: () => () => void;
  chooseProject: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  createTab: () => Promise<void>;
  closeTab: (tabId: string) => Promise<void>;
  renameTab: (tabId: string, title: string) => Promise<void>;
  setActiveTab: (tabId: string) => Promise<void>;
  createSubtab: (tabId: string, preset?: AgentSubtabPreset) => Promise<void>;
  closeSubtab: (tabId: string, subtabId: string) => Promise<void>;
  renameSubtab: (tabId: string, subtabId: string, title: string) => Promise<void>;
  setActiveSubtab: (tabId: string, subtabId: string) => Promise<void>;
  startAuthLogin: (tabId: string) => Promise<void>;
  logoutAuth: (tabId: string) => Promise<void>;
  refreshAuthStatus: (tabId: string) => Promise<void>;
  refreshProfileUsage: (tabId: string) => Promise<void>;
  importDefaultProfile: (tabId: string) => Promise<void>;
  generateCliWrapper: (tabId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  state: null,
  loading: true,
  error: null,

  load: async () => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().getWorkspaceState());
  },

  subscribeToWorkspaceEvents: () => {
    if (!window.vibeWorkspace) {
      return () => undefined;
    }

    return getWorkspaceApi().onWorkspaceStateChanged((state) => {
      set({ state, loading: false, error: null });
    });
  },

  chooseProject: async () => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().chooseProjectFolder());
  },

  selectProject: async (projectId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().selectProject({ projectId }));
  },

  createTab: async () => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().createTab());
  },

  closeTab: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().closeTab({ tabId }));
  },

  renameTab: async (tabId: string, title: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().renameTab({ tabId, title }));
  },

  setActiveTab: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().setActiveTab({ tabId }));
  },

  createSubtab: async (tabId: string, preset?: AgentSubtabPreset) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().createSubtab({ tabId, preset }));
  },

  closeSubtab: async (tabId: string, subtabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().closeSubtab({ tabId, subtabId }));
  },

  renameSubtab: async (tabId: string, subtabId: string, title: string) => {
    await runWorkspaceAction(set, async () =>
      getWorkspaceApi().renameSubtab({ tabId, subtabId, title }),
    );
  },

  setActiveSubtab: async (tabId: string, subtabId: string) => {
    await runWorkspaceAction(set, async () =>
      getWorkspaceApi().setActiveSubtab({ tabId, subtabId }),
      false,
    );
  },

  startAuthLogin: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().startAuthLogin({ tabId }));
  },

  logoutAuth: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().logoutAuth({ tabId }));
  },

  refreshAuthStatus: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().refreshAuthStatus({ tabId }));
  },

  refreshProfileUsage: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().refreshProfileUsage({ tabId }), false);
  },

  importDefaultProfile: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().importDefaultProfile({ tabId }));
  },

  generateCliWrapper: async (tabId: string) => {
    await runWorkspaceAction(set, async () => getWorkspaceApi().generateCliWrapper({ tabId }));
  },
}));

function getWorkspaceApi(): VibeWorkspaceApi {
  if (!window.vibeWorkspace) {
    throw new Error('Workspace bridge is unavailable. Restart the app after rebuilding.');
  }

  return window.vibeWorkspace;
}

async function runWorkspaceAction(
  set: (partial: Partial<WorkspaceStore>) => void,
  action: () => Promise<WorkspaceState>,
  showLoading = true,
): Promise<void> {
  set(showLoading ? { loading: true, error: null } : { error: null });

  try {
    const state = await action();
    set({ state, loading: false, error: null });
  } catch (error) {
    set({
      loading: false,
      error: error instanceof Error ? error.message : 'Workspace action failed.',
    });
  }
}
