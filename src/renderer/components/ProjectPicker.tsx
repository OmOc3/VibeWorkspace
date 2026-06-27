import { ArrowRight, Clock3, FolderOpen, MessageSquareText, Moon, Plus, Sun, Terminal } from 'lucide-react';
import type { ProjectSummary } from '../../shared/models';
import type { ThemeMode } from '../App';
import { useWorkspaceStore } from '../state/workspaceStore';

interface ProjectPickerProps {
  onEnterWorkspace: () => void;
  onToggleTheme: () => void;
  themeMode: ThemeMode;
}

export function ProjectPicker({ onEnterWorkspace, onToggleTheme, themeMode }: ProjectPickerProps): JSX.Element {
  const state = useWorkspaceStore((store) => store.state);
  const loading = useWorkspaceStore((store) => store.loading);
  const error = useWorkspaceStore((store) => store.error);
  const chooseProject = useWorkspaceStore((store) => store.chooseProject);
  const selectProject = useWorkspaceStore((store) => store.selectProject);
  const projects = state?.projects ?? [];
  const selectedProject = state?.selectedProject ?? null;

  const openFolder = async (): Promise<void> => {
    await chooseProject();
    onEnterWorkspace();
  };

  const openProject = async (project: ProjectSummary): Promise<void> => {
    await selectProject(project.id);
    onEnterWorkspace();
  };

  return (
    <main className="project-gateway" aria-labelledby="project-gateway-title">
      <section className="project-gateway__intro">
        <div className="gateway-topline">
          <div className="gateway-brand" aria-label="Vibe Coding Workspace">
            <div className="brand-mark brand-mark--large">VC</div>
            <div>
              <div className="brand-title">Vibe Coding</div>
              <div className="brand-subtitle">Workspace</div>
            </div>
          </div>

          <button
            className="theme-switch theme-switch--gateway"
            type="button"
            onClick={onToggleTheme}
            aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={themeMode === 'dark'}
          >
            <span className="theme-switch__icon" aria-hidden="true">
              {themeMode === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
            </span>
            <span className="theme-switch__label">{themeMode === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        <div className="gateway-copy">
          <h1 id="project-gateway-title">Choose a project</h1>
          <p>Pick a local folder or return to a saved workspace session.</p>
        </div>

        <div className="gateway-actions">
          {selectedProject ? (
            <button
              className="primary-button primary-button--large"
              type="button"
              onClick={onEnterWorkspace}
              disabled={loading}
            >
              <ArrowRight size={17} />
              Continue {selectedProject.name}
            </button>
          ) : null}
          <button
            className="secondary-button secondary-button--large"
            type="button"
            onClick={() => void openFolder()}
            disabled={loading}
          >
            <FolderOpen size={17} />
            Open Folder
          </button>
        </div>

        {error ? <div className="gateway-error">{error}</div> : null}
      </section>

      <section className="project-gateway__panel" aria-labelledby="recent-projects-title">
        <div className="project-list-header">
          <div>
            <h2 id="recent-projects-title">Recent projects</h2>
            <p>{projects.length === 0 ? 'No saved projects yet' : `${projects.length} saved`}</p>
          </div>
          <button
            className="icon-command icon-command--light"
            type="button"
            onClick={() => void openFolder()}
            disabled={loading}
            aria-label="Open another folder"
          >
            <Plus size={16} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="project-list-empty">
            <FolderOpen size={28} strokeWidth={1.7} />
            <span>Open a folder to create the first workspace.</span>
          </div>
        ) : (
          <div className="project-list" role="list">
            {projects.map((project) => (
              <button
                className={
                  project.id === selectedProject?.id
                    ? 'project-list-item project-list-item--active'
                    : 'project-list-item'
                }
                type="button"
                role="listitem"
                key={project.id}
                onClick={() => void openProject(project)}
              >
                <span className="project-list-item__icon" aria-hidden="true">
                  <FolderOpen size={19} />
                </span>
                <span className="project-list-item__body">
                  <span className="project-list-item__topline">
                    <span className="project-list-item__name">{project.name}</span>
                    <span className="project-list-item__date">
                      <Clock3 size={13} />
                      {formatProjectDate(project.lastOpenedAt)}
                    </span>
                  </span>
                  <span className="project-list-item__path" title={project.path}>
                    {project.path}
                  </span>
                  <span className="project-list-item__meta">
                    <span>
                      <MessageSquareText size={13} />
                      {project.tabCount} sessions
                    </span>
                    <span>
                      <Terminal size={13} />
                      {project.terminalCount} terminals
                    </span>
                    {project.activeTabTitle ? <span>{project.activeTabTitle}</span> : null}
                  </span>
                </span>
                <ArrowRight className="project-list-item__arrow" size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}
