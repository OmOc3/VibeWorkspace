import { app, BrowserWindow } from 'electron';
import { bootstrapApplication } from './app';

if (process.platform === 'win32') {
  app.setAppUserModelId('com.vibecoding.workspace');
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows();
    const firstWindow = windows[0];

    if (!firstWindow) {
      return;
    }

    if (firstWindow.isMinimized()) {
      firstWindow.restore();
    }

    firstWindow.focus();
  });

  app.whenReady().then(() => {
    bootstrapApplication().catch((error) => {
      console.error('Failed to bootstrap application.', error);
      app.quit();
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrapApplication().catch((error) => {
        console.error('Failed to re-bootstrap application.', error);
      });
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
