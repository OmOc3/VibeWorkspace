import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveRestore,
  FolderOpen,
  KeyRound,
  LogIn,
  LogOut,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useWorkspaceStore } from '../state/workspaceStore';

interface CommandPaletteProps {
  onClose: () => void;
  onOpenProjectPicker: () => void;
  open: boolean;
}

interface CommandItem {
  disabled?: boolean;
  icon: LucideIcon;
  id: string;
  label: string;
  meta: string;
  run: () => void;
}

export function CommandPalette({
  onClose,
  onOpenProjectPicker,
  open,
}: CommandPaletteProps): JSX.Element | null {
  const state = useWorkspaceStore((store) => store.state);
  const createTab = useWorkspaceStore((store) => store.createTab);
  const createSubtab = useWorkspaceStore((store) => store.createSubtab);
  const setActiveTab = useWorkspaceStore((store) => store.setActiveTab);
  const selectProject = useWorkspaceStore((store) => store.selectProject);
  const startAuthLogin = useWorkspaceStore((store) => store.startAuthLogin);
  const logoutAuth = useWorkspaceStore((store) => store.logoutAuth);
  const refreshAuthStatus = useWorkspaceStore((store) => store.refreshAuthStatus);
  const refreshProfileUsage = useWorkspaceStore((store) => store.refreshProfileUsage);
  const importDefaultProfile = useWorkspaceStore((store) => store.importDefaultProfile);
  const generateCliWrapper = useWorkspaceStore((store) => store.generateCliWrapper);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTab = state?.tabs.find((tab) => tab.active) ?? state?.tabs[0] ?? null;

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        icon: FolderOpen,
        id: 'switch-project',
        label: 'Switch project',
        meta: 'Workspace',
        run: onOpenProjectPicker,
      },
      {
        disabled: !state?.selectedProject,
        icon: Plus,
        id: 'new-tab',
        label: 'New agent tab',
        meta: 'Tabs',
        run: () => void createTab(),
      },
    ];

    if (activeTab) {
      items.push(
        {
          icon: Terminal,
          id: 'new-codex-terminal',
          label: 'New Codex terminal',
          meta: activeTab.title,
          run: () => void createSubtab(activeTab.id, 'codex'),
        },
        {
          icon: Terminal,
          id: 'new-shell-terminal',
          label: 'New shell terminal',
          meta: activeTab.title,
          run: () => void createSubtab(activeTab.id, 'shell'),
        },
        {
          icon: RefreshCw,
          id: 'refresh-usage',
          label: 'Refresh Codex usage',
          meta: activeTab.sessionProfile.authStatus,
          run: () => void refreshProfileUsage(activeTab.id),
        },
        {
          icon: KeyRound,
          id: 'refresh-auth',
          label: 'Refresh auth status',
          meta: activeTab.sessionProfile.authStatus,
          run: () => void refreshAuthStatus(activeTab.id),
        },
        activeTab.sessionProfile.authStatus === 'connected'
          ? {
              icon: LogOut,
              id: 'logout',
              label: 'Logout active profile',
              meta: activeTab.title,
              run: () => void logoutAuth(activeTab.id),
            }
          : {
              icon: LogIn,
              id: 'login',
              label: 'Login active profile',
              meta: activeTab.title,
              run: () => void startAuthLogin(activeTab.id),
            },
        {
          icon: ArchiveRestore,
          id: 'import-profile',
          label: 'Import default profile',
          meta: activeTab.title,
          run: () => void importDefaultProfile(activeTab.id),
        },
        {
          icon: PackageCheck,
          id: 'generate-wrapper',
          label: 'Generate CLI wrapper',
          meta: activeTab.title,
          run: () => void generateCliWrapper(activeTab.id),
        },
      );
    }

    state?.tabs.forEach((tab, index) => {
      items.push({
        icon: Terminal,
        id: `tab-${tab.id}`,
        label: `Switch to ${tab.title}`,
        meta: `Ctrl+${index + 1}`,
        run: () => void setActiveTab(tab.id),
      });
    });

    state?.projects.forEach((project) => {
      items.push({
        icon: FolderOpen,
        id: `project-${project.id}`,
        label: `Open ${project.name}`,
        meta: project.path,
        run: () => void selectProject(project.id),
      });
    });

    return items;
  }, [
    activeTab,
    createSubtab,
    createTab,
    generateCliWrapper,
    importDefaultProfile,
    logoutAuth,
    onOpenProjectPicker,
    refreshAuthStatus,
    refreshProfileUsage,
    selectProject,
    setActiveTab,
    startAuthLogin,
    state?.projects,
    state?.selectedProject,
    state?.tabs,
  ]);

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return commands;
    }

    return commands.filter((command) => {
      return `${command.label} ${command.meta}`.toLowerCase().includes(normalizedQuery);
    });
  }, [commands, query]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) {
    return null;
  }

  const boundedActiveIndex = Math.min(activeIndex, Math.max(0, filteredCommands.length - 1));
  const activeCommand = filteredCommands[boundedActiveIndex] ?? null;

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="command-palette__backdrop" type="button" aria-label="Close command palette" onClick={onClose} />
      <div
        className="command-palette__panel"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => Math.min(Math.max(0, filteredCommands.length - 1), index + 1));
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(0, index - 1));
          }

          if (event.key === 'Enter' && activeCommand && !activeCommand.disabled) {
            event.preventDefault();
            activeCommand.run();
            onClose();
          }
        }}
      >
        <div className="command-palette__search">
          <Search size={17} />
          <input
            ref={inputRef}
            aria-label="Search commands"
            placeholder="Search commands, tabs, and projects"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
          />
        </div>
        <div className="command-palette__list" role="listbox" aria-label="Commands">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((command, index) => {
              const Icon = command.icon;

              return (
                <button
                  className={
                    index === boundedActiveIndex
                      ? 'command-palette__item command-palette__item--active'
                      : 'command-palette__item'
                  }
                  type="button"
                  role="option"
                  aria-selected={index === boundedActiveIndex}
                  disabled={command.disabled}
                  key={command.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    command.run();
                    onClose();
                  }}
                >
                  <span className="command-palette__item-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="command-palette__item-body">
                    <span>{command.label}</span>
                    <span>{command.meta}</span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="command-palette__empty">No matching commands</div>
          )}
        </div>
      </div>
    </div>
  );
}
