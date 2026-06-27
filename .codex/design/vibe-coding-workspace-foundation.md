# Vibe Coding Workspace Design Foundation

## Product Surface

This app is a local-first desktop workspace for managing one project with multiple isolated AI agent sessions. The first screen should feel like a professional desktop tool, not a marketing page.

Primary regions:

- Fixed left sidebar for project identity and workspace actions.
- Top tab bar for agent session tabs.
- Main content surface for the active tab or welcome empty state.
- Placeholder tab panel that exposes session architecture details until `WebContentsView` content is implemented.

## Visual Direction

The UI should be quiet, dense enough for repeated work, and readable on a laptop. The interface uses restrained contrast, compact controls, and clear state changes. Cards are limited to framed functional objects like the selected project, empty states, and placeholder information rows.

## Tokens

- Background: `#f4f2ee`
- Sidebar surface: `#fbfaf7`
- Primary surface: `#ffffff`
- Alternate surface: `#f9f7f2`
- Text: `#25231f`
- Muted text: `#6f6a61`
- Border: `#ded8ce`
- Strong border: `#c9c1b5`
- Accent: `#247c68`
- Accent strong: `#175c4d`
- Accent soft: `#dceee8`
- Warning soft: `#fff4d7`
- Radius: `8px` for panels and controls
- Shadow: subtle, reserved for primary empty or placeholder panels

## Component Rules

- Icon buttons use lucide icons and accessible labels.
- Text buttons are used only for clear commands like choosing a folder or creating a tab.
- Tab labels truncate instead of resizing the tab strip.
- Long paths and partition IDs truncate visually but keep full values in `title` attributes.
- Renderer UI must never expose Electron internals beyond typed data returned by preload.

## Interaction States

- No project selected: centered welcome state with folder selection.
- Project selected, no tabs: compact ready state with create-tab action.
- Active tab: placeholder panel showing tab ID, project, partition ID, and auth status.
- Rename tab: inline form within the selected tab shape.
- Close tab: removes only that tab and preserves other sessions.

## Future View Integration

When prompt 2 adds `WebContentsView`, the current main content placeholder should be replaced by a view-hosting region controlled by the main process. Renderer controls should continue to dispatch typed IPC commands only.
