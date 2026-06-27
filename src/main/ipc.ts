import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import {
  authTabInputSchema,
  authViewBoundsInputSchema,
  closeTabInputSchema,
  closeSubtabInputSchema,
  createSubtabInputSchema,
  createTabInputSchema,
  profileTabInputSchema,
  renameTabInputSchema,
  renameSubtabInputSchema,
  selectProjectInputSchema,
  setActiveTabInputSchema,
  setActiveSubtabInputSchema,
  terminalControlInputSchema,
  terminalInputSchema,
  terminalResizeInputSchema,
  terminalStartInputSchema,
} from '../shared/schemas';
import type { AuthService } from './services/AuthService';
import type { Logger } from './services/Logger';
import type { ProfileService } from './services/ProfileService';
import type { TabSessionManager } from './services/TabSessionManager';
import type { TerminalService } from './services/TerminalService';
import type { UsageService } from './services/UsageService';
import type { WorkspaceService } from './services/WorkspaceService';

export function registerWorkspaceIpcHandlers(
  window: BrowserWindow,
  workspaceService: WorkspaceService,
  sessionManager: TabSessionManager,
  terminalService: TerminalService,
  authService: AuthService,
  usageService: UsageService,
  profileService: ProfileService,
  logger: Logger,
): void {
  ipcMain.handle(IPC_CHANNELS.getWorkspaceState, () => {
    return workspaceService.getWorkspaceState();
  });

  ipcMain.handle(IPC_CHANNELS.chooseProjectFolder, async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose a project folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      logger.info('Project folder selection canceled.');
      return workspaceService.getWorkspaceState();
    }

    return workspaceService.selectProjectFolder(result.filePaths[0]);
  });

  ipcMain.handle(IPC_CHANNELS.selectProject, (_event, input: unknown) => {
    const parsedInput = selectProjectInputSchema.parse(input);
    sessionManager.hideAllAuthViews();
    return workspaceService.selectProject(parsedInput.projectId);
  });

  ipcMain.handle(IPC_CHANNELS.createTab, (_event, input: unknown) => {
    const parsedInput = createTabInputSchema.parse(input);
    return workspaceService.createTab(parsedInput);
  });

  ipcMain.handle(IPC_CHANNELS.closeTab, async (_event, input: unknown) => {
    const parsedInput = closeTabInputSchema.parse(input);
    terminalService.killTab(parsedInput.tabId);
    authService.stopTabLogin(parsedInput.tabId);
    await sessionManager.clearTabPartition(parsedInput.tabId);
    await terminalService.clearTabCodexHome(parsedInput.tabId);
    return workspaceService.closeTab(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.renameTab, (_event, input: unknown) => {
    const parsedInput = renameTabInputSchema.parse(input);
    return workspaceService.renameTab(parsedInput.tabId, parsedInput.title);
  });

  ipcMain.handle(IPC_CHANNELS.setActiveTab, (_event, input: unknown) => {
    const parsedInput = setActiveTabInputSchema.parse(input);
    sessionManager.hideAllAuthViews();
    return workspaceService.setActiveTab(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.createSubtab, (_event, input: unknown) => {
    const parsedInput = createSubtabInputSchema.parse(input);
    return workspaceService.createSubtab(parsedInput);
  });

  ipcMain.handle(IPC_CHANNELS.closeSubtab, (_event, input: unknown) => {
    const parsedInput = closeSubtabInputSchema.parse(input);
    terminalService.killTerminal(parsedInput.subtabId);
    return workspaceService.closeSubtab(parsedInput.tabId, parsedInput.subtabId);
  });

  ipcMain.handle(IPC_CHANNELS.renameSubtab, (_event, input: unknown) => {
    const parsedInput = renameSubtabInputSchema.parse(input);
    return workspaceService.renameSubtab(
      parsedInput.tabId,
      parsedInput.subtabId,
      parsedInput.title,
    );
  });

  ipcMain.handle(IPC_CHANNELS.setActiveSubtab, (_event, input: unknown) => {
    const parsedInput = setActiveSubtabInputSchema.parse(input);
    return workspaceService.setActiveSubtab(parsedInput.tabId, parsedInput.subtabId);
  });

  ipcMain.handle(IPC_CHANNELS.terminalStart, async (_event, input: unknown) => {
    const parsedInput = terminalStartInputSchema.parse(input);
    await terminalService.startTerminal(
      parsedInput.tabId,
      parsedInput.subtabId,
      parsedInput.cols,
      parsedInput.rows,
      parsedInput.viewMode,
    );
  });

  ipcMain.on(IPC_CHANNELS.terminalInput, (_event, input: unknown) => {
    try {
      const parsedInput = terminalInputSchema.parse(input);
      terminalService.writeTerminal(parsedInput.subtabId, parsedInput.data);
    } catch (error) {
      logger.warn('Invalid terminal input payload.', { error });
    }
  });

  ipcMain.on(IPC_CHANNELS.terminalResize, (_event, input: unknown) => {
    try {
      const parsedInput = terminalResizeInputSchema.parse(input);
      terminalService.resizeTerminal(parsedInput.subtabId, parsedInput.cols, parsedInput.rows);
    } catch (error) {
      logger.warn('Invalid terminal resize payload.', { error });
    }
  });

  ipcMain.on(IPC_CHANNELS.terminalKill, (_event, input: unknown) => {
    try {
      const parsedInput = terminalControlInputSchema.parse(input);
      terminalService.killTerminal(parsedInput.subtabId);
    } catch (error) {
      logger.warn('Invalid terminal kill payload.', { error });
    }
  });

  ipcMain.handle(IPC_CHANNELS.authStartLogin, async (_event, input: unknown) => {
    const parsedInput = authTabInputSchema.parse(input);
    return authService.startLogin(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.authLogout, async (_event, input: unknown) => {
    const parsedInput = authTabInputSchema.parse(input);
    await sessionManager.clearTabPartition(parsedInput.tabId);
    return authService.logout(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.authRefreshStatus, async (_event, input: unknown) => {
    const parsedInput = authTabInputSchema.parse(input);
    return authService.refreshStatus(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.authSetViewBounds, (_event, input: unknown) => {
    const parsedInput = authViewBoundsInputSchema.parse(input);
    sessionManager.setAuthViewBounds(window, parsedInput.tabId, {
      x: parsedInput.x,
      y: parsedInput.y,
      width: parsedInput.width,
      height: parsedInput.height,
    });
  });

  ipcMain.handle(IPC_CHANNELS.authHideView, (_event, input: unknown) => {
    const parsedInput = authTabInputSchema.parse(input);
    sessionManager.hideAuthView(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.profileRefreshUsage, async (_event, input: unknown) => {
    const parsedInput = profileTabInputSchema.parse(input);
    return usageService.refreshUsage(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.profileImportDefault, async (_event, input: unknown) => {
    const parsedInput = profileTabInputSchema.parse(input);
    return profileService.importDefaultProfile(parsedInput.tabId);
  });

  ipcMain.handle(IPC_CHANNELS.profileGenerateCliWrapper, async (_event, input: unknown) => {
    const parsedInput = profileTabInputSchema.parse(input);
    return profileService.generateCliWrapper(parsedInput.tabId);
  });

  logger.info('Workspace IPC handlers registered.');
}
