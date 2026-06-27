import path from 'node:path';
import { app } from 'electron';
import { registerWorkspaceIpcHandlers } from './ipc';
import { buildAndSetApplicationMenu } from './menu';
import { AuthService } from './services/AuthService';
import { createRootLogger } from './services/Logger';
import { ProfileService } from './services/ProfileService';
import { KeytarSecretStorePlaceholder } from './services/SecretStore';
import { TabSessionManager } from './services/TabSessionManager';
import { TerminalService } from './services/TerminalService';
import { UsageService } from './services/UsageService';
import { WorkspaceService } from './services/WorkspaceService';
import { MainWindow } from './window/MainWindow';

export async function bootstrapApplication(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const logger = createRootLogger(userDataPath);
  const sessionManager = new TabSessionManager(logger.child('sessions'));
  const workspaceService = new WorkspaceService(
    path.join(userDataPath, 'workspace.sqlite'),
    sessionManager,
    logger.child('workspace'),
  );
  const secretStore = new KeytarSecretStorePlaceholder(logger.child('secrets'));

  void secretStore;

  workspaceService.initialize();

  const mainWindow = new MainWindow(logger.child('window'));
  const browserWindow = mainWindow.create();
  buildAndSetApplicationMenu(browserWindow);
  const sessionProfilesRoot = path.join(userDataPath, 'session-profiles');
  const terminalService = new TerminalService(
    browserWindow,
    workspaceService,
    sessionProfilesRoot,
    logger.child('terminal'),
  );
  const usageService = new UsageService(
    browserWindow,
    workspaceService,
    sessionProfilesRoot,
    logger.child('usage'),
  );
  const profileService = new ProfileService(
    workspaceService,
    sessionProfilesRoot,
    logger.child('profiles'),
  );
  const authService = new AuthService(
    browserWindow,
    workspaceService,
    sessionManager,
    sessionProfilesRoot,
    usageService,
    logger.child('auth'),
  );

  registerWorkspaceIpcHandlers(
    browserWindow,
    workspaceService,
    sessionManager,
    terminalService,
    authService,
    usageService,
    profileService,
    logger.child('ipc'),
  );

  await mainWindow.load();

  app.on('before-quit', () => {
    terminalService.killAll();
    workspaceService.close();
    logger.info('Application shutdown complete.');
  });
}
