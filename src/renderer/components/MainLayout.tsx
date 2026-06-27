import { useEffect, useState } from 'react';
import type { ThemeMode } from '../App';
import { CommandPalette } from './CommandPalette';
import { ProjectPicker } from './ProjectPicker';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { TabPlaceholder } from './TabPlaceholder';
import { useWorkspaceStore } from '../state/workspaceStore';

interface MainLayoutProps {
  onToggleTheme: () => void;
  themeMode: ThemeMode;
}

export function MainLayout({ onToggleTheme, themeMode }: MainLayoutProps): JSX.Element {
  const state = useWorkspaceStore((store) => store.state);
  const loading = useWorkspaceStore((store) => store.loading);
  const error = useWorkspaceStore((store) => store.error);
  const createTab = useWorkspaceStore((store) => store.createTab);
  const setActiveTab = useWorkspaceStore((store) => store.setActiveTab);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const activeTabId = state?.activeTabId ?? state?.tabs[0]?.id ?? null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const hasModifier = event.ctrlKey || event.metaKey;

      if (!hasModifier) {
        return;
      }

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void createTab();
        return;
      }

      const tabIndex = Number(event.key) - 1;

      if (tabIndex >= 0 && tabIndex <= 8 && state?.tabs[tabIndex]) {
        event.preventDefault();
        void setActiveTab(state.tabs[tabIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createTab, setActiveTab, state?.tabs]);

  if (loading && !state) {
    return (
      <main className="project-gateway project-gateway--loading">
        <div className="loading-state">Loading workspace...</div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="project-gateway project-gateway--loading">
        <section className="empty-state empty-state--compact" aria-labelledby="workspace-unavailable-title">
          <div className="empty-state__copy">
            <h1 id="workspace-unavailable-title">Workspace unavailable</h1>
            <p>The desktop bridge did not initialize, so project actions cannot run.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!state.selectedProject || !workspaceOpen) {
    return (
      <ProjectPicker
        onEnterWorkspace={() => setWorkspaceOpen(true)}
        onToggleTheme={onToggleTheme}
        themeMode={themeMode}
      />
    );
  }

  const selectedProject = state.selectedProject;

  return (
    <div className={sidebarCollapsed ? 'app-shell app-shell--sidebar-collapsed' : 'app-shell'}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onOpenProjectPicker={() => setWorkspaceOpen(false)}
        onToggleTheme={onToggleTheme}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        themeMode={themeMode}
      />
      <main className="workspace-shell">
        <TabBar />
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="content-surface">
          {state.tabs.length > 0 ? (
            state.tabs.map((tab) => (
              <TabPlaceholder
                active={tab.id === activeTabId}
                key={tab.id}
                tab={tab}
                project={selectedProject}
              />
            ))
          ) : (
            <section className="empty-state empty-state--compact" aria-labelledby="project-ready-title">
              <div className="empty-state__copy">
                <h1 id="project-ready-title">Project ready</h1>
                <p>Create an agent tab to prepare an isolated session profile for this project.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => void createTab()}>
                Create Agent Tab
              </button>
            </section>
          )}
        </div>
      </main>
      {commandPaletteOpen ? (
        <CommandPalette
          open
          onClose={() => setCommandPaletteOpen(false)}
          onOpenProjectPicker={() => {
            setWorkspaceOpen(false);
            setCommandPaletteOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}
