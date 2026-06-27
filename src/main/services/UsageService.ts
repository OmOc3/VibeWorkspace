import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc';
import type { UsageSnapshot, WorkspaceState } from '../../shared/models';
import { createEmptyUsageSnapshot } from '../../shared/usage';
import {
  buildCodexHome,
  buildIsolatedCodexEnv,
  ensureCodexHome,
  getCodexCommand,
} from './CodexEnvironment';
import type { Logger } from './Logger';
import type { WorkspaceService } from './WorkspaceService';

interface JsonRpcMessage {
  id?: number;
  result?: unknown;
  error?: unknown;
}

interface RateLimitWindow {
  usedPercent?: unknown;
  resetsAt?: unknown;
}

interface RateLimitsSnapshot {
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
  rateLimitReachedType?: unknown;
}

const APP_SERVER_TIMEOUT_MS = 12_000;
const RATE_LIMITS_ID = 2;
const RAW_OUTPUT_LIMIT = 12_000;
const USAGE_CLIENT_NAME = 'vibe-coding-workspace';
const USAGE_CLIENT_VERSION = '0.1.0';

export class UsageService {
  private readonly runningRefreshes = new Map<string, Promise<WorkspaceState>>();

  constructor(
    private readonly window: BrowserWindow,
    private readonly workspaceService: WorkspaceService,
    private readonly sessionProfilesRoot: string,
    private readonly logger: Logger,
  ) {}

  refreshUsageInBackground(tabId: string): void {
    void this.refreshUsage(tabId)
      .then((state) => this.emitWorkspaceState(state))
      .catch((error) => {
        const snapshot = createUsageErrorSnapshot(error);
        this.emitWorkspaceState(this.workspaceService.updateSessionUsage(tabId, snapshot));
        this.logger.warn('Failed to refresh usage in background.', { tabId, error });
      });
  }

  async refreshUsage(tabId: string): Promise<WorkspaceState> {
    const existingRefresh = this.runningRefreshes.get(tabId);

    if (existingRefresh) {
      return existingRefresh;
    }

    const refresh = this.runUsageRefresh(tabId).finally(() => {
      this.runningRefreshes.delete(tabId);
    });

    this.runningRefreshes.set(tabId, refresh);
    return refresh;
  }

  private async runUsageRefresh(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const codexHome = buildCodexHome(this.sessionProfilesRoot, context.sessionProfile.id);
    const refreshingSnapshot = {
      ...createEmptyUsageSnapshot('refreshing', new Date().toISOString()),
      rawOutput: context.sessionProfile.usageSnapshot.rawOutput,
    };

    await ensureCodexHome(codexHome);
    this.emitWorkspaceState(this.workspaceService.updateSessionUsage(tabId, refreshingSnapshot));

    try {
      const rawResult = await readCodexRateLimits(context.project.path, codexHome);
      const snapshot = parseCodexRateLimits(rawResult);

      this.logger.info('Captured Codex usage status.', {
        tabId,
        fiveHour: snapshot.fiveHour.percent,
        weekly: snapshot.weekly.percent,
        monthly: snapshot.monthly.percent,
      });
      this.workspaceService.updateSessionUsage(tabId, snapshot);
      return this.workspaceService.recordActivity(tabId, 'usage', 'Usage refreshed', {
        fiveHour: snapshot.fiveHour.percent,
        weekly: snapshot.weekly.percent,
      });
    } catch (error) {
      const snapshot = createUsageErrorSnapshot(error);

      this.logger.warn('Codex usage status capture failed.', { tabId, error });
      this.workspaceService.updateSessionUsage(tabId, snapshot);
      return this.workspaceService.recordActivity(tabId, 'usage', 'Usage refresh failed', {
        error: snapshot.error,
      });
    }
  }

  private emitWorkspaceState(state: WorkspaceState): void {
    this.window.webContents.send(IPC_CHANNELS.workspaceStateChanged, state);
  }
}

function readCodexRateLimits(projectPath: string, codexHome: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    let output = '';
    let lineBuffer = '';
    let settled = false;

    const finish = (error?: Error, result?: string): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutTimer);

      try {
        child.kill();
      } catch {
        // The process may have already exited.
      }

      if (error) {
        reject(error);
        return;
      }

      resolve(result ?? output);
    };

    try {
      child = spawn(getCodexCommand(), ['app-server'], {
        cwd: projectPath,
        env: buildIsolatedCodexEnv(codexHome),
        shell: process.platform === 'win32',
        windowsHide: true,
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to start Codex app-server.'));
      return;
    }

    const timeoutTimer = setTimeout(() => {
      finish(new Error('Timed out waiting for Codex app-server rate limits.'));
    }, APP_SERVER_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      const data = chunk.toString('utf8');
      output = limitRawOutput(`${output}${data}`);
      lineBuffer += data;

      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        try {
          const result = extractJsonRpcResult(line, RATE_LIMITS_ID);

          if (result) {
            finish(undefined, result);
            return;
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error('Could not read Codex usage.'));
          return;
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output = limitRawOutput(`${output}${chunk.toString('utf8')}`);
    });
    child.on('error', (error) => finish(error));
    child.on('exit', () => {
      if (!settled) {
        finish(new Error('Codex app-server exited before returning usage.'));
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: {
            name: USAGE_CLIENT_NAME,
            version: USAGE_CLIENT_VERSION,
          },
        },
      })}\n`,
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized' })}\n`);
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: RATE_LIMITS_ID,
        method: 'account/rateLimits/read',
      })}\n`,
    );
  });
}

function extractJsonRpcResult(line: string, id: number): string | null {
  if (!line.trim()) {
    return null;
  }

  let message: JsonRpcMessage;

  try {
    message = JSON.parse(line) as JsonRpcMessage;
  } catch {
    return null;
  }

  if (message.id !== id) {
    return null;
  }

  if (message.error) {
    throw new Error('Codex app-server rejected the usage request. Sign in again and retry.');
  }

  return JSON.stringify(message.result ?? {});
}

function parseCodexRateLimits(rawResult: string): UsageSnapshot {
  const now = new Date();
  const parsed = JSON.parse(rawResult) as { rateLimits?: RateLimitsSnapshot };
  const rateLimits = parsed.rateLimits;

  if (!rateLimits) {
    throw new Error('Codex app-server returned usage data in an unknown format.');
  }

  if (!rateLimits.primary && !rateLimits.secondary && rateLimits.rateLimitReachedType) {
    throw new Error('Codex reports that a rate limit has been reached.');
  }

  return {
    status: 'available',
    updatedAt: now.toISOString(),
    nextRefreshAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    fiveHour: rateLimitWindowToUsageWindow('5-hour window', rateLimits.primary),
    weekly: rateLimitWindowToUsageWindow('Weekly', rateLimits.secondary),
    monthly: {
      label: 'Monthly limit',
      percent: null,
      resetText: null,
      rawLine: null,
    },
    rawOutput: rawResult.slice(-RAW_OUTPUT_LIMIT),
    error: null,
  };
}

function rateLimitWindowToUsageWindow(
  label: string,
  value: RateLimitWindow | undefined,
): UsageSnapshot['fiveHour'] {
  const percent = normalizePercent(value?.usedPercent);
  const resetText = formatResetText(value?.resetsAt);

  return {
    label,
    percent,
    resetText,
    rawLine:
      percent === null && resetText === null
        ? null
        : `${label}: ${percent ?? 'unknown'}% used${resetText ? ` (${resetText})` : ''}`,
  };
}

function normalizePercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, value));
}

function formatResetText(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const diffMs = value * 1000 - Date.now();

  if (diffMs <= 0) {
    return 'reset due now';
  }

  const totalMinutes = Math.max(1, Math.round(diffMs / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `resets in ${days}d${hours > 0 ? ` ${hours}h` : ''}`;
  }

  if (hours > 0) {
    return `resets in ${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  }

  return `resets in ${minutes}m`;
}

function createUsageErrorSnapshot(error: unknown): UsageSnapshot {
  return {
    ...createEmptyUsageSnapshot('error', new Date().toISOString()),
    error: error instanceof Error ? error.message : 'Could not read Codex usage status.',
  };
}

function limitRawOutput(value: string): string {
  if (value.length <= RAW_OUTPUT_LIMIT) {
    return value;
  }

  return value.slice(value.length - RAW_OUTPUT_LIMIT);
}
