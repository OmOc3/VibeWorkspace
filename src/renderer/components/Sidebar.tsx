import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Command,
  FolderOpen,
  FolderPlus,
  Gauge,
  HardDrive,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Pin,
  Sun,
  Terminal,
  UserRoundCheck,
} from 'lucide-react';
import type { ThemeMode } from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { WorkspaceView } from '../workspaceViews';

interface SidebarProps {
  activeView: WorkspaceView;
  pinned: boolean;
  hovered: boolean;
  onOpenCommandPalette: () => void;
  onOpenProjectPicker: () => void;
  onSetActiveView: (view: WorkspaceView) => void;
  onTogglePin: () => void;
  onToggleTheme: () => void;
  themeMode: ThemeMode;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

interface SidebarAction {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  value?: string;
}

export function Sidebar({
  activeView,
  pinned,
  hovered,
  onOpenCommandPalette,
  onOpenProjectPicker,
  onSetActiveView,
  onTogglePin,
  onToggleTheme,
  themeMode,
  onMouseEnter,
  onMouseLeave,
}: SidebarProps): JSX.Element {
  const state = useWorkspaceStore((store) => store.state);
  const loading = useWorkspaceStore((store) => store.loading);
  const chooseProject = useWorkspaceStore((store) => store.chooseProject);
  const createTab = useWorkspaceStore((store) => store.createTab);

  const selectedProject = state?.selectedProject ?? null;
  const activeTab = state?.tabs.find((tab) => tab.active) ?? null;
  const sessionCount = state?.tabs.length ?? 0;
  const terminalCount = state?.tabs.reduce((count, tab) => count + tab.subtabs.length, 0) ?? 0;
  const savedProjectCount = state?.projects.length ?? 0;
  const authStatus = activeTab?.sessionProfile.authStatus ?? 'not connected';

  const navigationActions: Array<{
    icon: LucideIcon;
    label: string;
    view: WorkspaceView;
    value?: string;
  }> = [
    {
      icon: Terminal,
      label: 'Terminal',
      view: 'terminal',
      value: terminalCount > 0 ? `${terminalCount}` : undefined,
    },
    {
      icon: MessageSquare,
      label: 'Session',
      view: 'session',
      value: activeTab ? 'active' : undefined,
    },
    {
      icon: Gauge,
      label: 'Usage',
      view: 'usage',
      value: activeTab?.sessionProfile.usageSnapshot.status,
    },
    {
      icon: FolderOpen,
      label: 'Projects',
      view: 'projects',
      value: savedProjectCount > 0 ? `${savedProjectCount}` : undefined,
    },
  ];

  const primaryActions: SidebarAction[] = [
    {
      icon: Plus,
      label: 'New session',
      onClick: () => void createTab(),
      disabled: loading || !selectedProject,
      value: 'Ctrl N',
    },
    {
      icon: Command,
      label: 'Command palette',
      onClick: onOpenCommandPalette,
      value: 'Ctrl K',
    },
  ];

  const projectActions: SidebarAction[] = [
    {
      icon: FolderOpen,
      label: 'Switch project',
      onClick: onOpenProjectPicker,
      disabled: loading,
    },
    {
      icon: FolderPlus,
      label: 'Open folder',
      onClick: () => void chooseProject(),
      disabled: loading,
    },
  ];

  // Dynamic class string based on state
  const sidebarClass = [
    'workspace-sidebar',
    pinned ? 'workspace-sidebar--pinned' : 'workspace-sidebar--floating',
    !pinned && hovered ? 'workspace-sidebar--visible' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside
      className={sidebarClass}
      aria-label="Workspace navigation"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Brand Header */}
      <header className="workspace-sidebar__header">
        <div className="workspace-sidebar__brand" title="Vibe Coding Workspace">
          <div className="workspace-sidebar__logo" aria-hidden="true">
            VC
          </div>
          <div className="workspace-sidebar__brand-text">
            <strong>Vibe Coding</strong>
            <span>Workspace</span>
          </div>
        </div>

        <button
          className="workspace-sidebar__pin-button"
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
          title={pinned ? 'Collapse/Unpin sidebar' : 'Pin sidebar to screen'}
        >
          {pinned ? <PanelLeftClose size={16} /> : <Pin size={16} />}
        </button>
      </header>

      {/* Active Project Card */}
      <section className="workspace-sidebar__project-card" title={selectedProject?.path ?? 'No project selected'}>
        <div className="workspace-sidebar__project-card-header">
          <div className="workspace-sidebar__project-card-icon" aria-hidden="true">
            <HardDrive size={16} />
          </div>
          <span className="workspace-sidebar__project-card-badge">Active Project</span>
        </div>
        <div className="workspace-sidebar__project-card-body">
          {selectedProject ? (
            <>
              <strong className="workspace-sidebar__project-title">{selectedProject.name}</strong>
              <code className="workspace-sidebar__project-path">{selectedProject.path}</code>
            </>
          ) : (
            <button
              className="workspace-sidebar__project-empty-btn"
              type="button"
              onClick={() => void chooseProject()}
              disabled={loading}
            >
              Choose Folder...
            </button>
          )}
        </div>
      </section>

      {/* Navigation & Controls */}
      <nav className="workspace-sidebar__nav" aria-label="Workspace controls">
        <SidebarSection label="Pages">
          {navigationActions.map((action) => (
            <SidebarViewButton
              active={activeView === action.view}
              key={action.view}
              action={action}
              onSelect={() => onSetActiveView(action.view)}
            />
          ))}
        </SidebarSection>

        {/* Dashboard Status Card */}
        {activeTab && (
          <section className="workspace-sidebar__dashboard-card">
            <span className="workspace-sidebar__dashboard-title">Active Session</span>
            <strong className="workspace-sidebar__dashboard-value">{activeTab.title}</strong>
            <div className="workspace-sidebar__dashboard-footer">
              <span className="workspace-sidebar__dashboard-stat">
                <MessageSquare size={12} /> {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
              </span>
              <span className="workspace-sidebar__dashboard-stat">
                <Terminal size={12} /> {terminalCount} {terminalCount === 1 ? 'terminal' : 'terminals'}
              </span>
            </div>
          </section>
        )}

        <SidebarSection label="Quick Actions">
          {primaryActions.map((action) => (
            <SidebarActionButton key={action.label} action={action} />
          ))}
        </SidebarSection>

        <SidebarSection label="Project">
          {projectActions.map((action) => (
            <SidebarActionButton key={action.label} action={action} />
          ))}
        </SidebarSection>
      </nav>

      {/* Codex Profile Status */}
      <section className="workspace-sidebar__profile-card" title={`Codex Profile Status: ${authStatus}`}>
        <div className="workspace-sidebar__profile-info">
          <div className="workspace-sidebar__profile-status-wrapper">
            <div className={`workspace-sidebar__pulse-dot workspace-sidebar__pulse-dot--${formatStatusClass(authStatus)}`} />
            <span className="workspace-sidebar__profile-title">Codex profile</span>
          </div>
          <strong className="workspace-sidebar__profile-status-text">{authStatus}</strong>
        </div>
        <UserRoundCheck className="workspace-sidebar__profile-check" size={16} aria-hidden="true" />
      </section>

      {/* Footer Toggler */}
      <footer className="workspace-sidebar__footer">
        <div className="workspace-sidebar__theme-switcher">
          <button
            className={`workspace-sidebar__theme-tab ${themeMode === 'light' ? 'workspace-sidebar__theme-tab--active' : ''}`}
            type="button"
            onClick={themeMode === 'dark' ? onToggleTheme : undefined}
            title="Switch to Light Mode"
            aria-label="Light mode"
          >
            <Sun size={14} />
            <span>Light</span>
          </button>
          <button
            className={`workspace-sidebar__theme-tab ${themeMode === 'dark' ? 'workspace-sidebar__theme-tab--active' : ''}`}
            type="button"
            onClick={themeMode === 'light' ? onToggleTheme : undefined}
            title="Switch to Dark Mode"
            aria-label="Dark mode"
          >
            <Moon size={14} />
            <span>Dark</span>
          </button>
        </div>
      </footer>
    </aside>
  );
}

function SidebarSection({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}): JSX.Element {
  return (
    <section className="workspace-sidebar__section" aria-label={label}>
      <h2 className="workspace-sidebar__section-title">{label}</h2>
      <div className="workspace-sidebar__section-body">{children}</div>
    </section>
  );
}

function SidebarActionButton({ action }: { action: SidebarAction }): JSX.Element {
  const Icon = action.icon;

  return (
    <button
      className="workspace-sidebar__action"
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.label}
    >
      <span className="workspace-sidebar__item-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="workspace-sidebar__item-label">{action.label}</span>
      {action.value ? <kbd>{action.value}</kbd> : null}
    </button>
  );
}

function SidebarViewButton({
  action,
  active,
  onSelect,
}: {
  action: { icon: LucideIcon; label: string; value?: string };
  active: boolean;
  onSelect: () => void;
}): JSX.Element {
  const Icon = action.icon;

  return (
    <button
      className={active ? 'workspace-sidebar__action workspace-sidebar__action--active' : 'workspace-sidebar__action'}
      type="button"
      onClick={onSelect}
      title={action.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="workspace-sidebar__item-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="workspace-sidebar__item-label">{action.label}</span>
      {action.value ? (
        <span className="workspace-sidebar__badge-counter">{action.value}</span>
      ) : null}
    </button>
  );
}

function formatStatusClass(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

