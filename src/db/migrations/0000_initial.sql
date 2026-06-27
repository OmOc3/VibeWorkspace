CREATE TABLE IF NOT EXISTS `agent_subtabs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_tab_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'terminal' NOT NULL,
	`preset` text DEFAULT 'codex' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`agent_tab_id`) REFERENCES `agent_tabs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_subtabs_agent_tab_id` ON `agent_subtabs` (`agent_tab_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_tabs_project_id` ON `agent_tabs` (`project_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_opened_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_tab_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`agent_tab_id`) REFERENCES `agent_tabs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_session_activities_agent_tab_id` ON `session_activities` (`agent_tab_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_tab_id` text NOT NULL,
	`app_kind` text DEFAULT 'codex' NOT NULL,
	`partition_id` text NOT NULL,
	`auth_status` text DEFAULT 'not connected' NOT NULL,
	`usage_snapshot` text,
	`cli_wrapper_path` text,
	`last_imported_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`agent_tab_id`) REFERENCES `agent_tabs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `session_profiles_partition_id_unique` ON `session_profiles` (`partition_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_session_profiles_agent_tab_id` ON `session_profiles` (`agent_tab_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active_project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
