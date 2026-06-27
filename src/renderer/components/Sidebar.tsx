import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Command,
  FolderOpen,
  FolderPlus,
  HardDrive,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  Terminal,
  UserRoundCheck,
} from 'lucide-react';
import type { ThemeMode } from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';

interface SidebarProps {
  collapsed: boolean;
  onOpenCommandPalette: () => void;
  onOpenProjectPicker: () => void;
  onToggle: () => void;
  onToggleTheme: () => void;
  themeMode: ThemeMode;
}

interface SidebarAction {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  value?: string;
}

interface SidebarMetric {
  icon: LucideIcon;
  label: string;
  value: number | string;
}

export function Sidebar({
  collapsed,
  onOpenCommandPalette,
  onOpenProjectPicker,
  onToggle,
  onToggleTheme,
  themeMode,
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

  const metrics: SidebarMetric[] = [
    {
      icon: MessageSquare,
      label: 'Sessions',
      value: sessionCount,
    },
    {
      icon: Terminal,
      label: 'Terminals',
      value: terminalCount,
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

  return (
    <aside
      className={collapsed ? 'workspace-sidebar workspace-sidebar--collapsed' : 'workspace-sidebar'}
      aria-label="Workspace navigation"
    >
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
          className="workspace-sidebar__icon-button"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </header>

      <section className="workspace-sidebar__project" title={selectedProject?.path ?? 'No project selected'}>
        <div className="workspace-sidebar__project-icon" aria-hidden="true">
          <HardDrive size={18} />
        </div>
        <div className="workspace-sidebar__project-copy">
          <span>Active project</span>
          <strong>{selectedProject?.name ?? 'Choose a project'}</strong>
          <code>{selectedProject?.path ?? 'No local folder selected'}</code>
        </div>
      </section>

      <nav className="workspace-sidebar__nav" aria-label="Workspace controls">
        <SidebarSection label="Workspace" collapsed={collapsed}>
          {metrics.map((metric) => (
            <SidebarMetricRow key={metric.label} metric={metric} />
          ))}
          <div className="workspace-sidebar__active-session" title={activeTab?.title ?? 'No active session'}>
            <span>Active session</span>
            <strong>{activeTab?.title ?? 'No active session'}</strong>
          </div>
        </SidebarSection>

        <SidebarSection label="Quick actions" collapsed={collapsed}>
          {primaryActions.map((action) => (
            <SidebarActionButton key={action.label} action={action} />
          ))}
        </SidebarSection>

        <SidebarSection label="Project" collapsed={collapsed}>
          {projectActions.map((action) => (
            <SidebarActionButton key={action.label} action={action} />
          ))}
        </SidebarSection>
      </nav>

      <section className="workspace-sidebar__profile" title={`Codex ${authStatus}`}>
        <div className={`workspace-sidebar__status-dot workspace-sidebar__status-dot--${formatStatusClass(authStatus)}`} />
        <div className="workspace-sidebar__profile-copy">
          <span>Codex profile</span>
          <strong>{authStatus}</strong>
        </div>
        <UserRoundCheck className="workspace-sidebar__profile-icon" size={16} aria-hidden="true" />
      </section>

      <footer className="workspace-sidebar__footer">
        <button
          className="workspace-sidebar__theme"
          type="button"
          onClick={onToggleTheme}
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={themeMode === 'dark'}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="workspace-sidebar__theme-icon" aria-hidden="true">
            {themeMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </span>
          <span className="workspace-sidebar__theme-copy">
            <strong>{themeMode === 'dark' ? 'Dark mode' : 'Light mode'}</strong>
            <span>{savedProjectCount} saved projects</span>
          </span>
        </button>
      </footer>
    </aside>
  );
}

function SidebarSection({
  children,
  collapsed,
  label,
}: {
  children: ReactNode;
  collapsed: boolean;
  label: string;
}): JSX.Element {
  return (
    <section className="workspace-sidebar__section" aria-label={label}>
      <h2 className="workspace-sidebar__section-title">{collapsed ? null : label}</h2>
      <div className="workspace-sidebar__section-body">{children}</div>
    </section>
  );
}

function SidebarMetricRow({ metric }: { metric: SidebarMetric }): JSX.Element {
  const Icon = metric.icon;

  return (
    <div className="workspace-sidebar__metric" title={`${metric.label}: ${metric.value}`}>
      <span className="workspace-sidebar__item-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="workspace-sidebar__item-label">{metric.label}</span>
      <span className="workspace-sidebar__metric-value">{metric.value}</span>
    </div>
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

function formatStatusClass(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}
