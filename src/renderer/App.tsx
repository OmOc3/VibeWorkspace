import { useEffect, useState } from 'react';
import { MainLayout } from './components/MainLayout';
import { installMockWorkspaceApi } from './dev/mockWorkspaceApi';
import { useWorkspaceStore } from './state/workspaceStore';

installMockWorkspaceApi();

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'vibe-workspace-theme';

function getInitialThemeMode(): ThemeMode {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }

    return 'dark';
  } catch {
    return 'dark';
  }
}

export default function App(): JSX.Element {
  const load = useWorkspaceStore((store) => store.load);
  const subscribeToWorkspaceEvents = useWorkspaceStore((store) => store.subscribeToWorkspaceEvents);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  useEffect(() => {
    void load();
    return subscribeToWorkspaceEvents();
  }, [load, subscribeToWorkspaceEvents]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.style.colorScheme = themeMode;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // Storage can be unavailable in hardened desktop contexts.
    }
  }, [themeMode]);

  return (
    <MainLayout
      themeMode={themeMode}
      onToggleTheme={() => setThemeMode((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
    />
  );
}
