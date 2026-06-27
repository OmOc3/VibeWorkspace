import path from 'node:path';
import { randomUUID } from 'node:crypto';
import BetterSqlite3 from 'better-sqlite3';
import { and, asc, desc, eq } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema';
import {
  agentSubtabs,
  agentTabs,
  projects,
  sessionActivities,
  sessionProfiles,
  workspaces,
  type AgentSubtabRow,
  type AgentTabRow,
  type ProjectRow,
  type SessionActivityRow,
  type SessionProfileRow,
  type WorkspaceRow,
} from '../../db/schema';
import type {
  AgentSubtab,
  AgentSubtabPreset,
  AgentAppKind,
  AgentTab,
  AuthStatus,
  CreateSubtabInput,
  CreateTabInput,
  Project,
  ProjectSummary,
  SessionActivity,
  SessionActivityKind,
  SessionProfile,
  UsageSnapshot,
  Workspace,
  WorkspaceState,
} from '../../shared/models';
import { workspaceStateSchema } from '../../shared/schemas';
import { createEmptyUsageSnapshot } from '../../shared/usage';
import type { Logger } from './Logger';
import { TabSessionManager } from './TabSessionManager';

const DEFAULT_WORKSPACE_ID = 'local-workspace';
const DEFAULT_WORKSPACE_NAME = 'Local Workspace';
const DEFAULT_AUTH_STATUS: AuthStatus = 'not connected';
const DEFAULT_APP_KIND: AgentAppKind = 'codex';
const DEFAULT_SUBTAB_TITLE = 'Codex CLI';
const DEFAULT_SUBTAB_PRESET: AgentSubtabPreset = 'codex';

export interface TerminalLaunchContext {
  project: Project;
  tab: AgentTab;
  subtab: AgentSubtab;
  sessionProfile: SessionProfile;
}

export interface TabSessionContext {
  project: Project;
  tab: AgentTab;
  sessionProfile: SessionProfile;
}

export class WorkspaceService {
  private readonly sqlite: BetterSqlite3.Database;
  private readonly db: BetterSQLite3Database<typeof schema>;

  constructor(
    databasePath: string,
    private readonly sessionManager: TabSessionManager,
    private readonly logger: Logger,
  ) {
    this.sqlite = new BetterSqlite3(databasePath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });
  }

  initialize(): WorkspaceState {
    migrate(this.db, {
      migrationsFolder: path.join(__dirname, '..', '..', 'db', 'migrations'),
    });
    this.ensureDefaultWorkspace();
    this.ensureDefaultSubtabs();
    this.logger.info('Workspace service initialized.');
    return this.getWorkspaceState();
  }

  getWorkspaceState(): WorkspaceState {
    const workspace = this.getDefaultWorkspace();
    const selectedProject = workspace.activeProjectId
      ? this.getProjectById(workspace.activeProjectId)
      : null;
    const tabs = selectedProject ? this.getTabsForProject(workspace, selectedProject) : [];
    const activeTabId = tabs.find((tab) => tab.active)?.id ?? null;

    const state: WorkspaceState = {
      workspace,
      projects: this.getProjectSummaries(workspace),
      selectedProject,
      tabs,
      activeTabId,
    };

    return workspaceStateSchema.parse(state);
  }

  selectProjectFolder(folderPath: string): WorkspaceState {
    const now = Date.now();
    const workspace = this.getDefaultWorkspace();
    const existingProject = this.db
      .select()
      .from(projects)
      .where(eq(projects.path, folderPath))
      .get();

    const projectId = existingProject?.id ?? randomUUID();
    const projectName = path.basename(folderPath) || folderPath;

    this.db.transaction((tx) => {
      if (existingProject) {
        tx.update(projects)
          .set({
            name: projectName,
            updatedAt: now,
            lastOpenedAt: now,
          })
          .where(eq(projects.id, existingProject.id))
          .run();
      } else {
        tx.insert(projects)
          .values({
            id: projectId,
            workspaceId: workspace.id,
            name: projectName,
            path: folderPath,
            createdAt: now,
            updatedAt: now,
            lastOpenedAt: now,
          })
          .run();
      }

      tx.update(workspaces)
        .set({
          activeProjectId: projectId,
          updatedAt: now,
        })
        .where(eq(workspaces.id, workspace.id))
        .run();
    });

    this.logger.info('Selected project folder.', { projectId, folderPath });
    return this.getWorkspaceState();
  }

  selectProject(projectId: string): WorkspaceState {
    const workspace = this.getDefaultWorkspace();
    const project = this.getProjectById(projectId);

    if (!project || project.workspaceId !== workspace.id) {
      throw new Error('Project is not available in this workspace.');
    }

    const now = Date.now();

    this.db.transaction((tx) => {
      tx.update(projects)
        .set({
          lastOpenedAt: now,
          updatedAt: now,
        })
        .where(eq(projects.id, projectId))
        .run();

      tx.update(workspaces)
        .set({
          activeProjectId: projectId,
          updatedAt: now,
        })
        .where(eq(workspaces.id, workspace.id))
        .run();
    });

    this.logger.info('Selected saved project.', { projectId });
    return this.getWorkspaceState();
  }

  createTab(input?: CreateTabInput): WorkspaceState {
    const state = this.getWorkspaceState();

    if (!state.selectedProject) {
      throw new Error('Select a project before creating a tab.');
    }

    const now = Date.now();
    const tabId = randomUUID();
    const sessionProfileId = randomUUID();
    const subtabId = randomUUID();
    const nextSortOrder = state.tabs.reduce((max, tab) => Math.max(max, tab.sortOrder), -1) + 1;
    const title = input?.title?.trim() || `Agent ${state.tabs.length + 1}`;
    const partitionId = this.sessionManager.buildPartitionId(
      state.workspace.id,
      state.selectedProject.id,
      tabId,
    );

    this.db.transaction((tx) => {
      tx.update(agentTabs)
        .set({
          active: false,
          updatedAt: now,
        })
        .where(eq(agentTabs.projectId, state.selectedProject!.id))
        .run();

      tx.insert(agentTabs)
        .values({
          id: tabId,
          projectId: state.selectedProject!.id,
          title,
          active: true,
          sortOrder: nextSortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      tx.insert(sessionProfiles)
        .values({
          id: sessionProfileId,
          agentTabId: tabId,
          appKind: DEFAULT_APP_KIND,
          partitionId,
          authStatus: DEFAULT_AUTH_STATUS,
          usageSnapshot: JSON.stringify(createEmptyUsageSnapshot()),
          cliWrapperPath: null,
          lastImportedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      tx.insert(agentSubtabs)
        .values({
          id: subtabId,
          agentTabId: tabId,
          title: DEFAULT_SUBTAB_TITLE,
          kind: 'terminal',
          preset: DEFAULT_SUBTAB_PRESET,
          active: true,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    this.insertActivity(tabId, 'created', 'Session created', { title });
    this.logger.info('Created agent tab.', { tabId, partitionId });
    return this.getWorkspaceState();
  }

  closeTab(tabId: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tabToClose = state.tabs.find((tab) => tab.id === tabId);

    if (!state.selectedProject || !tabToClose) {
      throw new Error('Tab does not belong to the active project.');
    }

    const now = Date.now();
    const remainingTabs = state.tabs.filter((tab) => tab.id !== tabId);
    const nextActiveTab = tabToClose.active ? remainingTabs[0] : remainingTabs.find((tab) => tab.active);

    this.db.transaction((tx) => {
      tx.delete(agentTabs).where(eq(agentTabs.id, tabId)).run();

      if (nextActiveTab) {
        tx.update(agentTabs)
          .set({
            active: true,
            updatedAt: now,
          })
          .where(eq(agentTabs.id, nextActiveTab.id))
          .run();
      }
    });

    this.sessionManager.unregisterSession(tabId);
    this.logger.info('Closed agent tab.', { tabId });
    return this.getWorkspaceState();
  }

  renameTab(tabId: string, title: string): WorkspaceState {
    const trimmedTitle = title.trim();
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.db
      .update(agentTabs)
      .set({
        title: trimmedTitle,
        updatedAt: Date.now(),
      })
      .where(eq(agentTabs.id, tabId))
      .run();

    this.insertActivity(tabId, 'session', 'Session renamed', { from: tab.title, to: trimmedTitle });
    this.logger.info('Renamed agent tab.', { tabId, title: trimmedTitle });
    return this.getWorkspaceState();
  }

  setActiveTab(tabId: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!state.selectedProject || !tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    const now = Date.now();

    this.db.transaction((tx) => {
      tx.update(agentTabs)
        .set({
          active: false,
          updatedAt: now,
        })
        .where(eq(agentTabs.projectId, state.selectedProject!.id))
        .run();

      tx.update(agentTabs)
        .set({
          active: true,
          updatedAt: now,
        })
        .where(eq(agentTabs.id, tabId))
        .run();
    });

    this.insertActivity(tabId, 'session', 'Session activated');
    this.logger.info('Activated agent tab.', { tabId });
    return this.getWorkspaceState();
  }

  createSubtab(input: CreateSubtabInput): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === input.tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    const now = Date.now();
    const subtabId = randomUUID();
    const preset = input.preset ?? DEFAULT_SUBTAB_PRESET;
    const title = input.title?.trim() || getDefaultSubtabTitle(preset, tab.subtabs.length + 1);
    const nextSortOrder =
      tab.subtabs.reduce((max, subtab) => Math.max(max, subtab.sortOrder), -1) + 1;

    this.db.transaction((tx) => {
      tx.update(agentSubtabs)
        .set({
          active: false,
          updatedAt: now,
        })
        .where(eq(agentSubtabs.agentTabId, tab.id))
        .run();

      tx.insert(agentSubtabs)
        .values({
          id: subtabId,
          agentTabId: tab.id,
          title,
          kind: 'terminal',
          preset,
          active: true,
          sortOrder: nextSortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    this.logger.info('Created agent subtab.', { tabId: tab.id, subtabId, preset });
    return this.getWorkspaceState();
  }

  closeSubtab(tabId: string, subtabId: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);
    const subtabToClose = tab?.subtabs.find((candidate) => candidate.id === subtabId);

    if (!tab || !subtabToClose) {
      throw new Error('Subtab does not belong to the requested tab.');
    }

    const now = Date.now();
    const remainingSubtabs = tab.subtabs.filter((subtab) => subtab.id !== subtabId);
    const nextActiveSubtab = subtabToClose.active
      ? remainingSubtabs[0]
      : remainingSubtabs.find((subtab) => subtab.active);

    this.db.transaction((tx) => {
      tx.delete(agentSubtabs).where(eq(agentSubtabs.id, subtabId)).run();

      if (nextActiveSubtab) {
        tx.update(agentSubtabs)
          .set({
            active: true,
            updatedAt: now,
          })
          .where(eq(agentSubtabs.id, nextActiveSubtab.id))
          .run();
      }
    });

    this.logger.info('Closed agent subtab.', { tabId, subtabId });
    return this.getWorkspaceState();
  }

  renameSubtab(tabId: string, subtabId: string, title: string): WorkspaceState {
    const trimmedTitle = title.trim();
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);
    const subtab = tab?.subtabs.find((candidate) => candidate.id === subtabId);

    if (!subtab) {
      throw new Error('Subtab does not belong to the requested tab.');
    }

    this.db
      .update(agentSubtabs)
      .set({
        title: trimmedTitle,
        updatedAt: Date.now(),
      })
      .where(eq(agentSubtabs.id, subtabId))
      .run();

    this.logger.info('Renamed agent subtab.', { tabId, subtabId, title: trimmedTitle });
    return this.getWorkspaceState();
  }

  setActiveSubtab(tabId: string, subtabId: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);
    const subtab = tab?.subtabs.find((candidate) => candidate.id === subtabId);

    if (!tab || !subtab) {
      throw new Error('Subtab does not belong to the requested tab.');
    }

    const now = Date.now();

    this.db.transaction((tx) => {
      tx.update(agentSubtabs)
        .set({
          active: false,
          updatedAt: now,
        })
        .where(eq(agentSubtabs.agentTabId, tab.id))
        .run();

      tx.update(agentSubtabs)
        .set({
          active: true,
          updatedAt: now,
        })
        .where(eq(agentSubtabs.id, subtabId))
        .run();
    });

    this.logger.info('Activated agent subtab.', { tabId, subtabId });
    return this.getWorkspaceState();
  }

  updateAuthStatus(tabId: string, authStatus: AuthStatus): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.db
      .update(sessionProfiles)
      .set({
        authStatus,
        updatedAt: Date.now(),
      })
      .where(eq(sessionProfiles.agentTabId, tabId))
      .run();

    this.insertActivity(tabId, 'auth', `Auth ${authStatus}`);
    this.logger.info('Updated tab auth status.', { tabId, authStatus });
    return this.getWorkspaceState();
  }

  updateSessionUsage(tabId: string, usageSnapshot: UsageSnapshot): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.db
      .update(sessionProfiles)
      .set({
        usageSnapshot: JSON.stringify(usageSnapshot),
        updatedAt: Date.now(),
      })
      .where(eq(sessionProfiles.agentTabId, tabId))
      .run();

    this.logger.info('Updated session usage snapshot.', {
      tabId,
      status: usageSnapshot.status,
    });
    return this.getWorkspaceState();
  }

  clearSessionUsage(tabId: string): WorkspaceState {
    return this.updateSessionUsage(tabId, createEmptyUsageSnapshot());
  }

  recordProfileImport(tabId: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.db
      .update(sessionProfiles)
      .set({
        lastImportedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(sessionProfiles.agentTabId, tabId))
      .run();

    this.insertActivity(tabId, 'import', 'Default profile imported');
    this.logger.info('Recorded profile import.', { tabId });
    return this.getWorkspaceState();
  }

  setCliWrapperPath(tabId: string, cliWrapperPath: string): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.db
      .update(sessionProfiles)
      .set({
        cliWrapperPath,
        updatedAt: Date.now(),
      })
      .where(eq(sessionProfiles.agentTabId, tabId))
      .run();

    this.insertActivity(tabId, 'wrapper', 'CLI wrapper generated', { path: cliWrapperPath });
    this.logger.info('Stored CLI wrapper path.', { tabId, cliWrapperPath });
    return this.getWorkspaceState();
  }

  recordActivity(
    tabId: string,
    kind: SessionActivityKind,
    label: string,
    metadata?: Record<string, unknown>,
  ): WorkspaceState {
    const state = this.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    this.insertActivity(tabId, kind, label, metadata);
    return this.getWorkspaceState();
  }

  getTerminalLaunchContext(tabId: string, subtabId: string): TerminalLaunchContext {
    const { project, tab, sessionProfile } = this.getTabSessionContext(tabId);
    const subtab = tab?.subtabs.find((candidate) => candidate.id === subtabId);

    if (!subtab) {
      throw new Error('Terminal subtab does not belong to the active project.');
    }

    return {
      project,
      tab,
      subtab,
      sessionProfile,
    };
  }

  getTabSessionContext(tabId: string): TabSessionContext {
    const state = this.getWorkspaceState();
    const project = state.selectedProject;
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!project || !tab) {
      throw new Error('Tab does not belong to the active project.');
    }

    return {
      project,
      tab,
      sessionProfile: tab.sessionProfile,
    };
  }

  close(): void {
    this.sqlite.close();
  }

  private ensureDefaultWorkspace(): void {
    const existing = this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, DEFAULT_WORKSPACE_ID))
      .get();

    if (existing) {
      return;
    }

    const now = Date.now();
    this.db
      .insert(workspaces)
      .values({
        id: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME,
        activeProjectId: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  private ensureDefaultSubtabs(): void {
    const tabs = this.db.select().from(agentTabs).all();
    const now = Date.now();

    this.db.transaction((tx) => {
      for (const tab of tabs) {
        const existing = tx
          .select()
          .from(agentSubtabs)
          .where(eq(agentSubtabs.agentTabId, tab.id))
          .get();

        if (existing) {
          continue;
        }

        tx.insert(agentSubtabs)
          .values({
            id: randomUUID(),
            agentTabId: tab.id,
            title: DEFAULT_SUBTAB_TITLE,
            kind: 'terminal',
            preset: DEFAULT_SUBTAB_PRESET,
            active: true,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }
    });
  }

  private getDefaultWorkspace(): Workspace {
    const workspace = this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, DEFAULT_WORKSPACE_ID))
      .get();

    if (!workspace) {
      throw new Error('Default workspace is missing.');
    }

    return this.mapWorkspace(workspace);
  }

  private getProjectById(projectId: string): Project | null {
    const project = this.db.select().from(projects).where(eq(projects.id, projectId)).get();
    return project ? this.mapProject(project) : null;
  }

  private getProjectSummaries(workspace: Workspace): ProjectSummary[] {
    const projectRows = this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspace.id))
      .orderBy(desc(projects.lastOpenedAt), asc(projects.name))
      .all();

    return projectRows.map((projectRow) => {
      const tabRows = this.db
        .select()
        .from(agentTabs)
        .where(eq(agentTabs.projectId, projectRow.id))
        .orderBy(asc(agentTabs.sortOrder))
        .all();
      const terminalCount = tabRows.reduce((count, tabRow) => {
        return (
          count +
          this.db
            .select()
            .from(agentSubtabs)
            .where(eq(agentSubtabs.agentTabId, tabRow.id))
            .all().length
        );
      }, 0);
      const activeTab = tabRows.find((tabRow) => tabRow.active) ?? tabRows[0] ?? null;

      return {
        ...this.mapProject(projectRow),
        tabCount: tabRows.length,
        terminalCount,
        activeTabTitle: activeTab?.title ?? null,
      };
    });
  }

  private getTabsForProject(workspace: Workspace, project: Project): AgentTab[] {
    const rows = this.db
      .select({
        tab: agentTabs,
        sessionProfile: sessionProfiles,
      })
      .from(agentTabs)
      .leftJoin(sessionProfiles, eq(sessionProfiles.agentTabId, agentTabs.id))
      .where(and(eq(agentTabs.projectId, project.id)))
      .orderBy(asc(agentTabs.sortOrder))
      .all();

    const tabs = rows.map((row) => {
      if (!row.sessionProfile) {
        throw new Error(`Tab ${row.tab.id} is missing its session profile.`);
      }

      const tab = this.mapAgentTab(row.tab, row.sessionProfile, this.getSubtabsForTab(row.tab.id));
      this.sessionManager.registerSession(workspace, project, tab);
      return tab;
    });

    if (tabs.length > 0 && !tabs.some((tab) => tab.active)) {
      this.setActiveTab(tabs[0].id);
      return this.getTabsForProject(workspace, project);
    }

    return tabs;
  }

  private mapWorkspace(row: WorkspaceRow): Workspace {
    return {
      id: row.id,
      name: row.name,
      activeProjectId: row.activeProjectId,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private mapProject(row: ProjectRow): Project {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      path: row.path,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      lastOpenedAt: toIso(row.lastOpenedAt),
    };
  }

  private getSubtabsForTab(tabId: string): AgentSubtab[] {
    const rows = this.db
      .select()
      .from(agentSubtabs)
      .where(eq(agentSubtabs.agentTabId, tabId))
      .orderBy(asc(agentSubtabs.sortOrder))
      .all();

    if (rows.length > 0 && !rows.some((row) => row.active)) {
      this.db
        .update(agentSubtabs)
        .set({
          active: true,
          updatedAt: Date.now(),
        })
        .where(eq(agentSubtabs.id, rows[0].id))
        .run();

      return this.getSubtabsForTab(tabId);
    }

    return rows.map((row) => this.mapAgentSubtab(row));
  }

  private mapAgentTab(
    row: AgentTabRow,
    sessionProfileRow: SessionProfileRow,
    subtabs: AgentSubtab[],
  ): AgentTab {
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      active: row.active,
      sortOrder: row.sortOrder,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      sessionProfile: this.mapSessionProfile(sessionProfileRow),
      subtabs,
      activeSubtabId: subtabs.find((subtab) => subtab.active)?.id ?? null,
    };
  }

  private mapAgentSubtab(row: AgentSubtabRow): AgentSubtab {
    return {
      id: row.id,
      agentTabId: row.agentTabId,
      title: row.title,
      kind: 'terminal',
      preset: row.preset as AgentSubtabPreset,
      active: row.active,
      sortOrder: row.sortOrder,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private mapSessionProfile(row: SessionProfileRow): SessionProfile {
    return {
      id: row.id,
      agentTabId: row.agentTabId,
      appKind: (row.appKind as AgentAppKind | null) ?? DEFAULT_APP_KIND,
      partitionId: row.partitionId,
      authStatus: row.authStatus as AuthStatus,
      usageSnapshot: parseUsageSnapshot(row.usageSnapshot),
      cliWrapperPath: row.cliWrapperPath,
      lastImportedAt: row.lastImportedAt ? toIso(row.lastImportedAt) : null,
      recentActivity: this.getRecentActivityForTab(row.agentTabId),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  private getRecentActivityForTab(tabId: string): SessionActivity[] {
    const rows = this.db
      .select()
      .from(sessionActivities)
      .where(eq(sessionActivities.agentTabId, tabId))
      .orderBy(desc(sessionActivities.createdAt))
      .limit(8)
      .all();

    return rows.map((row) => this.mapSessionActivity(row));
  }

  private mapSessionActivity(row: SessionActivityRow): SessionActivity {
    return {
      id: row.id,
      agentTabId: row.agentTabId,
      kind: row.kind as SessionActivityKind,
      label: row.label,
      metadata: row.metadata,
      createdAt: toIso(row.createdAt),
    };
  }

  private insertActivity(
    tabId: string,
    kind: SessionActivityKind,
    label: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.db
      .insert(sessionActivities)
      .values({
        id: randomUUID(),
        agentTabId: tabId,
        kind,
        label,
        metadata: metadata ? JSON.stringify(metadata).slice(0, 1200) : null,
        createdAt: Date.now(),
      })
      .run();
  }
}

function toIso(value: number): string {
  return new Date(value).toISOString();
}

function getDefaultSubtabTitle(preset: AgentSubtabPreset, index: number): string {
  if (preset === 'codex-login') {
    return 'Codex Login';
  }

  if (preset === 'shell') {
    return `Shell ${index}`;
  }

  return index === 1 ? DEFAULT_SUBTAB_TITLE : `Codex CLI ${index}`;
}

function parseUsageSnapshot(value: string | null): UsageSnapshot {
  if (!value) {
    return createEmptyUsageSnapshot();
  }

  try {
    return createEmptyUsageSnapshotSchema(JSON.parse(value));
  } catch {
    return createEmptyUsageSnapshot('error', new Date().toISOString());
  }
}

function createEmptyUsageSnapshotSchema(value: unknown): UsageSnapshot {
  const fallback = createEmptyUsageSnapshot();
  const candidate = value as Partial<UsageSnapshot> | null;

  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }

  return {
    status:
      candidate.status === 'refreshing' ||
      candidate.status === 'available' ||
      candidate.status === 'error' ||
      candidate.status === 'unknown'
        ? candidate.status
        : fallback.status,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
    nextRefreshAt: typeof candidate.nextRefreshAt === 'string' ? candidate.nextRefreshAt : null,
    fiveHour: {
      ...fallback.fiveHour,
      ...(candidate.fiveHour && typeof candidate.fiveHour === 'object' ? candidate.fiveHour : {}),
    },
    weekly: {
      ...fallback.weekly,
      ...(candidate.weekly && typeof candidate.weekly === 'object' ? candidate.weekly : {}),
    },
    monthly: {
      ...fallback.monthly,
      ...(candidate.monthly && typeof candidate.monthly === 'object' ? candidate.monthly : {}),
    },
    rawOutput: typeof candidate.rawOutput === 'string' ? candidate.rawOutput.slice(0, 12000) : '',
    error: typeof candidate.error === 'string' ? candidate.error : null,
  };
}
