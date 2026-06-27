import { app, type BrowserWindow, Menu } from 'electron';

export function buildAndSetApplicationMenu(window: BrowserWindow): void {
  const isMac = process.platform === 'darwin';
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

  const template: Parameters<typeof Menu.buildFromTemplate>[0] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Agent Tab',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => window.webContents.send('menu:new-tab'),
        },
        {
          label: 'New Terminal',
          accelerator: isMac ? 'Cmd+T' : 'Ctrl+T',
          click: () => window.webContents.send('menu:new-subtab'),
        },
        { type: 'separator' as const },
        {
          label: 'Open Project...',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: () => window.webContents.send('menu:open-project'),
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette',
          accelerator: isMac ? 'Cmd+K' : 'Ctrl+K',
          click: () => window.webContents.send('menu:command-palette'),
        },
        { type: 'separator' as const },
        ...(isDev
          ? [
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const },
              { type: 'separator' as const },
            ]
          : []),
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
