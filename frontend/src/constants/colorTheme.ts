/**
 * App color themes — CSS tokens via data-color-theme on <html>, Ant Design via AppThemeProvider.
 */
import type { ThemeConfig } from 'antd';
import { theme as antTheme } from 'antd';

export type ColorThemeId = 'light' | 'dark' | 'navy';

export const COLOR_THEME_OPTIONS: { value: ColorThemeId; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'navy', label: 'Navy' },
];

export const COLOR_THEME_HINTS: Record<ColorThemeId, string> = {
  light: 'White panels on light gray — default daytime workspace.',
  dark: 'Neutral charcoal surfaces with light text.',
  navy: 'Deep navy workspace with cool accent highlights.',
};

export const DEFAULT_COLOR_THEME: ColorThemeId = 'light';

export function isColorThemeId(value: string): value is ColorThemeId {
  return value === 'light' || value === 'dark' || value === 'navy';
}

export function applyDocumentTheme(themeId: ColorThemeId, highContrast: boolean): void {
  const root = document.documentElement;
  root.setAttribute('data-color-theme', themeId);
  root.setAttribute('data-high-contrast', highContrast ? 'true' : 'false');
}

const SHARED_ANT: ThemeConfig = {
  token: { borderRadius: 6, fontSize: 13 },
  components: { Tree: { titleHeight: 22 } },
};

export function buildAntThemeConfig(themeId: ColorThemeId, highContrast = false): ThemeConfig {
  if (themeId === 'light') {
    return {
      ...SHARED_ANT,
      algorithm: antTheme.defaultAlgorithm,
      token: {
        ...SHARED_ANT.token,
        colorPrimary: '#1677ff',
        colorBgLayout: '#f5f5f5',
        colorBgContainer: '#ffffff',
        colorBorder: highContrast ? '#cccccc' : '#e8e8e8',
        colorBorderSecondary: highContrast ? '#e0e0e0' : '#f0f0f0',
        ...(highContrast
          ? { colorText: 'rgba(0, 0, 0, 0.92)', colorTextSecondary: 'rgba(0, 0, 0, 0.68)' }
          : {}),
      },
    };
  }

  if (themeId === 'dark') {
    return {
      ...SHARED_ANT,
      algorithm: antTheme.darkAlgorithm,
      token: {
        ...SHARED_ANT.token,
        colorPrimary: '#4096ff',
        colorBgLayout: '#141414',
        colorBgContainer: '#1f1f1f',
        colorBgElevated: '#262626',
        colorBorder: highContrast ? '#757575' : '#303030',
        colorBorderSecondary: highContrast ? '#5a5a5a' : '#262626',
        colorText: highContrast ? '#ffffff' : 'rgba(255, 255, 255, 0.88)',
        colorTextSecondary: highContrast ? 'rgba(255, 255, 255, 0.78)' : 'rgba(255, 255, 255, 0.45)',
      },
    };
  }

  return {
    ...SHARED_ANT,
    algorithm: antTheme.darkAlgorithm,
    token: {
      ...SHARED_ANT.token,
      colorPrimary: '#4dabf7',
      colorBgLayout: '#040a14',
      colorBgContainer: '#081828',
      colorBgElevated: '#0d2034',
      colorBorder: highContrast ? '#3d6ba8' : '#1f4068',
      colorBorderSecondary: highContrast ? '#2a5088' : '#122a45',
      colorText: highContrast ? '#f0f6ff' : 'rgba(230, 240, 255, 0.92)',
      colorTextSecondary: highContrast ? 'rgba(220, 235, 255, 0.85)' : 'rgba(180, 200, 230, 0.55)',
      colorLink: '#74c0fc',
    },
  };
}
