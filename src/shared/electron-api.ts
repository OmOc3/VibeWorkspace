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
} from './models';

export interface VibeWorkspaceApi {
  chooseProjectFolder: () => Promise<WorkspaceState>;
  getWorkspaceState: () => Promise<WorkspaceState>;
  selectProject: (input: SelectProjectInput) => Promise<WorkspaceState>;
  createTab: (input?: CreateTabInput) => Promise<WorkspaceState>;
  closeTab: (input: CloseTabInput) => Promise<WorkspaceState>;
  renameTab: (input: RenameTabInput) => Promise<WorkspaceState>;
  setActiveTab: (input: SetActiveTabInput) => Promise<WorkspaceState>;
  createSubtab: (input: CreateSubtabInput) => Promise<WorkspaceState>;
  closeSubtab: (input: CloseSubtabInput) => Promise<WorkspaceState>;
  renameSubtab: (input: RenameSubtabInput) => Promise<WorkspaceState>;
  setActiveSubtab: (input: SetActiveSubtabInput) => Promise<WorkspaceState>;
  startTerminal: (input: TerminalStartInput) => Promise<void>;
  writeTerminal: (input: TerminalInput) => void;
  resizeTerminal: (input: TerminalResizeInput) => void;
  killTerminal: (input: TerminalControlInput) => void;
  clearTerminal: (input: TerminalControlInput) => void;
  setWindowTitle: (title: string) => void;
  startAuthLogin: (input: AuthTabInput) => Promise<WorkspaceState>;
  logoutAuth: (input: AuthTabInput) => Promise<WorkspaceState>;
  refreshAuthStatus: (input: AuthTabInput) => Promise<WorkspaceState>;
  setAuthViewBounds: (input: AuthViewBoundsInput) => Promise<void>;
  hideAuthView: (input: AuthTabInput) => Promise<void>;
  refreshProfileUsage: (input: ProfileTabInput) => Promise<WorkspaceState>;
  importDefaultProfile: (input: ProfileTabInput) => Promise<WorkspaceState>;
  generateCliWrapper: (input: ProfileTabInput) => Promise<WorkspaceState>;
  onTerminalData: (callback: (event: TerminalDataEvent) => void) => () => void;
  onTerminalExit: (callback: (event: TerminalExitEvent) => void) => () => void;
  onWorkspaceStateChanged: (callback: (state: WorkspaceState) => void) => () => void;
  onMenuEvent: (channel: string, callback: () => void) => () => void;
}

declare global {
  interface Window {
    vibeWorkspace: VibeWorkspaceApi;
  }
}
