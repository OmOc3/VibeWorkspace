# Vibe Coding Workspace

Vibe Coding Workspace is an Electron desktop app foundation for working on one local project with multiple isolated AI agent tabs in parallel.

This first step implements the local shell, project selection, persistent tab metadata, session partition modeling, and a secure IPC boundary. It does not implement real OpenAI auth or external web content yet.

## Architecture

- Electron main process owns windows, SQLite, IPC handlers, and future `WebContentsView` lifecycle.
- React + TypeScript renderer owns only UI state and interactions.
- Preload exposes a narrow, typed bridge through `window.vibeWorkspace`.
- SQLite persists workspace, project, tab, and session profile records locally.
- Drizzle ORM defines the database schema and performs typed database operations.
- Zustand keeps renderer state small and explicit.
- Zod validates IPC inputs and returned workspace state.

Folder layout:

```text
src/main      Electron app, window, IPC, services
src/preload   Secure context bridge
src/renderer  React app and Zustand state
src/shared    DTOs, Zod schemas, IPC channel names
src/db        Drizzle schema
```

## WebContentsView-Ready Design

Electron `BrowserView` is deprecated, so the app is structured around a future `WebContentsView` integration.

`TabSessionManager` owns session partition IDs and will own future view lifecycle. The renderer never creates or manages Electron views. When external agent surfaces are added, the main process can create one `WebContentsView` per active tab using the tab's durable partition:

```text
persist:workspace-{workspaceId}-project-{projectId}-tab-{tabId}
```

This prepares each tab for isolated cookies, local storage, auth state, and logout behavior without affecting other tabs.

## Security Decisions

- `contextIsolation` is enabled.
- `nodeIntegration` is disabled in the renderer.
- Renderer access to Electron is limited to the preload bridge.
- IPC payloads are validated with Zod.
- Navigation is constrained to the dev server in development or local files in production.
- No telemetry, cloud sync, or backend server is included.
- Keytar is represented as a placeholder secret-store interface only. Real secret flows should be added with auth providers later.

## Database

SQLite database file:

```text
<Electron userData>/workspace.sqlite
```

Tables:

- `workspaces`
- `projects`
- `agent_tabs`
- `session_profiles`

The app creates the schema on startup for this foundation step. Formal Drizzle migrations can be introduced when schema changes become part of release management.

## Local Development

Install dependencies:

```bash
npm install
```

On Windows PowerShell, if script execution policy blocks `npm.ps1`, use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run dev
```

Run the app:

```bash
npm run dev
```

If Windows reports that `better_sqlite3.node` is locked during install or packaging, close any running app instance and rerun the Electron native dependency rebuild:

```bash
npm run rebuild:native
```

Build:

```bash
npm run build
```

Package a local unpacked app:

```bash
npm run package
```

Create distributables:

```bash
npm run dist
```

## Current Features

- App window with sidebar, tab bar, and main content area.
- Welcome empty state when no project is selected.
- Local folder picker for selecting a project.
- SQLite persistence for selected project metadata.
- Create, close, rename, and activate agent tabs.
- SQLite persistence for tabs and session profiles.
- Per-tab partition IDs for future isolated login/session state.
- Placeholder tab panel showing tab ID, project name, partition ID, and auth status.
- Basic JSON logging to console and `<userData>/logs/app.log`.

## Future Auth Plan

Auth providers should be added behind a main-process auth service that uses the existing `SessionProfile` model. Secrets should be stored through a real Keytar-backed implementation of the `SecretStore` interface. Per-tab logout should clear only that tab's partition and associated secrets.

Renderer auth UI should call typed IPC methods only. It should not access tokens, cookies, filesystem paths, or provider SDK secrets directly.

## Next Steps For Prompt 2

1. Add real `WebContentsView` creation, sizing, attachment, and disposal in `TabSessionManager`.
2. Add per-tab view visibility switching when active tabs change.
3. Add provider-neutral auth service interfaces and a first auth placeholder flow.
4. Add per-tab logout that clears only the selected tab's partition and secret records.
5. Add formal Drizzle migration files and a migration runner.
6. Add renderer tests for tab workflows and main-process tests for repository/service behavior.
