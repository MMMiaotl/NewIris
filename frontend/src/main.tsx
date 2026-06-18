import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppThemeProvider } from './components/theme/AppThemeProvider';
import { applyDocumentTheme, DEFAULT_COLOR_THEME, isColorThemeId } from './constants/colorTheme';
import { hydrateWorkspaceOnce } from './utils/workspacePersistence';
import { loadUiPreferences } from './utils/preferencesPersistence';
import './index.css';

hydrateWorkspaceOnce();

const prefs = loadUiPreferences();
applyDocumentTheme(
  isColorThemeId(prefs.colorTheme) ? prefs.colorTheme : DEFAULT_COLOR_THEME,
  prefs.highContrast,
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  </StrictMode>,
);
