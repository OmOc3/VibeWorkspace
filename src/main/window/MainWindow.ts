import path from 'node:path';
import { BrowserWindow, shell } from 'electron';
import type { Logger } from '../services/Logger';

export class MainWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly logger: Logger) {}

  create(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1240,
      height: 820,
      minWidth: 760,
      minHeight: 560,
      title: 'Vibe Coding Workspace',
      backgroundColor: '#f6f5f2',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });

    window.once('ready-to-show', () => {
      window.show();
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch((error) => {
        this.logger.warn('Failed to open external URL.', { url, error });
      });

      return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, url) => {
      const devServerUrl = process.env.VITE_DEV_SERVER_URL;

      if (!devServerUrl && url.startsWith('file://')) {
        return;
      }

      if (devServerUrl && url.startsWith(devServerUrl)) {
        return;
      }

      event.preventDefault();
    });

    this.window = window;
    return window;
  }

  async load(): Promise<void> {
    if (!this.window) {
      throw new Error('Main window has not been created.');
    }

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    if (devServerUrl) {
      this.logger.info('Loading renderer from Vite dev server.', { devServerUrl });
      await this.window.loadURL(devServerUrl);
      this.window.webContents.openDevTools({ mode: 'detach' });
      return;
    }

    const rendererPath = path.join(__dirname, '..', '..', 'renderer', 'index.html');
    this.logger.info('Loading renderer from packaged file.', { rendererPath });
    await this.window.loadFile(rendererPath);
  }

  get browserWindow(): BrowserWindow | null {
    return this.window;
  }
}
