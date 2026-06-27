import path from 'node:path';
import { chmod, cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { WorkspaceState } from '../../shared/models';
import {
  buildAgentHome,
  ensureAgentHome,
  getAgentAppSpec,
  getDefaultAgentHome,
} from './AgentAppSpecs';
import type { Logger } from './Logger';
import type { WorkspaceService } from './WorkspaceService';

const WRAPPER_MARKER = 'vibe-workspace generated wrapper';

export class ProfileService {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly sessionProfilesRoot: string,
    private readonly logger: Logger,
  ) {}

  async importDefaultProfile(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const appKind = context.sessionProfile.appKind;
    const sourceHome = path.resolve(getDefaultAgentHome(appKind));
    const destinationHome = path.resolve(
      buildAgentHome(appKind, this.sessionProfilesRoot, context.sessionProfile.id),
    );
    const sessionRoot = path.resolve(this.sessionProfilesRoot, context.sessionProfile.id);
    const importStamp = toBackupStamp(new Date());
    const temporaryImportHome = path.join(sessionRoot, `${appKind}.import-${importStamp}`);
    let backupPath: string | null = null;

    await assertDirectoryExists(sourceHome);
    ensureWithinRoot(destinationHome, sessionRoot, 'profile import destination');
    ensureWithinRoot(temporaryImportHome, sessionRoot, 'temporary profile import destination');

    if (sourceHome === destinationHome) {
      throw new Error('Default profile is already the active isolated profile.');
    }

    await mkdir(sessionRoot, { recursive: true });
    await rm(temporaryImportHome, { recursive: true, force: true });

    try {
      await cp(sourceHome, temporaryImportHome, {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      backupPath = await moveExistingProfileToBackup(destinationHome, sessionRoot, appKind);
      await rename(temporaryImportHome, destinationHome);
    } catch (error) {
      await rm(destinationHome, { recursive: true, force: true }).catch(() => undefined);
      await rm(temporaryImportHome, { recursive: true, force: true }).catch(() => undefined);

      if (backupPath) {
        await rename(backupPath, destinationHome).catch(() => undefined);
      }

      throw error;
    }

    this.logger.info('Imported default agent profile.', {
      tabId,
      appKind,
      sourceHome,
      destinationHome,
      backupPath,
    });
    return this.workspaceService.recordProfileImport(tabId);
  }

  async generateCliWrapper(tabId: string): Promise<WorkspaceState> {
    const context = this.workspaceService.getTabSessionContext(tabId);
    const appKind = context.sessionProfile.appKind;
    const spec = getAgentAppSpec(appKind);
    const agentHome = buildAgentHome(appKind, this.sessionProfilesRoot, context.sessionProfile.id);
    const wrapperRoot = path.join(this.sessionProfilesRoot, context.sessionProfile.id, 'wrappers');
    const wrapperPath = path.join(wrapperRoot, getWrapperFileName(appKind, context.tab.title));
    const wrapperContent = buildWrapperContent(spec.homeEnvKey, agentHome, context.project.path, spec.commandName);

    await ensureAgentHome(agentHome);
    await mkdir(wrapperRoot, { recursive: true });
    await assertOwnedWrapperOrMissing(wrapperPath);
    await writeFile(wrapperPath, wrapperContent, 'utf8');

    if (process.platform !== 'win32') {
      await chmod(wrapperPath, 0o755);
    }

    this.logger.info('Generated agent CLI wrapper.', {
      tabId,
      appKind,
      wrapperPath,
    });
    return this.workspaceService.setCliWrapperPath(tabId, wrapperPath);
  }
}

async function assertDirectoryExists(directoryPath: string): Promise<void> {
  try {
    const info = await stat(directoryPath);

    if (!info.isDirectory()) {
      throw new Error(`${directoryPath} is not a directory.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Default profile directory does not exist: ${directoryPath}`);
    }

    throw error;
  }
}

async function moveExistingProfileToBackup(
  destinationHome: string,
  sessionRoot: string,
  appKind: string,
): Promise<string | null> {
  try {
    await stat(destinationHome);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const backupPath = path.join(sessionRoot, `${appKind}.backup-${toBackupStamp(new Date())}`);

  ensureWithinRoot(backupPath, sessionRoot, 'profile backup path');
  await rename(destinationHome, backupPath);
  return backupPath;
}

function ensureWithinRoot(targetPath: string, rootPath: string, label: string): void {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const rootWithSeparator = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(rootWithSeparator)) {
    throw new Error(`Refusing to use ${label} outside the session profile directory.`);
  }
}

function getWrapperFileName(appKind: string, title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'session';

  return process.platform === 'win32' ? `${appKind}-${slug}.cmd` : `${appKind}-${slug}`;
}

function buildWrapperContent(
  homeEnvKey: string,
  agentHome: string,
  projectPath: string,
  commandName: string,
): string {
  if (process.platform === 'win32') {
    return [
      '@echo off',
      `REM ${WRAPPER_MARKER}`,
      `set "${homeEnvKey}=${agentHome}"`,
      `${commandName} -C "${projectPath}" %*`,
      '',
    ].join('\r\n');
  }

  return [
    '#!/usr/bin/env sh',
    `# ${WRAPPER_MARKER}`,
    `export ${homeEnvKey}=${quoteShell(agentHome)}`,
    `exec ${commandName} -C ${quoteShell(projectPath)} "$@"`,
    '',
  ].join('\n');
}

async function assertOwnedWrapperOrMissing(wrapperPath: string): Promise<void> {
  let existing: string;

  try {
    existing = await readFile(wrapperPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }

    throw error;
  }

  if (!existing.includes(WRAPPER_MARKER)) {
    throw new Error(`Refusing to overwrite a CLI wrapper not created by Vibe Workspace: ${wrapperPath}`);
  }
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function toBackupStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
