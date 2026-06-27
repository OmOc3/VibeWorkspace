import { z } from 'zod';

export const idSchema = z.string().uuid();
export const authStatusSchema = z.enum(['not connected', 'login pending', 'connected', 'error']);
export const agentAppKindSchema = z.enum(['codex', 'claude']);
export const agentSubtabPresetSchema = z.enum(['codex', 'shell', 'codex-login']);
export const sessionActivityKindSchema = z.enum([
  'auth',
  'created',
  'import',
  'session',
  'terminal',
  'usage',
  'wrapper',
]);
export const terminalViewModeSchema = z.enum(['enhanced', 'cli']);

const terminalDimensionSchema = z.number().int().min(2).max(500);

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  activeProjectId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectSchema = z.object({
  id: idSchema,
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime(),
});

export const projectSummarySchema = projectSchema.extend({
  tabCount: z.number().int().nonnegative(),
  terminalCount: z.number().int().nonnegative(),
  activeTabTitle: z.string().min(1).max(80).nullable(),
});

export const usageWindowSnapshotSchema = z.object({
  label: z.string().min(1),
  percent: z.number().min(0).max(100).nullable(),
  resetText: z.string().min(1).max(120).nullable(),
  rawLine: z.string().max(600).nullable(),
});

export const usageSnapshotSchema = z.object({
  status: z.enum(['unknown', 'refreshing', 'available', 'error']),
  updatedAt: z.string().datetime().nullable(),
  nextRefreshAt: z.string().datetime().nullable(),
  fiveHour: usageWindowSnapshotSchema,
  weekly: usageWindowSnapshotSchema,
  monthly: usageWindowSnapshotSchema,
  rawOutput: z.string().max(12000),
  error: z.string().max(1000).nullable(),
});

export const sessionActivitySchema = z.object({
  id: idSchema,
  agentTabId: idSchema,
  kind: sessionActivityKindSchema,
  label: z.string().min(1).max(160),
  metadata: z.string().max(1200).nullable(),
  createdAt: z.string().datetime(),
});

export const sessionProfileSchema = z.object({
  id: idSchema,
  agentTabId: idSchema,
  appKind: agentAppKindSchema,
  partitionId: z.string().startsWith('persist:'),
  authStatus: authStatusSchema,
  usageSnapshot: usageSnapshotSchema,
  cliWrapperPath: z.string().min(1).nullable(),
  lastImportedAt: z.string().datetime().nullable(),
  recentActivity: z.array(sessionActivitySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentSubtabSchema = z.object({
  id: idSchema,
  agentTabId: idSchema,
  title: z.string().min(1).max(80),
  kind: z.literal('terminal'),
  preset: agentSubtabPresetSchema,
  active: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentTabSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: z.string().min(1).max(80),
  active: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sessionProfile: sessionProfileSchema,
  subtabs: z.array(agentSubtabSchema),
  activeSubtabId: idSchema.nullable(),
});

export const workspaceStateSchema = z.object({
  workspace: workspaceSchema,
  projects: z.array(projectSummarySchema),
  selectedProject: projectSchema.nullable(),
  tabs: z.array(agentTabSchema),
  activeTabId: idSchema.nullable(),
});

export const selectProjectInputSchema = z.object({
  projectId: idSchema,
});

export const createTabInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
  })
  .optional();

export const closeTabInputSchema = z.object({
  tabId: idSchema,
});

export const renameTabInputSchema = z.object({
  tabId: idSchema,
  title: z.string().trim().min(1).max(80),
});

export const setActiveTabInputSchema = z.object({
  tabId: idSchema,
});

export const createSubtabInputSchema = z.object({
  tabId: idSchema,
  title: z.string().trim().min(1).max(80).optional(),
  preset: agentSubtabPresetSchema.optional(),
});

export const closeSubtabInputSchema = z.object({
  tabId: idSchema,
  subtabId: idSchema,
});

export const renameSubtabInputSchema = z.object({
  tabId: idSchema,
  subtabId: idSchema,
  title: z.string().trim().min(1).max(80),
});

export const setActiveSubtabInputSchema = z.object({
  tabId: idSchema,
  subtabId: idSchema,
});

export const terminalStartInputSchema = z.object({
  tabId: idSchema,
  subtabId: idSchema,
  cols: terminalDimensionSchema,
  rows: terminalDimensionSchema,
  viewMode: terminalViewModeSchema.optional(),
});

export const terminalInputSchema = z.object({
  subtabId: idSchema,
  data: z.string(),
});

export const terminalResizeInputSchema = z.object({
  subtabId: idSchema,
  cols: terminalDimensionSchema,
  rows: terminalDimensionSchema,
});

export const terminalControlInputSchema = z.object({
  subtabId: idSchema,
});

export const authTabInputSchema = z.object({
  tabId: idSchema,
});

export const profileTabInputSchema = z.object({
  tabId: idSchema,
});

export const authViewBoundsInputSchema = z.object({
  tabId: idSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(0).max(10000),
  height: z.number().int().min(0).max(10000),
});
