import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type JSX,
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import {
  Activity,
  AlignLeft,
  AlertTriangle,
  ArchiveRestore,
  Bot,
  CheckCircle2,
  CircleDashed,
  ClipboardCopy,
  Copy,
  Database,
  Eraser,
  FileText,
  FolderOpen,
  Gauge,
  Hammer,
  KeyRound,
  LogIn,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  PackageCheck,
  Plus,
  Play,
  RefreshCw,
  RotateCcw,
  SendHorizontal,
  ShieldQuestion,
  Square,
  Terminal as TerminalIcon,
  TextCursorInput,
  UserRound,
  X,
} from 'lucide-react';
import type {
  AgentSubtab,
  AgentTab,
  Project,
  ProjectSummary,
  TerminalViewMode,
  UsageSnapshot,
  UsageWindowSnapshot,
} from '../../shared/models';
import {
  CodexStreamParser,
  formatCodexConversation,
  getActiveCodexActivity,
  type CodexAgentActivity,
  type CodexChatMessage,
  type CodexToolKind,
  type CodexUiSessionState,
  type CodexUiState,
} from '../codex/codexStreamParser';
import { useWorkspaceStore } from '../state/workspaceStore';
import type { WorkspaceView } from '../workspaceViews';

interface TabPlaceholderProps {
  active: boolean;
  activeView: WorkspaceView;
  tab: AgentTab;
  project: Project;
}

type TerminalStatus = 'stopped' | 'starting' | 'running' | 'exited' | 'error';

const TERMINAL_VIEW_MODE_STORAGE_PREFIX = 'vibe-workspace-terminal-view:';
const ESCAPE_CHARACTER = String.fromCharCode(27);
const CONTROL_C_CHARACTER = String.fromCharCode(3);
const CONTROL_D_CHARACTER = String.fromCharCode(4);
const CONTROL_L_CHARACTER = String.fromCharCode(12);

export function TabPlaceholder({ active, activeView, tab, project }: TabPlaceholderProps): JSX.Element {
  const loading = useWorkspaceStore((store) => store.loading);
  const state = useWorkspaceStore((store) => store.state);
  const chooseProject = useWorkspaceStore((store) => store.chooseProject);
  const selectProject = useWorkspaceStore((store) => store.selectProject);
  const createSubtab = useWorkspaceStore((store) => store.createSubtab);
  const closeSubtab = useWorkspaceStore((store) => store.closeSubtab);
  const setActiveSubtab = useWorkspaceStore((store) => store.setActiveSubtab);
  const startAuthLogin = useWorkspaceStore((store) => store.startAuthLogin);
  const logoutAuth = useWorkspaceStore((store) => store.logoutAuth);
  const refreshAuthStatus = useWorkspaceStore((store) => store.refreshAuthStatus);
  const refreshProfileUsage = useWorkspaceStore((store) => store.refreshProfileUsage);
  const importDefaultProfile = useWorkspaceStore((store) => store.importDefaultProfile);
  const generateCliWrapper = useWorkspaceStore((store) => store.generateCliWrapper);
  const authViewRef = useRef<HTMLDivElement | null>(null);
  const [expandedSubtabId, setExpandedSubtabId] = useState<string | null>(null);

  const activeSubtab = tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) ?? null;
  const loginPending = tab.sessionProfile.authStatus === 'login pending';
  const activeExpandedSubtabId = tab.subtabs.some((subtab) => subtab.id === expandedSubtabId)
    ? expandedSubtabId
    : null;
  const terminalTitleId = `agent-terminal-title-${tab.id}`;
  const sessionTitleId = `agent-session-title-${tab.id}`;
  const workspaceLabelledBy =
    activeView === 'terminal' ? terminalTitleId : activeView === 'session' ? sessionTitleId : undefined;

  useEffect(() => {
    const element = authViewRef.current;

    if (!active || activeView !== 'session' || !loginPending || !element) {
      void getWorkspaceApi().hideAuthView({ tabId: tab.id });
      return;
    }

    const updateBounds = (): void => {
      const rect = element.getBoundingClientRect();
      void getWorkspaceApi().setAuthViewBounds({
        tabId: tab.id,
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    };
    const resizeObserver = new ResizeObserver(updateBounds);

    updateBounds();
    resizeObserver.observe(element);
    window.addEventListener('resize', updateBounds);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateBounds);
      void getWorkspaceApi().hideAuthView({ tabId: tab.id });
    };
  }, [active, activeView, loginPending, tab.id]);

  return (
    <section
      className="agent-workspace"
      aria-labelledby={workspaceLabelledBy}
      aria-label={workspaceLabelledBy ? undefined : `${tab.title} workspace`}
      hidden={!active}
    >
      <section className="terminal-workspace" hidden={activeView !== 'terminal'}>
        <TerminalWorkspaceHeader project={project} tab={tab} titleId={terminalTitleId} />

        <div className="subtab-bar">
          <div className="subtab-strip" role="tablist" aria-label="Terminal subtabs">
            {tab.subtabs.length === 0 ? (
              <div className="subtab-strip__empty">No terminal subtabs</div>
            ) : (
              tab.subtabs.map((subtab) => (
                <div
                  className={subtab.active ? 'subtab subtab--active' : 'subtab'}
                  role="tab"
                  aria-selected={subtab.active}
                  tabIndex={0}
                  key={subtab.id}
                  onClick={() => void setActiveSubtab(tab.id, subtab.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void setActiveSubtab(tab.id, subtab.id);
                    }
                  }}
                >
                  <TerminalIcon size={14} />
                  <span title={subtab.title}>{subtab.title}</span>
                  <span className="subtab__preset">{subtab.preset}</span>
                  <button
                    className="icon-button icon-button--subtab"
                    type="button"
                    aria-label={`Close ${subtab.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void closeSubtab(tab.id, subtab.id);
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="subtab-actions">
            <button
              className="secondary-button secondary-button--inline"
              type="button"
              onClick={() => void createSubtab(tab.id, 'codex')}
              disabled={loading}
            >
              <Plus size={15} />
              Codex
            </button>
            <button
              className="secondary-button secondary-button--inline"
              type="button"
              onClick={() => void createSubtab(tab.id, 'shell')}
              disabled={loading}
            >
              <Plus size={15} />
              Shell
            </button>
          </div>
        </div>

        {activeSubtab ? (
          <div className="terminal-stack">
            {tab.subtabs.map((subtab) => (
              <TerminalPane
                hidden={!active || activeView !== 'terminal' || subtab.id !== activeSubtab.id}
                key={subtab.id}
                project={project}
                expanded={activeExpandedSubtabId === subtab.id}
                onToggleExpanded={() =>
                  setExpandedSubtabId((currentSubtabId) =>
                    currentSubtabId === subtab.id ? null : subtab.id,
                  )
                }
                subtab={subtab}
                tab={tab}
              />
            ))}
          </div>
        ) : (
          <div className="terminal-empty">
            <button
              className="primary-button"
              type="button"
              onClick={() => void createSubtab(tab.id, 'codex')}
              disabled={loading}
            >
              <Plus size={15} />
              New Codex Terminal
            </button>
          </div>
        )}
      </section>

      {activeView === 'session' ? (
        <section className="workspace-page workspace-page--session">
          <ProfileHero
            loading={loading}
            loginPending={loginPending}
            onGenerateWrapper={() => void generateCliWrapper(tab.id)}
            onImportDefault={() => void importDefaultProfile(tab.id)}
            onLogin={() => void startAuthLogin(tab.id)}
            onLogout={() => void logoutAuth(tab.id)}
            onRefreshAuth={() => void refreshAuthStatus(tab.id)}
            project={project}
            tab={tab}
            titleId={sessionTitleId}
          />
          {loginPending ? (
            <div className="auth-view-frame" ref={authViewRef} aria-label="Codex login view" />
          ) : null}
        </section>
      ) : null}

      {activeView === 'usage' ? (
        <UsageWorkspacePage
          loading={loading}
          onRefreshUsage={() => void refreshProfileUsage(tab.id)}
          project={project}
          tab={tab}
        />
      ) : null}

      {activeView === 'projects' ? (
        <ProjectsWorkspacePage
          activeProjectId={project.id}
          loading={loading}
          onOpenFolder={() => void chooseProject()}
          onSelectProject={(projectId) => void selectProject(projectId)}
          projects={state?.projects ?? []}
        />
      ) : null}
    </section>
  );
}

function TerminalWorkspaceHeader({
  project,
  tab,
  titleId,
}: {
  project: Project;
  tab: AgentTab;
  titleId: string;
}): JSX.Element {
  const activeSubtab = tab.subtabs.find((subtab) => subtab.id === tab.activeSubtabId) ?? null;

  return (
    <header className="terminal-workspace__header">
      <div className="terminal-workspace__title">
        <p className="eyebrow">terminal workspace</p>
        <h1 id={titleId}>{activeSubtab?.title ?? tab.title}</h1>
        <div className="terminal-workspace__meta" title={project.path}>
          {tab.title} - {project.name} - {tab.subtabs.length} terminals
        </div>
      </div>
      <div className="terminal-workspace__status">
        <span className={`status-chip status-chip--${tab.sessionProfile.authStatus.replace(' ', '-')}`}>
          {tab.sessionProfile.authStatus}
        </span>
      </div>
    </header>
  );
}

function UsageWorkspacePage({
  loading,
  onRefreshUsage,
  project,
  tab,
}: {
  loading: boolean;
  onRefreshUsage: () => void;
  project: Project;
  tab: AgentTab;
}): JSX.Element {
  const profile = tab.sessionProfile;

  return (
    <section className="workspace-page workspace-page--usage" aria-labelledby={`usage-page-title-${tab.id}`}>
      <header className="workspace-page__header">
        <div>
          <p className="eyebrow">session usage</p>
          <h1 id={`usage-page-title-${tab.id}`}>Usage and limits</h1>
          <div className="workspace-page__meta" title={project.path}>
            {tab.title} - {profile.appKind} - {project.name}
          </div>
        </div>
        <span className={`status-chip status-chip--${profile.usageSnapshot.status}`}>
          {formatUsageStatus(profile.usageSnapshot)}
        </span>
      </header>

      <UsagePanel
        disabled={loading || profile.authStatus !== 'connected'}
        onRefresh={onRefreshUsage}
        usage={profile.usageSnapshot}
      />
    </section>
  );
}

function ProjectsWorkspacePage({
  activeProjectId,
  loading,
  onOpenFolder,
  onSelectProject,
  projects,
}: {
  activeProjectId: string;
  loading: boolean;
  onOpenFolder: () => void;
  onSelectProject: (projectId: string) => void;
  projects: ProjectSummary[];
}): JSX.Element {
  return (
    <section className="workspace-page workspace-page--projects" aria-labelledby="workspace-projects-title">
      <header className="workspace-page__header">
        <div>
          <p className="eyebrow">workspace projects</p>
          <h1 id="workspace-projects-title">Projects</h1>
          <div className="workspace-page__meta">
            {projects.length === 0 ? 'No saved projects yet' : `${projects.length} saved projects`}
          </div>
        </div>
        <button className="primary-button" type="button" onClick={onOpenFolder} disabled={loading}>
          <FolderOpen size={15} />
          Open folder
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="terminal-empty terminal-empty--page">
          <button className="primary-button" type="button" onClick={onOpenFolder} disabled={loading}>
            <Plus size={15} />
            Open your first project
          </button>
        </div>
      ) : (
        <div className="workspace-project-grid" role="list">
          {projects.map((project) => (
            <button
              className={
                project.id === activeProjectId
                  ? 'workspace-project-card workspace-project-card--active'
                  : 'workspace-project-card'
              }
              type="button"
              role="listitem"
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              disabled={loading || project.id === activeProjectId}
            >
              <span className="workspace-project-card__icon" aria-hidden="true">
                <FolderOpen size={18} />
              </span>
              <span className="workspace-project-card__body">
                <strong>{project.name}</strong>
                <code title={project.path}>{project.path}</code>
                <span>
                  {project.tabCount} sessions - {project.terminalCount} terminals
                </span>
              </span>
              {project.activeTabTitle ? (
                <span className="workspace-project-card__active">{project.activeTabTitle}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

interface TerminalPaneProps {
  expanded: boolean;
  hidden: boolean;
  onToggleExpanded: () => void;
  project: Project;
  subtab: AgentSubtab;
  tab: AgentTab;
}

function TerminalPane({
  expanded,
  hidden,
  onToggleExpanded,
  project,
  subtab,
  tab,
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const statusRef = useRef<TerminalStatus>('stopped');
  const hiddenRef = useRef(hidden);
  const enhancedOutputRef = useRef<HTMLDivElement | null>(null);
  const enhancedInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const [parser] = useState(() => new CodexStreamParser(subtab.title, subtab.preset));
  const [atBottom, setAtBottom] = useState(true);

  const [status, setStatus] = useState<TerminalStatus>('stopped');
  const [viewMode, setViewMode] = useState<TerminalViewMode>(() =>
    getInitialTerminalViewMode(subtab.id, subtab.preset),
  );
  const [codexUiState, setCodexUiState] = useState<CodexUiState>(() => parser.getState());
  const [draftInput, setDraftInput] = useState('');
  const activeActivity = getActiveCodexActivity(codexUiState);
  const hasApprovalPrompt = Boolean(codexUiState.approvalPrompt);
  const hasInteractiveMenu = Boolean(codexUiState.menuPrompt);

  // Auto-resize textarea as user types
  const autoResizeTextarea = useCallback(() => {
    const el = enhancedInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  const getParser = useCallback((): CodexStreamParser => {
    return parser;
  }, [parser]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  const sendSmartTerminalInput = useCallback(
    (data: string): void => {
      if (statusRef.current !== 'running' || data.length === 0) {
        return;
      }

      getWorkspaceApi().writeTerminal({ subtabId: subtab.id, data });
    },
    [subtab.id],
  );

  const fitAndResize = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (!terminal || !fitAddon || hiddenRef.current) {
      return;
    }

    fitAddon.fit();

    if (statusRef.current === 'running') {
      getWorkspaceApi().resizeTerminal({
        subtabId: subtab.id,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    }
  }, [subtab.id]);

  const setTerminalViewMode = useCallback(
    (nextViewMode: TerminalViewMode): void => {
      setViewMode(nextViewMode);
      saveTerminalViewMode(subtab.id, nextViewMode);

      requestAnimationFrame(() => {
        fitAndResize();

        if (nextViewMode === 'cli') {
          terminalRef.current?.focus();
        } else {
          enhancedInputRef.current?.focus();
        }
      });
    },
    [fitAndResize, subtab.id],
  );

  const startTerminal = useCallback(async () => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;

    if (!terminal || !fitAddon) {
      return;
    }

    fitAddon.fit();
    terminal.clear();
    terminal.writeln(`Starting ${subtab.title} in ${project.name}...`);
    setCodexUiState(getParser().markStarting(subtab.title, project.name));
    setStatus('starting');

    try {
      await getWorkspaceApi().startTerminal({
        tabId: tab.id,
        subtabId: subtab.id,
        cols: terminal.cols,
        rows: terminal.rows,
        viewMode,
      });
      setStatus('running');
      setCodexUiState(getParser().markReady());
      if (viewMode === 'cli') {
        terminal.focus();
      } else {
        enhancedInputRef.current?.focus();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start terminal.';
      setStatus('error');
      terminal.writeln('');
      terminal.writeln(message);
      setCodexUiState(getParser().markError(message));
    }
  }, [getParser, project.name, subtab.id, subtab.title, tab.id, viewMode]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const terminal = new XTerm({
      allowProposedApi: false,
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Mono", "Segoe UI Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 8000,
      theme: {
        background: '#010102',
        foreground: '#f7f8f8',
        cursor: '#828fff',
        selectionBackground: '#23252a',
      },
    });
    const fitAddon = new FitAddon();
    const terminalDataDisposable = terminal.onData((data) => {
      if (statusRef.current === 'running') {
        getWorkspaceApi().writeTerminal({ subtabId: subtab.id, data });
      }
    });
    const unsubscribeData = getWorkspaceApi().onTerminalData((event) => {
      if (event.subtabId === subtab.id) {
        terminal.write(event.data);
        setCodexUiState(getParser().ingest(event.data));
      }
    });
    const unsubscribeExit = getWorkspaceApi().onTerminalExit((event) => {
      if (event.subtabId !== subtab.id) {
        return;
      }

      setStatus('exited');
      terminal.writeln('');
      terminal.writeln(`[process exited: ${event.exitCode ?? 'signal'}]`);
      setCodexUiState(getParser().markExited(event.exitCode));
    });
    const resizeObserver = new ResizeObserver(fitAndResize);

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    // Smart Ctrl+C: copy selection if text is selected; otherwise send SIGINT.
    // This prevents the common accident of killing a process when the user
    // just wanted to copy output from the terminal.
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent): boolean => {
      const isCtrlC = event.ctrlKey && event.key.toLowerCase() === 'c';

      if (!isCtrlC) return true;

      const selection = terminal.getSelection();

      if (selection && selection.length > 0) {
        // Has selected text → copy and suppress the SIGINT
        void navigator.clipboard.writeText(selection).catch(() => undefined);
        terminal.clearSelection();
        return false; // prevent xterm from forwarding the keystroke
      }

      // Nothing selected → pass Ctrl+C through to the running process
      return true;
    });

    terminal.writeln(`${subtab.title} is stopped.`);
    terminal.writeln('Press Start to attach a new isolated process.');
    setCodexUiState(getParser().reset(subtab.title, subtab.preset));
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    resizeObserver.observe(container);
    requestAnimationFrame(fitAndResize);

    return () => {
      terminalDataDisposable.dispose();
      unsubscribeData();
      unsubscribeExit();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fitAndResize, getParser, subtab.id, subtab.preset, subtab.title]);

  useEffect(() => {
    if (hidden || hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    void startTerminal();
  }, [hidden, startTerminal]);

  useEffect(() => {
    requestAnimationFrame(fitAndResize);
  }, [expanded, fitAndResize, hidden]);

  useEffect(() => {
    if (viewMode !== 'enhanced') {
      return;
    }

    const outputElement = enhancedOutputRef.current;

    if (outputElement && atBottom) {
      outputElement.scrollTop = outputElement.scrollHeight;
    }
  }, [codexUiState, viewMode, atBottom]);

  // Track whether the user is at the bottom of the chat viewport
  useEffect(() => {
    if (viewMode !== 'enhanced') return undefined;
    const el = enhancedOutputRef.current;
    if (!el) return undefined;

    const handleScroll = (): void => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distFromBottom < 60);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [viewMode]);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onToggleExpanded();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expanded, onToggleExpanded]);

  const copySelection = (): void => {
    if (viewMode === 'enhanced') {
      const selectedText = window.getSelection()?.toString().trim();
      const textToCopy =
        selectedText && selectedText.length > 0
          ? selectedText
          : formatCodexConversation(codexUiState);

      if (textToCopy.length > 0) {
        void navigator.clipboard.writeText(textToCopy);
      }

      return;
    }

    const selection = terminalRef.current?.getSelection();

    if (selection) {
      void navigator.clipboard.writeText(selection);
    }
  };

  const clearTerminal = (): void => {
    getWorkspaceApi().clearTerminal({ subtabId: subtab.id });
    terminalRef.current?.clear();
    setCodexUiState(getParser().clear(subtab.title, subtab.preset));
  };

  const stopTerminal = (): void => {
    getWorkspaceApi().killTerminal({ subtabId: subtab.id });
    setStatus('stopped');
    terminalRef.current?.writeln('');
    terminalRef.current?.writeln('[process stopped]');
    setCodexUiState(getParser().markStopped());
  };

  const submitSmartInput = useCallback((): void => {
    if (statusRef.current !== 'running') {
      return;
    }

    const prompt = draftInput.trim();

    if (!prompt) {
      sendSmartTerminalInput('\r');
      return;
    }

    setCodexUiState(getParser().appendUserPrompt(prompt));
    sendSmartTerminalInput(`${prompt}\r`);
    setDraftInput('');
    // Reset textarea height
    if (enhancedInputRef.current) {
      enhancedInputRef.current.style.height = 'auto';
    }
  }, [draftInput, getParser, sendSmartTerminalInput]);

  const handleSmartKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
      if (statusRef.current !== 'running' || isComposingRef.current) {
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        // If the textarea has a text selection, let the browser copy it natively.
        const textarea = enhancedInputRef.current;
        const hasSelection =
          textarea !== null &&
          textarea.selectionStart !== null &&
          textarea.selectionEnd !== null &&
          textarea.selectionStart !== textarea.selectionEnd;

        if (hasSelection) {
          // Don't preventDefault — let the browser handle Ctrl+C as a copy
          return;
        }

        // No selection: interrupt the running process (classic Ctrl+C behaviour)
        event.preventDefault();
        sendSmartTerminalInput(CONTROL_C_CHARACTER);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        sendSmartTerminalInput(CONTROL_D_CHARACTER);
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        sendSmartTerminalInput(CONTROL_L_CHARACTER);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitSmartInput();
        return;
      }

      if (event.key === 'Escape' && (hasApprovalPrompt || hasInteractiveMenu)) {
        event.preventDefault();
        sendSmartTerminalInput(ESCAPE_CHARACTER);
      }
    },
    [hasApprovalPrompt, hasInteractiveMenu, sendSmartTerminalInput, submitSmartInput],
  );

  const handleSmartCompositionEnd = useCallback((): void => {
    isComposingRef.current = false;
  }, []);

  const paneClassName = [
    'terminal-pane',
    hidden ? 'terminal-pane--hidden' : '',
    expanded ? 'terminal-pane--expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={paneClassName}>
      <div className="terminal-toolbar">
        <div className="terminal-toolbar__identity">
          <TerminalIcon size={16} />
          <span>{subtab.title}</span>
          <span className={`terminal-status terminal-status--${status}`}>{status}</span>
        </div>
        <div className="terminal-toolbar__actions">
          <div className="terminal-view-toggle" role="group" aria-label="Terminal view mode">
            <button
              className={
                viewMode === 'enhanced'
                  ? 'terminal-view-toggle__button terminal-view-toggle__button--active'
                  : 'terminal-view-toggle__button'
              }
              type="button"
              onClick={() => setTerminalViewMode('enhanced')}
              aria-pressed={viewMode === 'enhanced'}
            >
              <AlignLeft size={14} />
              <span>Codex UI</span>
            </button>
            <button
              className={
                viewMode === 'cli'
                  ? 'terminal-view-toggle__button terminal-view-toggle__button--active'
                  : 'terminal-view-toggle__button'
              }
              type="button"
              onClick={() => setTerminalViewMode('cli')}
              aria-pressed={viewMode === 'cli'}
            >
              <TerminalIcon size={14} />
              <span>CLI</span>
            </button>
          </div>
          {status === 'running' || status === 'starting' ? (
            <button className="icon-command" type="button" onClick={stopTerminal} aria-label="Stop">
              <Square size={15} />
            </button>
          ) : (
            <button
              className="icon-command"
              type="button"
              onClick={() => void startTerminal()}
              aria-label="Start"
            >
              <Play size={15} />
            </button>
          )}
          <button
            className="icon-command"
            type="button"
            onClick={() => void startTerminal()}
            aria-label="Restart"
          >
            <RotateCcw size={15} />
          </button>
          <button className="icon-command" type="button" onClick={clearTerminal} aria-label="Clear">
            <Eraser size={15} />
          </button>
          <button className="icon-command" type="button" onClick={copySelection} aria-label="Copy">
            <Copy size={15} />
          </button>
          <button
            className="icon-command"
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Exit full screen' : 'Maximize terminal'}
          >
            {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>
      <div className="terminal-view">
        <div
          className={
            viewMode === 'cli'
              ? 'terminal-surface'
              : 'terminal-surface terminal-surface--background'
          }
          ref={containerRef}
          aria-hidden={viewMode !== 'cli'}
        />
        {viewMode === 'enhanced' ? (
          <div className="codex-chat">
            <div className="codex-chat__header">
              <div className="codex-chat__identity">
                <span className="codex-chat__mark" aria-hidden="true">
                  <Bot size={17} />
                </span>
                <div>
                  <div className="codex-chat__title">Codex</div>
                  <div className="codex-chat__subtitle" title={project.path}>
                    {subtab.title} in {project.name}
                  </div>
                </div>
              </div>
              <div
                className={`codex-chat__state codex-chat__state--${codexUiState.sessionState}`}
                aria-live="polite"
              >
                {getCodexStateLabel(codexUiState.sessionState, status)}
              </div>
            </div>

            <div
              className="codex-chat__viewport"
              ref={enhancedOutputRef}
              role="log"
              aria-label={`${subtab.title} Codex conversation`}
            >
              {codexUiState.messages.map((message) => (
                <CodexMessageView key={message.id} message={message} />
              ))}
              {activeActivity ? <CodexActivityIndicator activity={activeActivity} /> : null}
              {!atBottom ? (
                <button
                  className="codex-scroll-bottom"
                  type="button"
                  aria-label="Scroll to bottom"
                  onClick={() => {
                    const el = enhancedOutputRef.current;
                    if (el) el.scrollTop = el.scrollHeight;
                  }}
                >
                  ↓
                </button>
              ) : null}
            </div>

            {hasApprovalPrompt || hasInteractiveMenu ? (
              <CodexControlPanel
                state={codexUiState}
                onApprove={() => sendSmartTerminalInput('y\r')}
                onDeny={() => sendSmartTerminalInput('n\r')}
                onEnter={() => sendSmartTerminalInput('\r')}
                onEscape={() => sendSmartTerminalInput(ESCAPE_CHARACTER)}
                onMoveDown={() => sendSmartTerminalInput(`${ESCAPE_CHARACTER}[B`)}
                onMoveUp={() => sendSmartTerminalInput(`${ESCAPE_CHARACTER}[A`)}
              />
            ) : null}

            <form
              className="codex-composer"
              onSubmit={(event) => {
                event.preventDefault();
                submitSmartInput();
              }}
            >
              <TextCursorInput size={16} aria-hidden="true" />
              <textarea
                ref={enhancedInputRef}
                value={draftInput}
                onChange={(event) => {
                  setDraftInput(event.currentTarget.value);
                  autoResizeTextarea();
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={handleSmartCompositionEnd}
                onKeyDown={handleSmartKeyDown}
                disabled={status !== 'running'}
                dir="auto"
                rows={2}
                placeholder={
                  status === 'running'
                    ? 'Message Codex. Shift+Enter adds a line.'
                    : 'Start Codex to begin'
                }
                aria-label="Message Codex"
              />
              <button
                className="codex-composer__send"
                type="submit"
                disabled={status !== 'running' || draftInput.trim().length === 0}
                aria-label="Send message"
              >
                <SendHorizontal size={16} />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface CodexMessageViewProps {
  message: CodexChatMessage;
}

function CodexMessageView({ message }: CodexMessageViewProps): JSX.Element {
  const isToolMessage = message.role === 'tool';

  return (
    <article className={`codex-chat-message codex-chat-message--${message.role}`} dir="auto">
      <div className="codex-chat-message__avatar" aria-hidden="true">
        {getCodexMessageIcon(message)}
      </div>
      <div className="codex-chat-message__body">
        <div className="codex-chat-message__meta">
          <span>{message.title ?? getCodexMessageLabel(message)}</span>
          <time dateTime={new Date(message.createdAt).toISOString()}>
            {formatClockTime(message.createdAt)}
          </time>
        </div>
        {isToolMessage ? (
          <CodexToolCard message={message} />
        ) : message.markdown ? (
          <div className="codex-chat-message__content codex-chat-message__content--markdown">
            <SimpleMarkdown content={message.content} />
          </div>
        ) : (
          <div className="codex-chat-message__content">{message.content}</div>
        )}
      </div>
    </article>
  );
}

function CodexToolCard({ message }: CodexMessageViewProps): JSX.Element {
  const lines = message.content.split('\n');
  const firstLine = lines.find((line) => line.trim().length > 0) ?? '';
  const hasDetails = lines.length > 1 || message.content.length > 120;
  const isDiff = message.toolKind === 'diff';

  return (
    <details className={`codex-tool-card codex-tool-card--${message.toolKind ?? 'log'}`} open={!hasDetails}>
      <summary>
        <span className="codex-tool-card__icon" aria-hidden="true">
          {getCodexToolIcon(message.toolKind)}
        </span>
        <span className="codex-tool-card__summary">
          <span>{message.title ?? getCodexToolLabel(message.toolKind)}</span>
          <strong>{firstLine}</strong>
        </span>
      </summary>
      {isDiff ? (
        <div className="codex-tool-card__diff">
          {lines.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') && !line.startsWith('+++')
                  ? 'codex-diff-line codex-diff-line--add'
                  : line.startsWith('-') && !line.startsWith('---')
                    ? 'codex-diff-line codex-diff-line--del'
                    : line.startsWith('@@')
                      ? 'codex-diff-line codex-diff-line--hunk'
                      : 'codex-diff-line'
              }
            >
              {line || '\u00a0'}
            </div>
          ))}
        </div>
      ) : (
        <pre>{message.content}</pre>
      )}
    </details>
  );
}

function CodexActivityIndicator({ activity }: { activity: CodexAgentActivity }): JSX.Element {
  return (
    <div className={`codex-thinking codex-thinking--${activity.kind}`} role="status" aria-live="polite">
      <span className="codex-thinking__pulse" aria-hidden="true">
        <CircleDashed size={16} />
      </span>
      <span>{activity.label}</span>
      {activity.detail ? <code>{activity.detail}</code> : null}
    </div>
  );
}

interface CodexControlPanelProps {
  state: CodexUiState;
  onApprove: () => void;
  onDeny: () => void;
  onEnter: () => void;
  onEscape: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
}

function CodexControlPanel({
  state,
  onApprove,
  onDeny,
  onEnter,
  onEscape,
  onMoveDown,
  onMoveUp,
}: CodexControlPanelProps): JSX.Element {
  return (
    <div className="codex-action-panel">
      {state.approvalPrompt ? (
        <div className="codex-action-panel__copy">
          <ShieldQuestion size={16} aria-hidden="true" />
          <div>
            <strong>Approval needed</strong>
            <span>{state.approvalPrompt.body}</span>
            {state.approvalPrompt.command ? <code>{state.approvalPrompt.command}</code> : null}
          </div>
        </div>
      ) : state.menuPrompt ? (
        <div className="codex-action-panel__copy">
          <MessageSquare size={16} aria-hidden="true" />
          <div>
            <strong>Interactive choice</strong>
            <span>{state.menuPrompt.body}</span>
          </div>
        </div>
      ) : null}
      <div className="codex-action-panel__buttons">
        {state.approvalPrompt ? (
          <>
            <button type="button" onClick={onApprove}>
              Approve
            </button>
            <button className="codex-action-panel__button--danger" type="button" onClick={onDeny}>
              Deny
            </button>
          </>
        ) : null}
        {state.menuPrompt ? (
          <>
            <button type="button" onClick={onMoveUp}>
              Up
            </button>
            <button type="button" onClick={onMoveDown}>
              Down
            </button>
          </>
        ) : null}
        <button type="button" onClick={onEnter}>
          Enter
        </button>
        <button type="button" onClick={onEscape}>
          Esc
        </button>
      </div>
    </div>
  );
}

function getCodexMessageIcon(message: CodexChatMessage): JSX.Element {
  switch (message.role) {
    case 'user':
      return <UserRound size={16} />;
    case 'tool':
      return getCodexToolIcon(message.toolKind);
    case 'approval':
      return <ShieldQuestion size={16} />;
    case 'error':
      return <AlertTriangle size={16} />;
    case 'system':
      return <CheckCircle2 size={16} />;
    case 'assistant':
    default:
      return <Bot size={16} />;
  }
}

function getCodexToolIcon(toolKind: CodexToolKind | undefined): JSX.Element {
  switch (toolKind) {
    case 'command':
      return <TerminalIcon size={15} />;
    case 'diff':
      return <Hammer size={15} />;
    case 'file':
      return <FileText size={15} />;
    case 'status':
      return <CheckCircle2 size={15} />;
    case 'log':
    default:
      return <Activity size={15} />;
  }
}

function getCodexMessageLabel(message: CodexChatMessage): string {
  switch (message.role) {
    case 'user':
      return 'You';
    case 'tool':
      return getCodexToolLabel(message.toolKind);
    case 'approval':
      return 'Approval';
    case 'error':
      return 'Error';
    case 'system':
      return 'Session';
    case 'assistant':
    default:
      return 'Codex';
  }
}

function getCodexToolLabel(toolKind: CodexToolKind | undefined): string {
  switch (toolKind) {
    case 'command':
      return 'Command';
    case 'diff':
      return 'Code change';
    case 'file':
      return 'File';
    case 'status':
      return 'Status';
    case 'log':
    default:
      return 'Tool';
  }
}

function getCodexStateLabel(
  sessionState: CodexUiSessionState,
  terminalStatus: TerminalStatus,
): string {
  if (terminalStatus === 'starting') {
    return 'Starting';
  }

  if (terminalStatus === 'stopped') {
    return 'Stopped';
  }

  if (terminalStatus === 'exited') {
    return 'Exited';
  }

  if (terminalStatus === 'error' || sessionState === 'error') {
    return 'Error';
  }

  switch (sessionState) {
    case 'thinking':
      return 'Thinking';
    case 'responding':
      return 'Responding';
    case 'waiting-approval':
      return 'Needs approval';
    case 'waiting-input':
      return 'Ready';
    case 'starting':
      return 'Starting';
    case 'exited':
      return 'Exited';
    case 'stopped':
      return 'Stopped';
    case 'idle':
    default:
      return 'Idle';
  }
}

function formatClockTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function getWorkspaceApi() {
  if (!window.vibeWorkspace) {
    throw new Error('Workspace bridge is unavailable. Restart the app after rebuilding.');
  }

  return window.vibeWorkspace;
}

// ─── SimpleMarkdown ──────────────────────────────────────────────────────────

function SimpleMarkdown({ content }: { content: string }): JSX.Element {
  const segments = splitCodeBlocks(content);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'code') {
          return (
            <pre key={i} className="codex-md-codeblock">
              {seg.lang ? <span className="codex-md-lang">{seg.lang}</span> : null}
              <code>{seg.text}</code>
            </pre>
          );
        }

        // Split into paragraphs at blank lines
        const paras = seg.text.split(/\n{2,}/);

        return paras.map((para, pi) => {
          const trimmed = para.trim();
          if (!trimmed) return null;

          // Heading
          const headingMatch = trimmed.match(/^(#{1,3}) (.+)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const text = headingMatch[2];
            const Tag = (`h${level + 2}`) as 'h3' | 'h4' | 'h5';
            return (
              <Tag key={`${i}-${pi}`} className="codex-md-heading">
                {renderInline(text)}
              </Tag>
            );
          }

          // List items
          const listLines = trimmed.split('\n').filter((l) => /^[-*] /.test(l.trim()));
          if (listLines.length > 0 && listLines.length === trimmed.split('\n').filter(Boolean).length) {
            return (
              <ul key={`${i}-${pi}`} className="codex-md-list">
                {listLines.map((l, li) => (
                  <li key={li}>{renderInline(l.replace(/^[-*] /, ''))}</li>
                ))}
              </ul>
            );
          }

          return (
            <p key={`${i}-${pi}`} className="codex-md-para">
              {renderInline(trimmed.replace(/\n/g, ' '))}
            </p>
          );
        });
      })}
    </>
  );
}

type Segment =
  | { type: 'text'; text: string }
  | { type: 'code'; lang: string; text: string };

function splitCodeBlocks(content: string): Segment[] {
  const result: Segment[] = [];
  const fenceRe = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    result.push({ type: 'code', lang: match[1], text: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return result.length > 0 ? result : [{ type: 'text', text: content }];
}

function renderInline(text: string): (string | JSX.Element)[] {
  // Handle **bold**, *italic*, `code`
  const tokenRe = /(`[^`]+`)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));

    if (m[1]) {
      // inline code
      parts.push(<code key={key++} className="codex-md-code">{m[1].slice(1, -1)}</code>);
    } else if (m[2]) {
      // bold
      parts.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3]) {
      // italic
      parts.push(<em key={key++}>{m[3]}</em>);
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));

  return parts;
}

interface ProfileHeroProps {
  loading: boolean;
  loginPending: boolean;
  onGenerateWrapper: () => void;
  onImportDefault: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onRefreshAuth: () => void;
  project: Project;
  tab: AgentTab;
  titleId: string;
}

function ProfileHero({
  loading,
  loginPending,
  onGenerateWrapper,
  onImportDefault,
  onLogin,
  onLogout,
  onRefreshAuth,
  project,
  tab,
  titleId,
}: ProfileHeroProps): JSX.Element {
  const profile = tab.sessionProfile;

  return (
    <div className="profile-detail">
      <header className="profile-hero">
        <div className="profile-hero__identity">
          <div className="profile-avatar" aria-hidden="true">
            {tab.title.slice(0, 2).toUpperCase()}
          </div>
          <div className="profile-hero__copy">
            <p className="eyebrow">isolated {profile.appKind} profile</p>
            <h1 id={titleId}>{tab.title}</h1>
            <div className="profile-hero__meta" title={project.path}>
              {profile.appKind} - {project.name} - {formatRelativeTime(profile.updatedAt)}
            </div>
          </div>
        </div>

        <div className="auth-controls auth-controls--profile">
          <div className={`status-chip status-chip--${profile.authStatus.replace(' ', '-')}`}>
            {profile.authStatus}
          </div>
          <button
            className="secondary-button secondary-button--inline"
            type="button"
            onClick={onRefreshAuth}
            disabled={loading}
          >
            <RefreshCw size={15} />
            Auth
          </button>
          {profile.authStatus === 'connected' ? (
            <button
              className="secondary-button secondary-button--inline"
              type="button"
              onClick={onLogout}
              disabled={loading}
            >
              <LogOut size={15} />
              Logout
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={onLogin}
              disabled={loading || loginPending}
            >
              <LogIn size={15} />
              Login
            </button>
          )}
        </div>
      </header>

      <ProfileActionGrid
        disabled={loading}
        onGenerateWrapper={onGenerateWrapper}
        onImportDefault={onImportDefault}
        profile={profile}
      />
    </div>
  );
}

interface UsagePanelProps {
  disabled: boolean;
  onRefresh: () => void;
  usage: UsageSnapshot;
}

function UsagePanel({ disabled, onRefresh, usage }: UsagePanelProps): JSX.Element {
  const windows = [usage.fiveHour, usage.weekly, usage.monthly];

  return (
    <section className="usage-panel" aria-labelledby="usage-panel-title">
      <div className="usage-panel__header">
        <div>
          <div className="usage-panel__label" id="usage-panel-title">
            Usage
          </div>
          <div className={`usage-panel__status usage-panel__status--${usage.status}`}>
            {formatUsageStatus(usage)}
          </div>
        </div>
        <button
          className="usage-panel__refresh"
          type="button"
          onClick={onRefresh}
          disabled={disabled || usage.status === 'refreshing'}
          aria-label="Refresh Codex usage"
        >
          <span>{usage.nextRefreshAt ? `refresh ${formatRelativeTime(usage.nextRefreshAt)}` : 'refresh'}</span>
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="usage-panel__meters">
        {windows.map((usageWindow) => (
          <UsageMeter key={usageWindow.label} window={usageWindow} />
        ))}
      </div>

      {usage.error ? <div className="usage-panel__error">{usage.error}</div> : null}
    </section>
  );
}

function UsageMeter({ window }: { window: UsageWindowSnapshot }): JSX.Element {
  const percent = window.percent ?? 0;

  return (
    <div className="usage-meter">
      <div className="usage-meter__label">
        <span>{window.label}</span>
        <span>{window.percent === null ? 'waiting' : `${formatPercent(window.percent)}%`}</span>
      </div>
      <div className="usage-meter__track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="usage-meter__reset">{window.resetText ?? 'Refresh usage to read reset time'}</div>
    </div>
  );
}

interface ProfileActionGridProps {
  disabled: boolean;
  onGenerateWrapper: () => void;
  onImportDefault: () => void;
  profile: AgentTab['sessionProfile'];
}

function ProfileActionGrid({
  disabled,
  onGenerateWrapper,
  onImportDefault,
  profile,
}: ProfileActionGridProps): JSX.Element {
  return (
    <section className="profile-action-grid" aria-label="Profile tools">
      <article className="profile-tool-card">
        <div className="profile-tool-card__icon" aria-hidden="true">
          <Database size={18} />
        </div>
        <div className="profile-tool-card__body">
          <h2>Profile data</h2>
          <p>Copy the default {profile.appKind} profile into this isolated tab with backup rollback.</p>
          <div className="profile-tool-card__status">
            <span className="profile-tool-card__dot" />
            {profile.lastImportedAt ? `Imported ${formatRelativeTime(profile.lastImportedAt)}` : 'No import yet'}
          </div>
        </div>
        <button className="primary-button" type="button" onClick={onImportDefault} disabled={disabled}>
          <ArchiveRestore size={15} />
          Import profile
        </button>
      </article>

      <article className="profile-tool-card">
        <div className="profile-tool-card__icon" aria-hidden="true">
          <TerminalIcon size={18} />
        </div>
        <div className="profile-tool-card__body">
          <h2>{profile.appKind} CLI</h2>
          <p>Generate a wrapper that launches this project with the tab&apos;s isolated profile home.</p>
          <div className="profile-tool-card__status" title={profile.cliWrapperPath ?? undefined}>
            <span className="profile-tool-card__dot" />
            {profile.cliWrapperPath ? 'Wrapper ready' : 'No wrapper generated'}
          </div>
        </div>
        <div className="profile-tool-card__actions">
          <button
            className="primary-button"
            type="button"
            onClick={onGenerateWrapper}
            disabled={disabled}
          >
            <PackageCheck size={15} />
            Wrapper
          </button>
          <button
            className="secondary-button secondary-button--inline"
            type="button"
            onClick={() => void copyText(profile.cliWrapperPath)}
            disabled={!profile.cliWrapperPath}
          >
            <ClipboardCopy size={15} />
            Copy
          </button>
        </div>
      </article>

      <article className="profile-activity">
        <div className="profile-activity__heading">
          <Activity size={16} />
          <span>Recent activity</span>
        </div>
        {profile.recentActivity.length > 0 ? (
          profile.recentActivity.slice(0, 5).map((activity) => {
            const Icon = getActivityIcon(activity.kind);

            return (
              <div className="profile-activity__row" key={activity.id}>
                <Icon size={14} />
                <span>{activity.label}</span>
                <time dateTime={activity.createdAt}>{formatRelativeTime(activity.createdAt)}</time>
              </div>
            );
          })
        ) : (
          <div className="profile-activity__row">
            <Gauge size={14} />
            <span>{formatUsageStatus(profile.usageSnapshot)}</span>
          </div>
        )}
      </article>
    </section>
  );
}

function formatUsageStatus(usage: UsageSnapshot): string {
  if (usage.status === 'refreshing') {
    return 'reading Codex app-server';
  }

  if (usage.status === 'available' && usage.updatedAt) {
    return `updated ${formatRelativeTime(usage.updatedAt)}`;
  }

  if (usage.status === 'error') {
    return 'status unavailable';
  }

  return 'waiting for first status';
}

function getActivityIcon(kind: AgentTab['sessionProfile']['recentActivity'][number]['kind']) {
  switch (kind) {
    case 'auth':
      return KeyRound;
    case 'import':
      return ArchiveRestore;
    case 'terminal':
      return TerminalIcon;
    case 'usage':
      return Gauge;
    case 'wrapper':
      return PackageCheck;
    case 'created':
    case 'session':
    default:
      return Activity;
  }
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return 'just now';
  }

  const deltaMs = timestamp - Date.now();
  const absMs = Math.abs(deltaMs);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      return formatter.format(Math.round(deltaMs / unitMs), unit);
    }
  }

  return formatter.format(0, 'minute');
}

function copyText(value: string | null): Promise<void> {
  if (!value) {
    return Promise.resolve();
  }

  return navigator.clipboard.writeText(value).catch(() => undefined);
}

function getInitialTerminalViewMode(
  subtabId: string,
  preset: AgentSubtab['preset'],
): TerminalViewMode {
  try {
    const savedViewMode = window.localStorage.getItem(
      `${TERMINAL_VIEW_MODE_STORAGE_PREFIX}${subtabId}`,
    );

    if (savedViewMode === 'enhanced' || savedViewMode === 'cli') {
      return savedViewMode;
    }
  } catch {
    // Storage can be unavailable in hardened desktop contexts.
  }

  return preset === 'shell' ? 'cli' : 'enhanced';
}

function saveTerminalViewMode(subtabId: string, viewMode: TerminalViewMode): void {
  try {
    window.localStorage.setItem(`${TERMINAL_VIEW_MODE_STORAGE_PREFIX}${subtabId}`, viewMode);
  } catch {
    // Storage can be unavailable in hardened desktop contexts.
  }
}
