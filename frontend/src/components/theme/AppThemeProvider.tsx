import { App as AntApp, ConfigProvider } from 'antd';
import { useEffect, useMemo, type ReactNode } from 'react';
import { applyDocumentTheme, buildAntThemeConfig } from '../../constants/colorTheme';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const colorTheme = useUiPreferencesStore((s) => s.colorTheme);
  const highContrast = useUiPreferencesStore((s) => s.highContrast);

  useEffect(() => {
    applyDocumentTheme(colorTheme, highContrast);
  }, [colorTheme, highContrast]);

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
