import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useSettingsStore } from '../store/settingsStore';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return <>{children}</>;
}
