/**
 * Apply UI preferences that affect layout on each app load.
 */
import { useEffect } from 'react';
import { useUiPreferencesStore } from '../stores/uiPreferencesStore';

export function useStartupUiPreferences(): void {
  useEffect(() => {
    if (useUiPreferencesStore.getState().connectionBarStartCollapsed) {
      useUiPreferencesStore.getState().setConnectionBarCollapsed(true);
    }
  }, []);
}
