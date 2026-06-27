import { BrowserWindow } from 'electron';
import { spawn, type IDisposable, type IPty } from 'node-pty';
import type { AgentSubtabPreset, TerminalViewMode } from '../../shared/models';
import { IPC_CHANNELS } from '../../shared/ipc';
import {
  buildCodexHome,
  buildIsolatedCodexEnv,
  clearCodexHome,
  ensureCodexHome,
  getCodexCommand,
} from './CodexEnvironment';
import type { Logger } from './Logger';
import type { WorkspaceService } from './WorkspaceService';

interface ManagedTerminal {
  tabId: string;
  subtabId: string;
  pty: IPty;
  disposables: IDisposable[];
}

interface TerminalCommand {
  file: string;
  args: string[] | string;
}

export class TerminalService {
  private readonly terminals = new Map<string, ManagedTerminal>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionProfilesRoot: string,
    private readonly logger: Logger,
  ) {}

  async startTerminal(
    tabId: string,
    subtabId: string,
    cols: number,
    rows: number,
    viewMode: TerminalViewMode = 'cli',
  ): Promise<void> {
    const context = this.workspaceService.getTerminalLaunchContext(tabId, subtabId);
    const codexHome = buildCodexHome(this.sessionProfilesRoot, context.sessionProfile.id);

    await ensureCodexHome(codexHome);
    this.killTerminal(subtabId);

    const command = getCommandForPreset(context.subtab.preset, context.project.path);
    const pty = spawn(command.file, command.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: context.project.path,
      env: buildIsolatedCodexEnv(codexHome),
      encoding: 'utf8',
      useConpty: process.platform === 'win32',
    });

    const disposables = [
      pty.onData((data) => {
        this.window.webContents.send(IPC_CHANNELS.terminalData, { subtabId, data });
      }),
      pty.onExit(({ exitCode, signal }) => {
        this.terminals.delete(subtabId);
        this.window.webContents.send(IPC_CHANNELS.terminalExit, {
          subtabId,
          exitCode,
          signal: signal ?? null,
        });
        this.logger.info('Terminal exited.', { tabId, subtabId, exitCode, signal });
      }),
    ];

    this.terminals.set(subtabId, {
      tabId,
      subtabId,
      pty,
      disposables,
    });

    this.logger.info('Started terminal.', {
      tabId,
      subtabId,
      preset: context.subtab.preset,
      viewMode,
      pid: pty.pid,
      codexHome,
    });
  }

  writeTerminal(subtabId: string, data: string): void {
    this.terminals.get(subtabId)?.pty.write(data);
  }

  resizeTerminal(subtabId: string, cols: number, rows: number): void {
    this.terminals.get(subtabId)?.pty.resize(cols, rows);
  }

  clearTerminal(subtabId: string): void {
    const terminal = this.terminals.get(subtabId);

    if (!terminal) {
      return;
    }

    terminal.pty.write('\x0c');
    terminal.pty.clear();
  }

  killTerminal(subtabId: string): void {
    const terminal = this.terminals.get(subtabId);

    if (!terminal) {
      return;
    }

    for (const disposable of terminal.disposables) {
      disposable.dispose();
    }

    try {
      terminal.pty.kill();
    } catch (error) {
      this.logger.warn('Failed to kill terminal.', { subtabId, error });
    }

    this.terminals.delete(subtabId);
  }

  killTab(tabId: string): void {
    for (const terminal of [...this.terminals.values()]) {
      if (terminal.tabId === tabId) {
        this.killTerminal(terminal.subtabId);
      }
    }
  }

  killAll(): void {
    for (const terminal of [...this.terminals.values()]) {
      this.killTerminal(terminal.subtabId);
    }
  }

  async clearTabCodexHome(tabId: string): Promise<void> {
    const state = this.workspaceService.getWorkspaceState();
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (!tab) {
      return;
    }

    await clearCodexHome(this.sessionProfilesRoot, tab.sessionProfile.id);
  }
}

function getCommandForPreset(
  preset: AgentSubtabPreset,
  projectPath: string,
): TerminalCommand {
  if (preset === 'shell') {
    return getShellCommand();
  }

  if (preset === 'codex-login') {
    return getCodexLoginCommand();
  }

  return getCodexCliCommand(projectPath);
}

function getCodexCliCommand(projectPath: string): TerminalCommand {
  if (process.platform === 'win32') {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', `${getCodexCommand()} -C ${quoteCmdArgument(projectPath)}`],
    };
  }

  return {
    file: getCodexCommand(),
    args: ['-C', projectPath],
  };
}

function getCodexLoginCommand(): TerminalCommand {
  if (process.platform === 'win32') {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', `${getCodexCommand()} login --device-auth`],
    };
  }

  return {
    file: getCodexCommand(),
    args: ['login', '--device-auth'],
  };
}

function getShellCommand(): TerminalCommand {
  if (process.platform === 'win32') {
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: [],
    };
  }

  return {
    file: process.env.SHELL || '/bin/bash',
    args: [],
  };
}

function quoteCmdArgument(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
