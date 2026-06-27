import type { VibeWorkspaceApi } from '../../shared/electron-api';
import type {
  AgentSubtab,
  AgentSubtabPreset,
  AgentTab,
  AuthStatus,
  ProjectSummary,
  TerminalDataEvent,
  TerminalExitEvent,
  UsageSnapshot,
  Workspace,
  WorkspaceState,
} from '../../shared/models';

const MOCK_QUERY_FLAG = 'mockWorkspace';

export function installMockWorkspaceApi(): void {
  if (!import.meta.env.DEV || window.vibeWorkspace || !window.location.search.includes(MOCK_QUERY_FLAG)) {
    return;
  }

  window.vibeWorkspace = createMockWorkspaceApi();
}

function createMockWorkspaceApi(): VibeWorkspaceApi {
  const workspace: Workspace = {
    id: 'local-workspace',
    name: 'Local Workspace',
    activeProjectId: '6f4cfb2d-d96f-4a85-a921-9e195691861b',
    createdAt: daysAgo(18),
    updatedAt: daysAgo(0),
  };
  const projects: ProjectSummary[] = [
    {
      id: '6f4cfb2d-d96f-4a85-a921-9e195691861b',
      workspaceId: workspace.id,
      name: 'client-dashboard',
      path: 'C:\\Users\\om894\\Documents\\client-dashboard',
      createdAt: daysAgo(18),
      updatedAt: daysAgo(0),
      lastOpenedAt: daysAgo(0),
      tabCount: 3,
      terminalCount: 5,
      activeTabTitle: 'Billing refactor',
    },
    {
      id: 'a75ceaa7-6b2d-4aa4-92c2-35348d6249b2',
      workspaceId: workspace.id,
      name: 'mobile-app',
      path: 'C:\\Users\\om894\\Documents\\mobile-app',
      createdAt: daysAgo(11),
      updatedAt: daysAgo(2),
      lastOpenedAt: daysAgo(2),
      tabCount: 2,
      terminalCount: 3,
      activeTabTitle: 'Expo login flow',
    },
    {
      id: 'de225e36-df0c-466b-8be6-72f7a1e86e5d',
      workspaceId: workspace.id,
      name: 'automation-lab',
      path: 'C:\\Users\\om894\\Documents\\automation-lab',
      createdAt: daysAgo(30),
      updatedAt: daysAgo(7),
      lastOpenedAt: daysAgo(7),
      tabCount: 1,
      terminalCount: 2,
      activeTabTitle: 'Monitor scheduler',
    },
  ];
  const tabsByProject = new Map<string, AgentTab[]>();
  const terminalDataSubscribers = new Set<(event: TerminalDataEvent) => void>();
  const terminalExitSubscribers = new Set<(event: TerminalExitEvent) => void>();

  tabsByProject.set(projects[0].id, [
    buildTab(projects[0].id, 'Billing refactor', true, 0, [
      buildSubtab('Codex CLI', 'codex', true, 0),
      buildSubtab('Shell 2', 'shell', false, 1),
    ]),
    buildTab(projects[0].id, 'API cleanup', false, 1, [buildSubtab('Codex CLI', 'codex', true, 0)]),
    buildTab(projects[0].id, 'Release notes', false, 2, [
      buildSubtab('Codex CLI', 'codex', true, 0),
      buildSubtab('Shell 2', 'shell', false, 1),
    ]),
  ]);
  tabsByProject.set(projects[1].id, [
    buildTab(projects[1].id, 'Expo login flow', true, 0, [buildSubtab('Codex CLI', 'codex', true, 0)]),
    buildTab(projects[1].id, 'Profile screen', false, 1, [buildSubtab('Shell 1', 'shell', true, 0)]),
  ]);
  tabsByProject.set(projects[2].id, [
    buildTab(projects[2].id, 'Monitor scheduler', true, 0, [
      buildSubtab('Codex CLI', 'codex', true, 0),
      buildSubtab('Shell 2', 'shell', false, 1),
    ]),
  ]);

  const getSelectedProject = (): ProjectSummary | null => {
    return projects.find((project) => project.id === workspace.activeProjectId) ?? null;
  };

  const getState = (): WorkspaceState => {
    const selectedProject = getSelectedProject();
    const tabs = selectedProject ? (tabsByProject.get(selectedProject.id) ?? []) : [];

    refreshProjectSummaries(projects, tabsByProject);

    return structuredClone({
      workspace,
      projects,
      selectedProject,
      tabs,
      activeTabId: tabs.find((tab) => tab.active)?.id ?? null,
    });
  };

  const activateProject = (projectId: string): WorkspaceState => {
    const project = projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      throw new Error('Project is not available in this workspace.');
    }

    const now = new Date().toISOString();
    workspace.activeProjectId = project.id;
    workspace.updatedAt = now;
    project.lastOpenedAt = now;
    project.updatedAt = now;
    return getState();
  };

  const api: VibeWorkspaceApi = {
    chooseProjectFolder: async () => {
      const project = buildProject('new-workspace', 'C:\\Users\\om894\\Documents\\new-workspace');
      projects.unshift(project);
      tabsByProject.set(project.id, []);
      return activateProject(project.id);
    },
    getWorkspaceState: async () => getState(),
    selectProject: async ({ projectId }) => activateProject(projectId),
    createTab: async (input) => {
      const project = getSelectedProject();

      if (!project) {
        throw new Error('Select a project before creating a tab.');
      }

      const tabs = tabsByProject.get(project.id) ?? [];
      tabs.forEach((tab) => {
        tab.active = false;
      });
      const tab = buildTab(project.id, input?.title?.trim() || `Agent ${tabs.length + 1}`, true, tabs.length, [
        buildSubtab('Codex CLI', 'codex', true, 0),
      ]);
      tabs.push(tab);
      tabsByProject.set(project.id, tabs);
      return getState();
    },
    closeTab: async ({ tabId }) => {
      const project = getSelectedProject();
      const tabs = project ? (tabsByProject.get(project.id) ?? []) : [];
      const nextTabs = tabs.filter((tab) => tab.id !== tabId);

      if (!nextTabs.some((tab) => tab.active) && nextTabs[0]) {
        nextTabs[0].active = true;
      }

      if (project) {
        tabsByProject.set(project.id, nextTabs);
      }

      return getState();
    },
    renameTab: async ({ tabId, title }) => {
      const tab = findTab(tabsByProject, tabId);

      if (tab) {
        tab.title = title;
        tab.updatedAt = new Date().toISOString();
      }

      return getState();
    },
    setActiveTab: async ({ tabId }) => {
      const project = getSelectedProject();
      const tabs = project ? (tabsByProject.get(project.id) ?? []) : [];

      tabs.forEach((tab) => {
        tab.active = tab.id === tabId;
      });

      return getState();
    },
    createSubtab: async ({ tabId, preset }) => {
      const tab = findTab(tabsByProject, tabId);

      if (!tab) {
        throw new Error('Tab does not belong to the active project.');
      }

      tab.subtabs.forEach((subtab) => {
        subtab.active = false;
      });
      tab.subtabs.push(
        buildSubtab(
          preset === 'shell' ? `Shell ${tab.subtabs.length + 1}` : `Codex CLI ${tab.subtabs.length + 1}`,
          preset ?? 'codex',
          true,
          tab.subtabs.length,
        ),
      );
      tab.activeSubtabId = tab.subtabs.find((subtab) => subtab.active)?.id ?? null;
      return getState();
    },
    closeSubtab: async ({ tabId, subtabId }) => {
      const tab = findTab(tabsByProject, tabId);

      if (tab) {
        tab.subtabs = tab.subtabs.filter((subtab) => subtab.id !== subtabId);

        if (!tab.subtabs.some((subtab) => subtab.active) && tab.subtabs[0]) {
          tab.subtabs[0].active = true;
        }

        tab.activeSubtabId = tab.subtabs.find((subtab) => subtab.active)?.id ?? null;
      }

      return getState();
    },
    renameSubtab: async ({ tabId, subtabId, title }) => {
      const subtab = findTab(tabsByProject, tabId)?.subtabs.find((candidate) => candidate.id === subtabId);

      if (subtab) {
        subtab.title = title;
        subtab.updatedAt = new Date().toISOString();
      }

      return getState();
    },
    setActiveSubtab: async ({ tabId, subtabId }) => {
      const tab = findTab(tabsByProject, tabId);

      if (tab) {
        tab.subtabs.forEach((subtab) => {
          subtab.active = subtab.id === subtabId;
        });
        tab.activeSubtabId = subtabId;
      }

      return getState();
    },
    startTerminal: async ({ subtabId }) => {
      emitTerminalScript(terminalDataSubscribers, subtabId, [
        [80, '\r\nCodex mock session ready\r\n'],
        [180, 'Thinking...\r\n'],
        [280, 'Reading src/renderer/components/TabPlaceholder.tsx\r\n'],
        [380, 'Ready for a prompt.\r\n'],
      ]);
    },
    writeTerminal: ({ subtabId, data }) => {
      const prompt = data.replace(/\r/g, '').replace(/\n/g, '').trim();
      emitTerminalScript(terminalDataSubscribers, subtabId, buildMockCodexScript(prompt));
    },
    resizeTerminal: () => undefined,
    killTerminal: ({ subtabId }) => {
      emitTerminalExit(terminalExitSubscribers, { subtabId, exitCode: 0, signal: null });
    },
    clearTerminal: () => undefined,
    setWindowTitle: (title) => {
      document.title = title;
    },
    startAuthLogin: async ({ tabId }) => setAuthStatus(tabsByProject, tabId, 'login pending', getState),
    logoutAuth: async ({ tabId }) => setAuthStatus(tabsByProject, tabId, 'not connected', getState),
    refreshAuthStatus: async ({ tabId }) => setAuthStatus(tabsByProject, tabId, 'connected', getState),
    setAuthViewBounds: async () => undefined,
    hideAuthView: async () => undefined,
    refreshProfileUsage: async ({ tabId }) => setUsageStatus(tabsByProject, tabId, getState),
    importDefaultProfile: async ({ tabId }) => {
      const tab = findTab(tabsByProject, tabId);

      if (tab) {
        tab.sessionProfile.lastImportedAt = new Date().toISOString();
        addMockActivity(tab, 'import', 'Default profile imported');
      }

      return getState();
    },
    generateCliWrapper: async ({ tabId }) => {
      const tab = findTab(tabsByProject, tabId);

      if (tab) {
        const slug = tab.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        tab.sessionProfile.cliWrapperPath = `C:\\Users\\om894\\AppData\\Roaming\\Vibe Coding Workspace\\session-profiles\\${tab.sessionProfile.id}\\wrappers\\codex-${slug || 'session'}.cmd`;
        addMockActivity(tab, 'wrapper', 'CLI wrapper generated');
      }

      return getState();
    },
    onTerminalData: (callback) => {
      terminalDataSubscribers.add(callback);
      return () => {
        terminalDataSubscribers.delete(callback);
      };
    },
    onTerminalExit: (callback) => {
      terminalExitSubscribers.add(callback);
      return () => {
        terminalExitSubscribers.delete(callback);
      };
    },
    onWorkspaceStateChanged: () => {
      return () => undefined;
    },
    onMenuEvent: () => {
      return () => undefined;
    },
  };

  return api;
}

function buildProject(name: string, path: string): ProjectSummary {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    workspaceId: 'local-workspace',
    name,
    path,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    tabCount: 0,
    terminalCount: 0,
    activeTabTitle: null,
  };
}

function buildTab(
  projectId: string,
  title: string,
  active: boolean,
  sortOrder: number,
  subtabs: AgentSubtab[],
): AgentTab {
  const tabId = crypto.randomUUID();
  const now = new Date().toISOString();

  subtabs.forEach((subtab) => {
    subtab.agentTabId = tabId;
  });

  return {
    id: tabId,
    projectId,
    title,
    active,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    sessionProfile: {
      id: crypto.randomUUID(),
      agentTabId: tabId,
      appKind: 'codex',
      partitionId: `persist:mock-${tabId}`,
      authStatus: 'connected',
      usageSnapshot: buildMockUsageSnapshot(),
      cliWrapperPath: null,
      lastImportedAt: null,
      recentActivity: [
        {
          id: crypto.randomUUID(),
          agentTabId: tabId,
          kind: 'usage',
          label: 'Usage refreshed',
          metadata: '{"fiveHour":6,"weekly":1}',
          createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        },
        {
          id: crypto.randomUUID(),
          agentTabId: tabId,
          kind: 'auth',
          label: 'Auth connected',
          metadata: null,
          createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    subtabs,
    activeSubtabId: subtabs.find((subtab) => subtab.active)?.id ?? null,
  };
}

function buildMockUsageSnapshot(): UsageSnapshot {
  return {
    status: 'available',
    updatedAt: new Date().toISOString(),
    nextRefreshAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
    fiveHour: {
      label: '5-hour window',
      percent: 6,
      resetText: 'resets in 4h 36m',
      rawLine: '5-hour window 6% resets in 4h 36m',
    },
    weekly: {
      label: 'Weekly',
      percent: 1,
      resetText: 'resets in 6d',
      rawLine: 'Weekly 1% resets in 6d',
    },
    monthly: {
      label: 'Monthly limit',
      percent: 25,
      resetText: 'resets in 20:43 on 27 Jul',
      rawLine: 'Monthly limit 25% left (resets 20:43 on 27 Jul)',
    },
    rawOutput:
      'Usage\n5-hour window 6% resets in 4h 36m\nWeekly 1% resets in 6d\nMonthly limit 25% left (resets 20:43 on 27 Jul)',
    error: null,
  };
}

function buildSubtab(
  title: string,
  preset: AgentSubtabPreset,
  active: boolean,
  sortOrder: number,
): AgentSubtab {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    agentTabId: 'pending',
    title,
    kind: 'terminal',
    preset,
    active,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function findTab(tabsByProject: Map<string, AgentTab[]>, tabId: string): AgentTab | null {
  for (const tabs of tabsByProject.values()) {
    const tab = tabs.find((candidate) => candidate.id === tabId);

    if (tab) {
      return tab;
    }
  }

  return null;
}

function refreshProjectSummaries(
  projects: ProjectSummary[],
  tabsByProject: Map<string, AgentTab[]>,
): void {
  projects.forEach((project) => {
    const tabs = tabsByProject.get(project.id) ?? [];
    const activeTab = tabs.find((tab) => tab.active) ?? tabs[0] ?? null;

    project.tabCount = tabs.length;
    project.terminalCount = tabs.reduce((count, tab) => count + tab.subtabs.length, 0);
    project.activeTabTitle = activeTab?.title ?? null;
  });
}

function setAuthStatus(
  tabsByProject: Map<string, AgentTab[]>,
  tabId: string,
  authStatus: AuthStatus,
  getState: () => WorkspaceState,
): WorkspaceState {
  const tab = findTab(tabsByProject, tabId);

  if (tab) {
    tab.sessionProfile.authStatus = authStatus;
    addMockActivity(tab, 'auth', `Auth ${authStatus}`);
  }

  return getState();
}

function setUsageStatus(
  tabsByProject: Map<string, AgentTab[]>,
  tabId: string,
  getState: () => WorkspaceState,
): WorkspaceState {
  const tab = findTab(tabsByProject, tabId);

  if (tab) {
    const fiveHourPercent = tab.sessionProfile.usageSnapshot.fiveHour.percent ?? 6;
    const weeklyPercent = tab.sessionProfile.usageSnapshot.weekly.percent ?? 1;
    const monthlyPercent = tab.sessionProfile.usageSnapshot.monthly.percent ?? 25;

    tab.sessionProfile.usageSnapshot = {
      ...tab.sessionProfile.usageSnapshot,
      status: 'available',
      updatedAt: new Date().toISOString(),
      nextRefreshAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      fiveHour: {
        label: '5-hour window',
        percent: Math.min(100, fiveHourPercent + 1),
        resetText: 'resets in 4h 31m',
        rawLine: '5-hour window refreshed from mock status',
      },
      weekly: {
        label: 'Weekly',
        percent: Math.min(100, weeklyPercent + 1),
        resetText: 'resets in 6d',
        rawLine: 'Weekly refreshed from mock status',
      },
      monthly: {
        label: 'Monthly limit',
        percent: Math.max(0, monthlyPercent - 1),
        resetText: 'resets in 20:43 on 27 Jul',
        rawLine: 'Monthly limit refreshed from mock status',
      },
      rawOutput:
        'Usage\n5-hour window refreshed from mock status\nWeekly refreshed from mock status\nMonthly limit refreshed from mock status',
      error: null,
    };
    addMockActivity(tab, 'usage', 'Usage refreshed');
  }

  return getState();
}

function addMockActivity(
  tab: AgentTab,
  kind: AgentTab['sessionProfile']['recentActivity'][number]['kind'],
  label: string,
): void {
  tab.sessionProfile.recentActivity = [
    {
      id: crypto.randomUUID(),
      agentTabId: tab.id,
      kind,
      label,
      metadata: null,
      createdAt: new Date().toISOString(),
    },
    ...tab.sessionProfile.recentActivity,
  ].slice(0, 8);
}

function emitTerminalScript(
  subscribers: Set<(event: TerminalDataEvent) => void>,
  subtabId: string,
  chunks: Array<[number, string]>,
): void {
  chunks.forEach(([delayMs, data]) => {
    window.setTimeout(() => {
      subscribers.forEach((callback) => callback({ subtabId, data }));
    }, delayMs);
  });
}

function buildMockCodexScript(prompt: string): Array<[number, string]> {
  if (prompt.length === 0) {
    return [[80, '\r\n']];
  }

  return [
    [80, '\r\nThinking...\r\n'],
    [220, 'Running command: npm run typecheck\r\n'],
    [360, 'Modified src/renderer/components/TabPlaceholder.tsx\r\n'],
    [500, 'Allow Codex to run this command? [y/n]\r\n'],
    [
      720,
      `\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0631\u0633\u0627\u0644\u062a\u0643: ${prompt}\r\n\u0647\u0630\u0627 \u0631\u062f \u062a\u062c\u0631\u064a\u0628\u064a \u0645\u0646 \u0648\u0627\u062c\u0647\u0629 Codex \u0627\u0644\u062c\u062f\u064a\u062f\u0629. \u0627\u0644\u0648\u0627\u062c\u0647\u0629 \u062a\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0643\u064a\u0631 \u0648\u0627\u0644\u0623\u062f\u0648\u0627\u062a \u0628\u062f\u0648\u0646 \u0636\u0648\u0636\u0627\u0621 \u0627\u0644\u062a\u0631\u0645\u064a\u0646\u0627\u0644\u060c \u0648\u062a\u062f\u0639\u0645 \u0627\u0644\u0646\u0635 \u0627\u0644\u0639\u0631\u0628\u064a \u0628\u0648\u0636\u0648\u062d.\r\n`,
    ],
  ];
}

function emitTerminalExit(
  subscribers: Set<(event: TerminalExitEvent) => void>,
  event: TerminalExitEvent,
): void {
  subscribers.forEach((callback) => callback(event));
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
