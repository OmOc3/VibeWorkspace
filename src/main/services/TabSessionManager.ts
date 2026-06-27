import { BrowserWindow, WebContentsView, session as electronSession } from 'electron';
import type { AgentTab, Project, SessionProfile, Workspace } from '../../shared/models';
import type { Logger } from './Logger';

export interface ManagedTabSession {
  tabId: string;
  projectId: string;
  workspaceId: string;
  partitionId: string;
  authStatus: SessionProfile['authStatus'];
}

export class TabSessionManager {
  private readonly sessions = new Map<string, ManagedTabSession>();
  private readonly authViews = new Map<string, { view: WebContentsView; window: BrowserWindow }>();

  constructor(private readonly logger: Logger) {}

  buildPartitionId(workspaceId: string, projectId: string, tabId: string): string {
    return `persist:workspace-${workspaceId}-project-${projectId}-tab-${tabId}`;
  }

  registerSession(workspace: Workspace, project: Project, tab: AgentTab): ManagedTabSession {
    const managedSession: ManagedTabSession = {
      tabId: tab.id,
      projectId: project.id,
      workspaceId: workspace.id,
      partitionId: tab.sessionProfile.partitionId,
      authStatus: tab.sessionProfile.authStatus,
    };

    this.sessions.set(tab.id, managedSession);
    this.logger.debug('Registered tab session.', managedSession);
    return managedSession;
  }

  unregisterSession(tabId: string): void {
    this.destroyAuthView(tabId);
    this.sessions.delete(tabId);
    this.logger.debug('Unregistered tab session.', { tabId });
  }

  getSession(tabId: string): ManagedTabSession | null {
    return this.sessions.get(tabId) ?? null;
  }

  attachTabView(_window: BrowserWindow, tabId: string): void {
    const session = this.getSession(tabId);

    if (!session) {
      throw new Error(`No managed session exists for tab ${tabId}.`);
    }

    // TODO: Add Electron WebContentsView lifecycle here in prompt 2.
    // This service will create a WebContentsView using the partition above,
    // attach it to BrowserWindow.contentView, and keep renderer UI unaware
    // of Electron view internals. BrowserView is intentionally not used.
    this.logger.debug('WebContentsView attachment is not implemented yet.', session);
  }

  async showAuthView(window: BrowserWindow, tabId: string, url: string): Promise<void> {
    const managedSession = this.getSession(tabId);

    if (!managedSession) {
      throw new Error(`No managed session exists for tab ${tabId}.`);
    }

    if (!isAllowedAuthUrl(url)) {
      throw new Error('Refusing to load a non-auth URL in the tab auth view.');
    }

    const view = this.getOrCreateAuthView(window, managedSession);
    view.setVisible(true);
    await view.webContents.loadURL(url);
  }

  setAuthViewBounds(window: BrowserWindow, tabId: string, bounds: Electron.Rectangle): void {
    const managedSession = this.getSession(tabId);

    if (!managedSession) {
      return;
    }

    const view = this.getOrCreateAuthView(window, managedSession);

    if (bounds.width <= 0 || bounds.height <= 0) {
      view.setVisible(false);
      return;
    }

    view.setBounds(bounds);
    view.setVisible(true);
  }

  hideAuthView(tabId: string): void {
    this.authViews.get(tabId)?.view.setVisible(false);
  }

  hideAllAuthViews(): void {
    for (const entry of this.authViews.values()) {
      entry.view.setVisible(false);
    }
  }

  destroyAuthView(tabId: string): void {
    const entry = this.authViews.get(tabId);

    if (!entry) {
      return;
    }

    entry.window.contentView.removeChildView(entry.view);
    entry.view.webContents.close();
    this.authViews.delete(tabId);
  }

  async clearTabPartition(tabId: string): Promise<void> {
    const managedSession = this.getSession(tabId);

    if (!managedSession) {
      return;
    }

    const partitionSession = electronSession.fromPartition(managedSession.partitionId);
    await partitionSession.clearStorageData();
    await partitionSession.clearCache();
  }

  private getOrCreateAuthView(
    window: BrowserWindow,
    managedSession: ManagedTabSession,
  ): WebContentsView {
    const existingView = this.authViews.get(managedSession.tabId);

    if (existingView) {
      existingView.window = window;
      window.contentView.addChildView(existingView.view);
      return existingView.view;
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: managedSession.partitionId,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });

    view.setBackgroundColor('#fbfaf7');
    view.setVisible(false);
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedAuthUrl(url)) {
        view.webContents.loadURL(url).catch((error) => {
          this.logger.warn('Failed to load auth popup URL in-place.', { url, error });
        });
      } else {
        this.logger.warn('Blocked non-auth popup URL.', { url });
      }

      return { action: 'deny' };
    });

    view.webContents.on('will-navigate', (event, url) => {
      if (isAllowedAuthUrl(url)) {
        return;
      }

      event.preventDefault();
      this.logger.warn('Blocked non-auth navigation.', { url });
    });

    window.contentView.addChildView(view);
    this.authViews.set(managedSession.tabId, { view, window });
    return view;
  }
}

function isAllowedAuthUrl(url: string): boolean {
  if (url === 'about:blank') {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.toLowerCase();
    const allowedHosts = [
      'auth.openai.com',
      'accounts.openai.com',
      'chatgpt.com',
      'chat.openai.com',
      'openai.com',
      'platform.openai.com',
    ];

    return parsedUrl.protocol === 'https:' && allowedHosts.some((allowedHost) => {
      return host === allowedHost || host.endsWith(`.${allowedHost}`);
    });
  } catch {
    return false;
  }
}
