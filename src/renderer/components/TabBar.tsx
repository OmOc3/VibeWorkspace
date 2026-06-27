import { FormEvent, useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { useWorkspaceStore } from '../state/workspaceStore';

export function TabBar(): JSX.Element {
  const state = useWorkspaceStore((store) => store.state);
  const loading = useWorkspaceStore((store) => store.loading);
  const createTab = useWorkspaceStore((store) => store.createTab);
  const closeTab = useWorkspaceStore((store) => store.closeTab);
  const renameTab = useWorkspaceStore((store) => store.renameTab);
  const setActiveTab = useWorkspaceStore((store) => store.setActiveTab);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const tabs = state?.tabs ?? [];
  const selectedProject = state?.selectedProject ?? null;

  const submitRename = (event: FormEvent<HTMLFormElement>, tabId: string): void => {
    event.preventDefault();
    const trimmedTitle = draftTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    void renameTab(tabId, trimmedTitle).then(() => {
      setEditingTabId(null);
      setDraftTitle('');
    });
  };

  return (
    <header className="tab-bar">
      <div className="tab-strip" role="tablist" aria-label="Agent tabs">
        {tabs.length === 0 ? (
          <div className="tab-strip__empty">No agent tabs</div>
        ) : (
          tabs.map((tab) => (
            <div
              className={tab.active ? 'tab tab--active' : 'tab'}
              role="tab"
              aria-selected={tab.active}
              tabIndex={0}
              key={tab.id}
              onClick={() => void setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void setActiveTab(tab.id);
                }
              }}
            >
              {editingTabId === tab.id ? (
                <form
                  className="tab-rename-form"
                  onClick={(event) => event.stopPropagation()}
                  onSubmit={(event) => submitRename(event, tab.id)}
                >
                  <input
                    aria-label="Tab title"
                    value={draftTitle}
                    maxLength={80}
                    autoFocus
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => setEditingTabId(null)}
                  />
                  <button className="icon-button" type="submit" aria-label="Save tab name">
                    <Check size={14} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="tab__title" title={tab.title}>
                    {tab.title}
                  </span>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Rename ${tab.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingTabId(tab.id);
                      setDraftTitle(tab.title);
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Close ${tab.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void closeTab(tab.id);
                    }}
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <button
        className="new-tab-button"
        type="button"
        onClick={() => void createTab()}
        disabled={loading || !selectedProject}
      >
        <Plus size={16} />
        New Agent Tab
      </button>
    </header>
  );
}

