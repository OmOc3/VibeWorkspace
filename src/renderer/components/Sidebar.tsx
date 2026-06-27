import type { LucideIcon } from 'lucide-react';
import {
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  Terminal,
} from 'lucide-react';
import type { ThemeMode } from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';

interface SidebarProps {
  collapsed: boolean;
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
}

interface SidebarSummaryItem {
  active?: boolean;
  badge?: number | string;
  icon: LucideIcon;
  label: string;
  value: string;
}

export function Sidebar({
  collapsed,
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
  const authStatus = activeTab?.sessionProfile.authStatus ?? 'not connected';

  const summaryItems: SidebarSummaryItem[] = [
    {
      active: true,
      icon: Home,
      label: 'Project',
      value: selectedProject?.name ?? 'No project',
    },
    {
      badge: sessionCount,
      icon: MessageSquare,
      label: 'Sessions',
      value: activeTab?.title ?? 'No active session',
    },
    {
      badge: terminalCount,
      icon: Terminal,
      label: 'Terminals',
      value: terminalCount === 1 ? '1 terminal' : `${terminalCount} terminals`,
    },
  ];

  const actions: SidebarAction[] = [
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
    {
      icon: Plus,
      label: 'New session',
      onClick: () => void createTab(),
      disabled: loading || !selectedProject,
    },
  ];

  return (
    <aside className={collapsed ? 'sidebar sidebar--collapsed' : 'sidebar'} aria-label="Workspace sidebar">
      <div className="sidebar-topline">
        <div className="brand-block">
          <div className="brand-mark">VC</div>
          <div className="sidebar-collapsible">
            <div className="brand-title">Vibe Coding</div>
            <div className="brand-subtitle">Workspace</div>
          </div>
        </div>
        <button
          className="icon-button icon-button--sidebar"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="project-card project-card--navigation" title={selectedProject?.path ?? 'No project selected'}>
        <div className="project-card__icon" aria-hidden="true">
          <HardDrive size={18} />
        </div>
        <div className="project-card__content sidebar-collapsible">
          <div className="project-card__name">{selectedProject?.name ?? 'Choose a project'}</div>
          <div className="project-card__path">{selectedProject?.path ?? 'Start from the project picker'}</div>
        </div>
      </div>

      <nav className="sidebar-navigation" aria-label="Workspace overview">
        <div className="sidebar-nav-section" role="list">
          {summaryItems.map((item) => (
            <SidebarSummaryItem key={item.label} item={item} />
          ))}
        </div>

        <div className="sidebar-divider" aria-hidden="true" />

        <div className="sidebar-nav-section" role="list" aria-label="Project actions">
          {actions.map((action) => (
            <SidebarActionButton key={action.label} action={action} />
          ))}
        </div>

        <div className="sidebar-divider" aria-hidden="true" />

        <div className="sidebar-session-status" title={authStatus}>
          <span className={`sidebar-status-dot sidebar-status-dot--${authStatus.replace(' ', '-')}`} />
          <span className="sidebar-collapsible">Codex {authStatus}</span>
        </div>

        <button
          className="theme-switch theme-switch--sidebar"
          type="button"
          onClick={onToggleTheme}
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={themeMode === 'dark'}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="theme-switch__icon" aria-hidden="true">
            {themeMode === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
          </span>
          <span className="theme-switch__body sidebar-collapsible">
            <span className="theme-switch__label">{themeMode === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            <span className="theme-switch__value">
              {themeMode === 'dark' ? 'Switch to light' : 'Switch to dark'}
            </span>
          </span>
        </button>
      </nav>

      <div className="sidebar-footer sidebar-collapsible">
        <span>Local-first</span>
        <span>{state?.projects.length ?? 0} saved projects</span>
      </div>
    </aside>
  );
}

function SidebarSummaryItem({ item }: { item: SidebarSummaryItem }): JSX.Element {
  const Icon = item.icon;

  return (
    <div
      className={item.active ? 'sidebar-nav-item sidebar-nav-item--active' : 'sidebar-nav-item'}
      role="listitem"
      title={`${item.label}: ${item.value}`}
    >
      <span className="sidebar-nav-item__icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="sidebar-nav-item__body sidebar-collapsible">
        <span className="sidebar-nav-item__label">{item.label}</span>
        <span className="sidebar-nav-item__value">{item.value}</span>
      </span>
      {item.badge !== undefined ? <span className="sidebar-nav-item__badge sidebar-collapsible">{item.badge}</span> : null}
    </div>
  );
}

function SidebarActionButton({ action }: { action: SidebarAction }): JSX.Element {
  const Icon = action.icon;

  return (
    <button
      className="sidebar-nav-item sidebar-nav-item--button"
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.label}
    >
      <span className="sidebar-nav-item__icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="sidebar-nav-item__body sidebar-collapsible">
        <span className="sidebar-nav-item__label">{action.label}</span>
      </span>
    </button>
  );
}
