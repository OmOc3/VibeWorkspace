import { spawn } from 'node:child_process';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import type { AuthStatus, WorkspaceState } from '../../shared/models';
import {
  buildCodexHome,
  buildIsolatedCodexEnv,
  ensureCodexHome,
  getCodexCommand,
} from './CodexEnvironment';
import type { Logger } from './Logger';
import type { TabSessionManager } from './TabSessionManager';
import type { UsageService } from './UsageService';
import type { WorkspaceService } from './WorkspaceService';

interface RunningLogin {
  kill: () => void;
}

export class AuthService {
  private readonly runningLogins = new Map<string, RunningLogin>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionManager: TabSessionManager,
    private readonly sessionProfilesRoot: string,
    private readonly usageService: UsageService,
    private readonly logger: Logger,
  ) {}

  async startLogin(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const codexHome = buildCodexHome(this.sessionProfilesRoot, context.sessionProfile.id);

    await ensureCodexHome(codexHome);
    this.runningLogins.get(tabId)?.kill();

    const child = spawn(getCodexCommand(), ['login', '--device-auth'], {
      cwd: context.project.path,
      env: buildIsolatedCodexEnv(codexHome),
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    const runningLogin: RunningLogin = {
      kill: () => child.kill(),
    };
    let openedAuthUrl = false;

    this.runningLogins.set(tabId, runningLogin);

    const inspectOutput = (chunk: Buffer): void => {
      const url = extractFirstUrl(chunk.toString('utf8'));

      if (!url || openedAuthUrl) {
        return;
      }

      openedAuthUrl = true;
      this.sessionManager.showAuthView(this.window, tabId, url).catch((error) => {
        this.logger.warn('Failed to show auth view.', { tabId, error });
      });
    };

    child.stdout.on('data', inspectOutput);
    child.stderr.on('data', inspectOutput);
    child.on('error', (error) => {
      this.runningLogins.delete(tabId);
      this.emitWorkspaceState(this.workspaceService.updateAuthStatus(tabId, 'error'));
      this.logger.warn('Codex login process failed.', { tabId, error });
    });
    child.on('exit', (code) => {
      this.runningLogins.delete(tabId);

      void this.refreshStatus(tabId).then((state) => {
        this.emitWorkspaceState(state);
      }).catch((error) => {
        this.emitWorkspaceState(
          this.workspaceService.updateAuthStatus(tabId, code === 0 ? 'connected' : 'error'),
        );
        this.logger.warn('Failed to refresh auth after login exit.', { tabId, code, error });
      });
    });

    this.logger.info('Started Codex device auth.', { tabId, codexHome });
    return this.workspaceService.updateAuthStatus(tabId, 'login pending');
  }

  async logout(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const codexHome = buildCodexHome(this.sessionProfilesRoot, context.sessionProfile.id);

    await ensureCodexHome(codexHome);
    this.runningLogins.get(tabId)?.kill();
    await runCodexCommand(['logout'], context.project.path, codexHome);
    this.sessionManager.hideAuthView(tabId);
    this.logger.info('Logged out Codex session.', { tabId });
    this.workspaceService.clearSessionUsage(tabId);
    return this.workspaceService.updateAuthStatus(tabId, 'not connected');
  }

  async refreshStatus(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const codexHome = buildCodexHome(this.sessionProfilesRoot, context.sessionProfile.id);

    await ensureCodexHome(codexHome);

    const result = await runCodexCommand(['login', 'status'], context.project.path, codexHome);
    const authStatus: AuthStatus = result.exitCode === 0 ? 'connected' : 'not connected';

    this.logger.info('Refreshed Codex auth status.', { tabId, authStatus });
    const state = this.workspaceService.updateAuthStatus(tabId, authStatus);
    this.refreshUsageIfConnected(tabId, state);
    return state;
  }

  stopTabLogin(tabId: string): void {
    this.runningLogins.get(tabId)?.kill();
    this.runningLogins.delete(tabId);
  }

  private emitWorkspaceState(state: WorkspaceState): void {
    this.window.webContents.send(IPC_CHANNELS.workspaceStateChanged, state);
  }

  private refreshUsageIfConnected(tabId: string, state: WorkspaceState): void {
    const tab = state.tabs.find((candidate) => candidate.id === tabId);

    if (tab?.sessionProfile.authStatus === 'connected') {
      this.usageService.refreshUsageInBackground(tabId);
    }
  }
}

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https:\/\/[^\s"'<>]+/);

  if (!match) {
    return null;
  }

  return match[0].replace(/[),.;]+$/g, '');
}

function runCodexCommand(
  args: string[],
  cwd: string,
  codexHome: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(getCodexCommand(), args, {
      cwd,
      env: buildIsolatedCodexEnv(codexHome),
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}
