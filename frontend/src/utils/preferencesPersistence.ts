const UI_PREFERENCES_KEY = 'newiris-ui-preferences-v1';

export type TreeLabelMode = 'name' | 'alias' | 'custom';

export interface PersistedUiPreferences {
  treeLabelMode: TreeLabelMode;
  directFilter: boolean;
  searchMatchCase: boolean;
  searchMatchWholeWord: boolean;
  showFullNameInTable: boolean;
  showRegisColumn: boolean;
  showSourceColumn: boolean;
  treeSort: boolean;
  plotGridX: boolean;
  plotGridY: boolean;
  plotZeroLine: boolean;
  plotAutoYScale: boolean;
  plotNameTruncate: number;
  sessionDescription: string;
  startupOpenSession: boolean;
  startupConnectWatchIo: boolean;
  watchIoHistory: string[];
}

export const DEFAULT_UI_PREFERENCES: PersistedUiPreferences = {
  treeLabelMode: 'name',
  directFilter: false,
  searchMatchCase: false,
  searchMatchWholeWord: false,
  showFullNameInTable: false,
  showRegisColumn: false,
  showSourceColumn: false,
  treeSort: true,
  plotGridX: true,
  plotGridY: true,
  plotZeroLine: false,
  plotAutoYScale: false,
  plotNameTruncate: 0,
  sessionDescription: '',
  startupOpenSession: false,
  startupConnectWatchIo: false,
  watchIoHistory: [],
};

export function loadUiPreferences(): PersistedUiPreferences {
  try {
    const raw = localStorage.getItem(UI_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFERENCES };
    const data = JSON.parse(raw) as Partial<PersistedUiPreferences>;
    return { ...DEFAULT_UI_PREFERENCES, ...data };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function saveUiPreferences(prefs: PersistedUiPreferences): void {
  try {
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota
  }
}
