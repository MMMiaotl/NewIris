/**
 * UI preferences mirroring legacy Iris Show Options / Preferences dialogs.
 * Persisted to localStorage; separate from per-connection workspace.
 */
import { create } from 'zustand';
import type { TreeLabelMode } from '../utils/preferencesPersistence';
import {
  loadUiPreferences,
  saveUiPreferences,
  type PersistedUiPreferences,
} from '../utils/preferencesPersistence';

export type { TreeLabelMode };

interface UiPreferencesState extends PersistedUiPreferences {
  setTreeLabelMode: (mode: TreeLabelMode) => void;
  setDirectFilter: (on: boolean) => void;
  setShowFullNameInTable: (on: boolean) => void;
  setShowRegisColumn: (on: boolean) => void;
  setShowSourceColumn: (on: boolean) => void;
  setTreeSort: (on: boolean) => void;
  setPlotGridX: (on: boolean) => void;
  setPlotGridY: (on: boolean) => void;
  setPlotZeroLine: (on: boolean) => void;
  setPlotAutoYScale: (on: boolean) => void;
  setPlotNameTruncate: (n: number) => void;
  setSessionDescription: (text: string) => void;
  setStartupOpenSession: (on: boolean) => void;
  setStartupConnectWatchIo: (on: boolean) => void;
  addWatchIoHistory: (name: string) => void;
  loadFromDisk: () => void;
}

function patchPrefs(get: () => UiPreferencesState, partial: Partial<PersistedUiPreferences>) {
  saveUiPreferences({ ...get(), ...partial });
}

export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => ({
  ...loadUiPreferences(),
  setTreeLabelMode: (treeLabelMode) => {
    set({ treeLabelMode });
    patchPrefs(get, { treeLabelMode });
  },
  setDirectFilter: (directFilter) => {
    set({ directFilter });
    patchPrefs(get, { directFilter });
  },
  setShowFullNameInTable: (showFullNameInTable) => {
    set({ showFullNameInTable });
    patchPrefs(get, { showFullNameInTable });
  },
  setShowRegisColumn: (showRegisColumn) => {
    set({ showRegisColumn });
    patchPrefs(get, { showRegisColumn });
  },
  setShowSourceColumn: (showSourceColumn) => {
    set({ showSourceColumn });
    patchPrefs(get, { showSourceColumn });
  },
  setTreeSort: (treeSort) => {
    set({ treeSort });
    patchPrefs(get, { treeSort });
  },
  setPlotGridX: (plotGridX) => {
    set({ plotGridX });
    patchPrefs(get, { plotGridX });
  },
  setPlotGridY: (plotGridY) => {
    set({ plotGridY });
    patchPrefs(get, { plotGridY });
  },
  setPlotZeroLine: (plotZeroLine) => {
    set({ plotZeroLine });
    patchPrefs(get, { plotZeroLine });
  },
  setPlotAutoYScale: (plotAutoYScale) => {
    set({ plotAutoYScale });
    patchPrefs(get, { plotAutoYScale });
  },
  setPlotNameTruncate: (plotNameTruncate) => {
    set({ plotNameTruncate });
    patchPrefs(get, { plotNameTruncate });
  },
  setSessionDescription: (sessionDescription) => {
    set({ sessionDescription });
    patchPrefs(get, { sessionDescription });
  },
  setStartupOpenSession: (startupOpenSession) => {
    set({ startupOpenSession });
    patchPrefs(get, { startupOpenSession });
  },
  setStartupConnectWatchIo: (startupConnectWatchIo) => {
    set({ startupConnectWatchIo });
    patchPrefs(get, { startupConnectWatchIo });
  },
  addWatchIoHistory: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const history = [trimmed, ...get().watchIoHistory.filter((h) => h !== trimmed)].slice(0, 20);
    set({ watchIoHistory: history });
    patchPrefs(get, { watchIoHistory: history });
  },
  loadFromDisk: () => set(loadUiPreferences()),
}));
