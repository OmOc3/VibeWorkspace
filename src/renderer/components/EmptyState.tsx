import { FolderOpen } from 'lucide-react';
import { useWorkspaceStore } from '../state/workspaceStore';

export function EmptyState(): JSX.Element {
  const chooseProject = useWorkspaceStore((store) => store.chooseProject);
  const loading = useWorkspaceStore((store) => store.loading);

  return (
    <section className="empty-state" aria-labelledby="welcome-title">
      <div className="empty-state__icon" aria-hidden="true">
        <FolderOpen size={30} strokeWidth={1.8} />
      </div>
      <div className="empty-state__copy">
        <h1 id="welcome-title">Vibe Coding Workspace</h1>
        <p>Select a local project folder to start isolated agent sessions for that workspace.</p>
      </div>
      <button className="primary-button" type="button" onClick={() => void chooseProject()} disabled={loading}>
        <FolderOpen size={16} />
        Choose Project Folder
      </button>
    </section>
  );
}

