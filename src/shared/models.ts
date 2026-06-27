export type AuthStatus = 'not connected' | 'login pending' | 'connected' | 'error';
export type AgentAppKind = 'codex' | 'claude';
export type AgentSubtabKind = 'terminal';
export type AgentSubtabPreset = 'codex' | 'shell' | 'codex-login';
export type SessionActivityKind =
  | 'auth'
  | 'created'
  | 'import'
  | 'session'
  | 'terminal'
  | 'usage'
  | 'wrapper';
export type UsageSnapshotStatus = 'unknown' | 'refreshing' | 'available' | 'error';

export interface UsageWindowSnapshot {
  label: string;
  percent: number | null;
  resetText: string | null;
  rawLine: string | null;
}

export interface UsageSnapshot {
  status: UsageSnapshotStatus;
  updatedAt: string | null;
  nextRefreshAt: string | null;
  fiveHour: UsageWindowSnapshot;
  weekly: UsageWindowSnapshot;
  monthly: UsageWindowSnapshot;
  rawOutput: string;
  error: string | null;
}
export type TerminalViewMode = 'enhanced' | 'cli';

export interface SessionActivity {
  id: string;
  agentTabId: string;
  kind: SessionActivityKind;
  label: string;
  metadata: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  activeProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface ProjectSummary extends Project {
  tabCount: number;
  terminalCount: number;
  activeTabTitle: string | null;
}

export interface SessionProfile {
  id: string;
  agentTabId: string;
  appKind: AgentAppKind;
  partitionId: string;
  authStatus: AuthStatus;
  usageSnapshot: UsageSnapshot;
  cliWrapperPath: string | null;
  lastImportedAt: string | null;
  recentActivity: SessionActivity[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentSubtab {
  id: string;
  agentTabId: string;
  title: string;
  kind: AgentSubtabKind;
  preset: AgentSubtabPreset;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTab {
  id: string;
  projectId: string;
  title: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  sessionProfile: SessionProfile;
  subtabs: AgentSubtab[];
  activeSubtabId: string | null;
}

export interface WorkspaceState {
  workspace: Workspace;
  projects: ProjectSummary[];
  selectedProject: Project | null;
  tabs: AgentTab[];
  activeTabId: string | null;
}

export interface SelectProjectInput {
  projectId: string;
}

export interface CreateTabInput {
  title?: string;
}

export interface CloseTabInput {
  tabId: string;
}

export interface RenameTabInput {
  tabId: string;
  title: string;
}

export interface SetActiveTabInput {
  tabId: string;
}

export interface CreateSubtabInput {
  tabId: string;
  title?: string;
  preset?: AgentSubtabPreset;
}

export interface CloseSubtabInput {
  tabId: string;
  subtabId: string;
}

export interface RenameSubtabInput {
  tabId: string;
  subtabId: string;
  title: string;
}

export interface SetActiveSubtabInput {
  tabId: string;
  subtabId: string;
}

export interface TerminalStartInput {
  tabId: string;
  subtabId: string;
  cols: number;
  rows: number;
  viewMode?: TerminalViewMode;
}

export interface TerminalInput {
  subtabId: string;
  data: string;
}

export interface TerminalResizeInput {
  subtabId: string;
  cols: number;
  rows: number;
}

export interface TerminalControlInput {
  subtabId: string;
}

export interface TerminalDataEvent {
  subtabId: string;
  data: string;
}

export interface TerminalExitEvent {
  subtabId: string;
  exitCode: number | null;
  signal: number | null;
}

export interface AuthTabInput {
  tabId: string;
}

export interface ProfileTabInput {
  tabId: string;
}

export interface AuthViewBoundsInput {
  tabId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
