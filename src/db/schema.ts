import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  activeProjectId: text('active_project_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  lastOpenedAt: integer('last_opened_at').notNull(),
});

export const agentTabs = sqliteTable('agent_tabs', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessionProfiles = sqliteTable('session_profiles', {
  id: text('id').primaryKey(),
  agentTabId: text('agent_tab_id')
    .notNull()
    .references(() => agentTabs.id, { onDelete: 'cascade' }),
  appKind: text('app_kind').notNull().default('codex'),
  partitionId: text('partition_id').notNull().unique(),
  authStatus: text('auth_status').notNull().default('not connected'),
  usageSnapshot: text('usage_snapshot'),
  cliWrapperPath: text('cli_wrapper_path'),
  lastImportedAt: integer('last_imported_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const agentSubtabs = sqliteTable('agent_subtabs', {
  id: text('id').primaryKey(),
  agentTabId: text('agent_tab_id')
    .notNull()
    .references(() => agentTabs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('terminal'),
  preset: text('preset').notNull().default('codex'),
  active: integer('active', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessionActivities = sqliteTable('session_activities', {
  id: text('id').primaryKey(),
  agentTabId: text('agent_tab_id')
    .notNull()
    .references(() => agentTabs.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  label: text('label').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
});

export type WorkspaceRow = InferSelectModel<typeof workspaces>;
export type ProjectRow = InferSelectModel<typeof projects>;
export type AgentTabRow = InferSelectModel<typeof agentTabs>;
export type SessionProfileRow = InferSelectModel<typeof sessionProfiles>;
export type AgentSubtabRow = InferSelectModel<typeof agentSubtabs>;
export type SessionActivityRow = InferSelectModel<typeof sessionActivities>;

export type NewWorkspaceRow = InferInsertModel<typeof workspaces>;
export type NewProjectRow = InferInsertModel<typeof projects>;
export type NewAgentTabRow = InferInsertModel<typeof agentTabs>;
export type NewSessionProfileRow = InferInsertModel<typeof sessionProfiles>;
export type NewAgentSubtabRow = InferInsertModel<typeof agentSubtabs>;
export type NewSessionActivityRow = InferInsertModel<typeof sessionActivities>;
