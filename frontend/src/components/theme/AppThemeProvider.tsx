/**
 * Syncs persisted color theme to document CSS variables and Ant Design ConfigProvider.
 */
import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, useMemo, type ReactNode } from 'react';
import { applyColorThemeToDocument, applyHighContrastToDocument, buildAntThemeConfig } from '../../constants/colorTheme';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

interface AppThemeProviderProps {
  children: ReactNode;
}

export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const colorTheme = useUiPreferencesStore((s) => s.colorTheme);
  const highContrast = useUiPreferencesStore((s) => s.highContrast);

  useEffect(() => {
    applyColorThemeToDocument(colorTheme);
  }, [colorTheme]);

  useEffect(() => {
    applyHighContrastToDocument(highContrast);
  }, [highContrast]);

  const antTheme = useMemo(
    () => buildAntThemeConfig(colorTheme, highContrast),
    [colorTheme, highContrast],
  );

  return (
    <ConfigProvider theme={antTheme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
