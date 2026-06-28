import type { AgentSubtab } from '../../shared/models';

export type CodexChatRole = 'assistant' | 'approval' | 'error' | 'system' | 'tool' | 'user';
export type CodexToolKind = 'command' | 'diff' | 'file' | 'log' | 'status';

export type CodexActivityKind =
  | 'completed'
  | 'editing-file'
  | 'error'
  | 'idle'
  | 'reading-file'
  | 'running-command'
  | 'thinking'
  | 'waiting-approval';
export type CodexUiSessionState =
  | 'error'
  | 'exited'
  | 'idle'
  | 'responding'
  | 'starting'
  | 'stopped'
  | 'thinking'
  | 'waiting-approval'
  | 'waiting-input';

export interface CodexChatMessage {
  id: string;
  role: CodexChatRole;
  content: string;
  createdAt: number;
  title?: string;
  toolKind?: CodexToolKind;
  detail?: string;
  /** When true the UI should render the content as simple markdown. */
  markdown?: boolean;
}

export interface CodexAgentActivity {
  id: string;
  kind: CodexActivityKind;
  label: string;
  createdAt: number;
  active: boolean;
  detail?: string;
}

export interface CodexApprovalPrompt {
  id: string;
  body: string;
  command?: string;
}

export interface CodexMenuPrompt {
  id: string;
  body: string;
}

export interface CodexUiState {
  messages: CodexChatMessage[];
  activities: CodexAgentActivity[];
  sessionState: CodexUiSessionState;
  approvalPrompt: CodexApprovalPrompt | null;
  menuPrompt: CodexMenuPrompt | null;
}

const MAX_MESSAGES = 220;
const MAX_ACTIVITIES = 12;
const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /(?:\x1B\][^\x07]*(?:\x07|\x1B\\)|\x1B[@-Z\\-_]|\x1B\[[0-?]*[ -/]*[@-~]|\x9B[0-?]*[ -/]*[@-~])/g;
// eslint-disable-next-line no-control-regex
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/g;
// Explicit shell prompt: must start with $ or ❯ followed by whitespace then a command
const SHELL_PROMPT_PATTERN = /^(?:\$|\u276f)\s+\S/;
const BOX_DRAWING_PATTERN = /[\u2500-\u259f]/g;
const SOURCE_FILE_PATTERN =
  /(?:^|\s|[/\\])[\w.-]+\.(?:cjs|css|html|js|jsx|json|md|mjs|py|ts|tsx|yaml|yml)(?=$|\s|:)/i;

export class CodexStreamParser {
  private pendingLine = '';
  private sequence = 0;
  private state: CodexUiState;
  // Code-block accumulation
  private inCodeBlock = false;
  private codeBlockLang = '';
  private codeBlockLines: string[] = [];

  constructor(title: string, preset: AgentSubtab['preset']) {
    this.state = createInitialCodexUiState(title, preset);
  }

  getState(): CodexUiState {
    return cloneState(this.state);
  }

  reset(title: string, preset: AgentSubtab['preset']): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = createInitialCodexUiState(title, preset);
    return this.getState();
  }

  clear(title: string, preset: AgentSubtab['preset']): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = createInitialCodexUiState(title, preset, 'Conversation cleared.');
    return this.getState();
  }

  markStarting(title: string, projectName: string): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = {
      messages: [
        this.createMessage('system', `Starting ${title} in ${projectName}.`, {
          title: 'Session',
          toolKind: 'status',
        }),
      ],
      activities: [
        this.createActivity('thinking', 'Starting Codex session', true, projectName),
      ],
      sessionState: 'starting',
      approvalPrompt: null,
      menuPrompt: null,
    };
    return this.getState();
  }

  markReady(): CodexUiState {
    this.state = {
      ...this.state,
      sessionState: 'waiting-input',
      activities: completeActiveActivities(this.state.activities),
    };
    return this.getState();
  }

  markStopped(): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = {
      messages: [
        ...this.state.messages,
        this.createMessage('system', 'Codex stopped.', { title: 'Session', toolKind: 'status' }),
      ].slice(-MAX_MESSAGES),
      activities: completeActiveActivities(this.state.activities),
      sessionState: 'stopped',
      approvalPrompt: null,
      menuPrompt: null,
    };
    return this.getState();
  }

  markExited(exitCode: number | null): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = {
      messages: [
        ...this.state.messages,
        this.createMessage(
          exitCode === 0 ? 'system' : 'error',
          exitCode === 0 ? 'Codex session ended.' : `Codex exited with code ${exitCode ?? 'signal'}.`,
          { title: 'Session', toolKind: 'status' },
        ),
      ].slice(-MAX_MESSAGES),
      activities: completeActiveActivities(this.state.activities),
      sessionState: 'exited',
      approvalPrompt: null,
      menuPrompt: null,
    };
    return this.getState();
  }

  markError(message: string): CodexUiState {
    this.pendingLine = '';
    this.flushCodeBlock();
    this.state = {
      messages: [
        ...this.state.messages,
        this.createMessage('error', message, { title: 'Error' }),
      ].slice(-MAX_MESSAGES),
      activities: [
        this.createActivity('error', 'Codex reported an error', false, message),
        ...completeActiveActivities(this.state.activities),
      ].slice(0, MAX_ACTIVITIES),
      sessionState: 'error',
      approvalPrompt: null,
      menuPrompt: null,
    };
    return this.getState();
  }

  appendUserPrompt(content: string): CodexUiState {
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return this.getState();
    }

    this.state = {
      ...this.state,
      messages: [
        ...this.state.messages,
        this.createMessage('user', trimmedContent),
      ].slice(-MAX_MESSAGES),
      activities: [
        this.createActivity('thinking', 'Thinking...', true),
        ...completeActiveActivities(this.state.activities),
      ].slice(0, MAX_ACTIVITIES),
      sessionState: 'thinking',
      approvalPrompt: null,
      menuPrompt: null,
    };

    return this.getState();
  }

  ingest(chunk: string): CodexUiState {
    const cleanChunk = normalizeChunk(chunk);
    const parts = `${this.pendingLine}${cleanChunk}`.split('\n');
    this.pendingLine = parts.pop() ?? '';

    for (const rawLine of parts) {
      this.consumeLine(rawLine);
    }

    const inlineLine = cleanCodexLine(this.pendingLine);

    if (inlineLine && shouldRenderPartialLine(inlineLine)) {
      this.consumeLine(inlineLine);
      this.pendingLine = '';
    }

    return this.getState();
  }

  private consumeLine(rawLine: string): void {
    const line = cleanCodexLine(rawLine);

    // ── Code-block fence handling ──────────────────────────────────────────
    if (line.startsWith('```')) {
      if (this.inCodeBlock) {
        this.flushCodeBlock();
      } else {
        this.inCodeBlock = true;
        this.codeBlockLang = line.slice(3).trim();
        this.codeBlockLines = [];
      }
      return;
    }

    if (this.inCodeBlock) {
      this.codeBlockLines.push(rawLine); // keep original indentation inside blocks
      return;
    }

    // ── Normal line processing ─────────────────────────────────────────────
    if (!line || isTerminalNoise(line) || isDuplicateVisibleLine(this.state.messages, line)) {
      return;
    }

    const normalizedLine = line.toLowerCase();

    if (isThinkingLine(normalizedLine)) {
      this.setActiveActivity('thinking', 'Thinking...', line);
      return;
    }

    if (isApprovalLine(normalizedLine)) {
      const approvalPrompt = {
        id: this.nextId('approval'),
        body: summarizeApproval(line),
        command: extractInlineCommand(line),
      };

      this.state = {
        ...this.state,
        messages: [
          ...this.state.messages,
          this.createMessage('approval', approvalPrompt.body, {
            title: 'Approval needed',
            detail: approvalPrompt.command,
          }),
        ].slice(-MAX_MESSAGES),
        activities: [
          this.createActivity('waiting-approval', 'Waiting for approval', true, approvalPrompt.command),
          ...completeActiveActivities(this.state.activities),
        ].slice(0, MAX_ACTIVITIES),
        sessionState: 'waiting-approval',
        approvalPrompt,
        menuPrompt: null,
      };
      return;
    }

    if (isMenuLine(line, normalizedLine)) {
      this.state = {
        ...this.state,
        menuPrompt: {
          id: this.nextId('menu'),
          body: line,
        },
      };
      return;
    }

    if (isUserEcho(line, normalizedLine)) {
      const content = stripSpeakerPrefix(line);

      if (content && !isDuplicateVisibleLine(this.state.messages, content, 'user')) {
        this.addMessage('user', content);
      }

      return;
    }

    if (isCommandLine(line, normalizedLine)) {
      this.addToolMessage('command', 'Command', line);
      this.setActiveActivity('running-command', 'Running command', line);
      return;
    }

    if (isDiffLine(line, normalizedLine)) {
      this.addToolMessage('diff', 'Code change', line);
      this.setActiveActivity('editing-file', 'Updating files', line);
      return;
    }

    if (isFileReferenceLine(line, normalizedLine)) {
      this.addToolMessage('file', 'File reference', line);
      this.setActiveActivity('reading-file', 'Reading project files', line);
      return;
    }

    if (isErrorLine(normalizedLine)) {
      this.addMessage('error', line, { title: 'Error' });
      this.setActiveActivity('error', 'Codex reported an error', line, false);
      this.state = { ...this.state, sessionState: 'error' };
      return;
    }

    this.addAssistantLine(line);
  }

  private flushCodeBlock(): void {
    if (!this.inCodeBlock || this.codeBlockLines.length === 0) {
      this.inCodeBlock = false;
      this.codeBlockLines = [];
      this.codeBlockLang = '';
      return;
    }
    const content = this.codeBlockLines.join('\n');
    const titleLabel = this.codeBlockLang ? `Code · ${this.codeBlockLang}` : 'Code block';
    this.addToolMessage('file', titleLabel, content);
    this.inCodeBlock = false;
    this.codeBlockLines = [];
    this.codeBlockLang = '';
  }

  private addAssistantLine(line: string): void {
    const messages = completeLastToolMessage(this.state.messages);
    const previous = messages[messages.length - 1];
    const canMerge =
      previous?.role === 'assistant' &&
      previous.content.length + line.length < 2600 &&
      !lineLooksLikeHeading(line);

    const nextMessages = canMerge
      ? [
          ...messages.slice(0, -1),
          {
            ...previous,
            content: `${previous.content}\n${line}`,
            markdown: true,
          },
        ]
      : [...messages, this.createMessage('assistant', line, { markdown: true })];

    this.state = {
      ...this.state,
      messages: nextMessages.slice(-MAX_MESSAGES),
      activities: completeActiveActivities(this.state.activities),
      sessionState: 'responding',
      approvalPrompt: null,
      menuPrompt: null,
    };
  }

  private addToolMessage(toolKind: CodexToolKind, title: string, content: string): void {
    const messages = completeLastAssistantMessage(this.state.messages);
    const previous = messages[messages.length - 1];
    const canMerge =
      previous?.role === 'tool' &&
      previous.toolKind === toolKind &&
      previous.content.length + content.length < 1800;

    const nextMessages = canMerge
      ? [
          ...messages.slice(0, -1),
          {
            ...previous,
            content: `${previous.content}\n${content}`,
          },
        ]
      : [
          ...messages,
          this.createMessage('tool', content, {
            title,
            toolKind,
          }),
        ];

    this.state = {
      ...this.state,
      messages: nextMessages.slice(-MAX_MESSAGES),
      sessionState: this.state.sessionState === 'waiting-approval' ? 'waiting-approval' : 'thinking',
    };
  }

  private addMessage(
    role: CodexChatRole,
    content: string,
    options?: Pick<CodexChatMessage, 'detail' | 'title' | 'toolKind' | 'markdown'>,
  ): void {
    this.state = {
      ...this.state,
      messages: [
        ...this.state.messages,
        this.createMessage(role, content, options),
      ].slice(-MAX_MESSAGES),
    };
  }

  private setActiveActivity(
    kind: CodexActivityKind,
    label: string,
    detail?: string,
    active = true,
  ): void {
    this.state = {
      ...this.state,
      activities: [
        this.createActivity(kind, label, active, detail),
        ...completeActiveActivities(this.state.activities),
      ].slice(0, MAX_ACTIVITIES),
      sessionState:
        kind === 'waiting-approval'
          ? 'waiting-approval'
          : kind === 'error'
            ? 'error'
            : kind === 'thinking' || kind === 'running-command' || kind === 'reading-file'
              ? 'thinking'
              : this.state.sessionState,
    };
  }

  private createMessage(
    role: CodexChatRole,
    content: string,
    options?: Pick<CodexChatMessage, 'detail' | 'title' | 'toolKind' | 'markdown'>,
  ): CodexChatMessage {
    return {
      id: this.nextId(role),
      role,
      content,
      createdAt: Date.now(),
      ...options,
    };
  }

  private createActivity(
    kind: CodexActivityKind,
    label: string,
    active: boolean,
    detail?: string,
  ): CodexAgentActivity {
    return {
      id: this.nextId(kind),
      kind,
      label,
      createdAt: Date.now(),
      active,
      detail,
    };
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.sequence.toString(36)}`;
  }
}

export function createInitialCodexUiState(
  title: string,
  preset: AgentSubtab['preset'],
  overrideMessage?: string,
): CodexUiState {
  const message =
    overrideMessage ??
    (preset === 'codex'
      ? `${title} is stopped. Start Codex to use the chat UI.`
      : `${title} is stopped. Shell tabs open in CLI mode by default.`);

  return {
    messages: [
      {
        id: `system-${hashText(message)}`,
        role: 'system',
        title: 'Session',
        toolKind: 'status',
        content: message,
        createdAt: Date.now(),
      },
    ],
    activities: [],
    sessionState: 'stopped',
    approvalPrompt: null,
    menuPrompt: null,
  };
}

export function formatCodexConversation(state: CodexUiState): string {
  return state.messages
    .map((message) => {
      const label = message.title ?? getRoleLabel(message.role);
      return `${label}: ${message.content}`;
    })
    .join('\n\n');
}

export function getActiveCodexActivity(state: CodexUiState): CodexAgentActivity | null {
  return state.activities.find((activity) => activity.active) ?? null;
}

function normalizeChunk(chunk: string): string {
  return chunk
    .replace(ANSI_PATTERN, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL_PATTERN, '');
}

function cleanCodexLine(line: string): string {
  return line
    .replace(BOX_DRAWING_PATTERN, ' ')
    .replace(/[╭╮╰╯│─┌┐└┘├┤┬┴┼━┃┏┓┗┛]/g, ' ')
    .replace(/\s+$/g, '')
    .trimStart();
}

function isTerminalNoise(line: string): boolean {
  const normalizedLine = line.toLowerCase().trim();

  if (normalizedLine.length === 0) {
    return true;
  }

  if (/^[>\-_\s|:]+$/.test(normalizedLine)) {
    return true;
  }

  return [
    'press start to attach',
    'use arrows',
    'press enter',
    'ctrl+c',
    'ctrl+d',
    'esc',
    'loading secure login',
    'type to codex',
    'start codex first',
  ].some((noise) => normalizedLine === noise || normalizedLine.includes(noise));
}

function shouldRenderPartialLine(line: string): boolean {
  const normalizedLine = line.toLowerCase();
  return isThinkingLine(normalizedLine) || isApprovalLine(normalizedLine);
}

function isThinkingLine(normalizedLine: string): boolean {
  return (
    // Spinner text with trailing dots — e.g. "Thinking..."
    /^(?:thinking|reasoning|working|planning|analyzing)\.{2,}$/.test(normalizedLine) ||
    // Bracketed TUI indicator — e.g. "[Thinking]"
    /^\[(?:thinking|reasoning|working)\]/.test(normalizedLine) ||
    // Braille-spinner characters at line start (common in TUI tools)
    /^[\u280b\u2819\u2839\u2838\u283c\u2834\u2826\u2827\u2807\u280f]/.test(normalizedLine) ||
    normalizedLine === 'thinking...' ||
    normalizedLine === 'thinking'
  );
}

function isApprovalLine(normalizedLine: string): boolean {
  return (
    normalizedLine.includes('[y/n]') ||
    normalizedLine.includes('(y/n)') ||
    normalizedLine.includes('[yes/no]') ||
    normalizedLine.includes('(yes/no)') ||
    /allow codex to/.test(normalizedLine) ||
    /run this command\?/.test(normalizedLine)
  );
}

function isMenuLine(line: string, normalizedLine: string): boolean {
  // Require unambiguous menu patterns: "› [option]" style or numbered list
  return (
    /^[>›]\s+\[/.test(line) ||
    /^\(\d+\)/.test(line) ||
    (normalizedLine.startsWith('select ') && /\d/.test(normalizedLine)) ||
    (normalizedLine.startsWith('choose ') && /\(\d+\)/.test(normalizedLine))
  );
}

function isUserEcho(line: string, normalizedLine: string): boolean {
  return (
    normalizedLine.startsWith('you:') ||
    normalizedLine.startsWith('user:') ||
    normalizedLine.startsWith('prompt:')
  );
}

function stripSpeakerPrefix(line: string): string {
  return line.replace(/^(?:you|user|prompt):\s*/i, '').trim();
}

function isCommandLine(line: string, normalizedLine: string): boolean {
  return (
    // Must start with an explicit shell prompt marker
    SHELL_PROMPT_PATTERN.test(line) ||
    normalizedLine.startsWith('running command:') ||
    normalizedLine.startsWith('executing:') ||
    normalizedLine.startsWith('running:') ||
    /^exit code\s+\d/.test(normalizedLine)
  );
}

function isDiffLine(line: string, normalizedLine: string): boolean {
  // Unified diff markers
  if (line.startsWith('@@') || /^---\s/.test(line) || /^\+\+\+\s/.test(line)) return true;
  // Git diff header
  if (/^diff --git\s/.test(normalizedLine)) return true;
  // Explicit file-operation labels with a real file path
  if (
    /^(?:modified|created|deleted) file:\s/.test(normalizedLine) ||
    (/^(?:modified|created|deleted) /.test(normalizedLine) && SOURCE_FILE_PATTERN.test(line))
  ) {
    return true;
  }
  return false;
}

/** A file-reference line: mentions a source file path but is NOT a diff or command. */
function isFileReferenceLine(line: string, normalizedLine: string): boolean {
  return (
    SOURCE_FILE_PATTERN.test(line) &&
    !isCommandLine(line, normalizedLine) &&
    !isDiffLine(line, normalizedLine)
  );
}

function isErrorLine(normalizedLine: string): boolean {
  return (
    /^error:\s/.test(normalizedLine) ||
    /^fatal:\s/.test(normalizedLine) ||
    /^exception:\s/.test(normalizedLine) ||
    normalizedLine.startsWith('uncaught ') ||
    normalizedLine.startsWith('unhandled ')
  );
}

function lineLooksLikeHeading(line: string): boolean {
  return /^[A-Z][\w\s-]{2,}:$/.test(line) || /^#{1,3}\s/.test(line);
}

function summarizeApproval(line: string): string {
  if (line.length <= 220) {
    return line;
  }

  return `${line.slice(0, 217).trim()}...`;
}

function extractInlineCommand(line: string): string | undefined {
  const quoted = line.match(/[`"']([^`"']{3,})[`"']/);
  if (quoted) return quoted[1];
  if (SHELL_PROMPT_PATTERN.test(line)) return line.replace(/^.*?\$\s+/, '').trim();
  return undefined;
}

function isDuplicateVisibleLine(
  messages: CodexChatMessage[],
  line: string,
  role?: CodexChatRole,
): boolean {
  const normalizedLine = normalizeComparable(line);
  return messages
    .slice(-6)
    .some((message) => {
      if (role && message.role !== role) {
        return false;
      }

      return normalizeComparable(message.content) === normalizedLine;
    });
}

function normalizeComparable(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function completeActiveActivities(activities: CodexAgentActivity[]): CodexAgentActivity[] {
  return activities.map((activity) => ({ ...activity, active: false }));
}

function completeLastToolMessage(messages: CodexChatMessage[]): CodexChatMessage[] {
  return messages.map((message, index) => {
    if (index !== messages.length - 1 || message.role !== 'tool') {
      return message;
    }

    return { ...message };
  });
}

function completeLastAssistantMessage(messages: CodexChatMessage[]): CodexChatMessage[] {
  return messages.map((message, index) => {
    if (index !== messages.length - 1 || message.role !== 'assistant') {
      return message;
    }

    return { ...message };
  });
}

function cloneState(state: CodexUiState): CodexUiState {
  return {
    messages: state.messages.map((message) => ({ ...message })),
    activities: state.activities.map((activity) => ({ ...activity })),
    sessionState: state.sessionState,
    approvalPrompt: state.approvalPrompt ? { ...state.approvalPrompt } : null,
    menuPrompt: state.menuPrompt ? { ...state.menuPrompt } : null,
  };
}

function getRoleLabel(role: CodexChatRole): string {
  switch (role) {
    case 'user':
      return 'You';
    case 'tool':
      return 'Tool';
    case 'approval':
      return 'Approval';
    case 'error':
      return 'Error';
    case 'system':
      return 'System';
    case 'assistant':
    default:
      return 'Codex';
  }
}

function hashText(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
