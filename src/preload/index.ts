import { contextBridge, ipcRenderer } from 'electron';
import type {
  AuthTabInput,
  AuthViewBoundsInput,
  CloseTabInput,
  CloseSubtabInput,
  CreateSubtabInput,
  CreateTabInput,
  ProfileTabInput,
  RenameTabInput,
  RenameSubtabInput,
  SelectProjectInput,
  SetActiveTabInput,
  SetActiveSubtabInput,
  TerminalControlInput,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalInput,
  TerminalResizeInput,
  TerminalStartInput,
  WorkspaceState,
} from '../shared/models';
import type { VibeWorkspaceApi } from '../shared/electron-api';

const IPC_CHANNELS = {
  chooseProjectFolder: 'workspace:choose-project-folder',
  getWorkspaceState: 'workspace:get-state',
  selectProject: 'workspace:select-project',
  createTab: 'workspace:create-tab',
  closeTab: 'workspace:close-tab',
  renameTab: 'workspace:rename-tab',
  setActiveTab: 'workspace:set-active-tab',
  createSubtab: 'workspace:create-subtab',
  closeSubtab: 'workspace:close-subtab',
  renameSubtab: 'workspace:rename-subtab',
  setActiveSubtab: 'workspace:set-active-subtab',
  terminalStart: 'terminal:start',
  terminalInput: 'terminal:input',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalClear: 'terminal:clear',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  setWindowTitle: 'window:set-title',
  authStartLogin: 'auth:start-login',
  authLogout: 'auth:logout',
  authRefreshStatus: 'auth:refresh-status',
  authSetViewBounds: 'auth:set-view-bounds',
  authHideView: 'auth:hide-view',
  profileRefreshUsage: 'profile:refresh-usage',
  profileImportDefault: 'profile:import-default',
  profileGenerateCliWrapper: 'profile:generate-cli-wrapper',
  workspaceStateChanged: 'workspace:state-changed',
} as const;

const MENU_EVENT_CHANNELS = new Set([
  'menu:new-tab',
  'menu:new-subtab',
  'menu:open-project',
  'menu:command-palette',
]);

async function invokeWorkspaceState(channel: string, payload?: unknown): Promise<WorkspaceState> {
  return (await ipcRenderer.invoke(channel, payload)) as WorkspaceState;
}

const api: VibeWorkspaceApi = {
  chooseProjectFolder: () => invokeWorkspaceState(IPC_CHANNELS.chooseProjectFolder),
  getWorkspaceState: () => invokeWorkspaceState(IPC_CHANNELS.getWorkspaceState),
  selectProject: (input: SelectProjectInput) =>
    invokeWorkspaceState(IPC_CHANNELS.selectProject, input),
  createTab: (input?: CreateTabInput) => invokeWorkspaceState(IPC_CHANNELS.createTab, input),
  closeTab: (input: CloseTabInput) => invokeWorkspaceState(IPC_CHANNELS.closeTab, input),
  renameTab: (input: RenameTabInput) => invokeWorkspaceState(IPC_CHANNELS.renameTab, input),
  setActiveTab: (input: SetActiveTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.setActiveTab, input),
  createSubtab: (input: CreateSubtabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.createSubtab, input),
  closeSubtab: (input: CloseSubtabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.closeSubtab, input),
  renameSubtab: (input: RenameSubtabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.renameSubtab, input),
  setActiveSubtab: (input: SetActiveSubtabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.setActiveSubtab, input),
  startTerminal: (input: TerminalStartInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.terminalStart, input) as Promise<void>,
  writeTerminal: (input: TerminalInput) => {
    ipcRenderer.send(IPC_CHANNELS.terminalInput, input);
  },
  resizeTerminal: (input: TerminalResizeInput) => {
    ipcRenderer.send(IPC_CHANNELS.terminalResize, input);
  },
  killTerminal: (input: TerminalControlInput) => {
    ipcRenderer.send(IPC_CHANNELS.terminalKill, input);
  },
  clearTerminal: (input: TerminalControlInput) => {
    ipcRenderer.send(IPC_CHANNELS.terminalClear, input);
  },
  setWindowTitle: (title: string) => {
    ipcRenderer.send(IPC_CHANNELS.setWindowTitle, title);
  },
  startAuthLogin: (input: AuthTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.authStartLogin, input),
  logoutAuth: (input: AuthTabInput) => invokeWorkspaceState(IPC_CHANNELS.authLogout, input),
  refreshAuthStatus: (input: AuthTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.authRefreshStatus, input),
  setAuthViewBounds: (input: AuthViewBoundsInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.authSetViewBounds, input) as Promise<void>,
  hideAuthView: (input: AuthTabInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.authHideView, input) as Promise<void>,
  refreshProfileUsage: (input: ProfileTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.profileRefreshUsage, input),
  importDefaultProfile: (input: ProfileTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.profileImportDefault, input),
  generateCliWrapper: (input: ProfileTabInput) =>
    invokeWorkspaceState(IPC_CHANNELS.profileGenerateCliWrapper, input),
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(IPC_CHANNELS.terminalData, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.terminalData, listener);
    };
  },
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(IPC_CHANNELS.terminalExit, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.terminalExit, listener);
    };
  },
  onWorkspaceStateChanged: (callback: (state: WorkspaceState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceState): void => {
      callback(payload);
    };

    ipcRenderer.on(IPC_CHANNELS.workspaceStateChanged, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.workspaceStateChanged, listener);
    };
  },
  onMenuEvent: (channel: string, callback: () => void) => {
    if (!MENU_EVENT_CHANNELS.has(channel)) {
      return () => undefined;
    }

    const listener = (): void => {
      callback();
    };

    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld('vibeWorkspace', api);
