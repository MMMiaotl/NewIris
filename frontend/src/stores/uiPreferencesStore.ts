/**
 * UI preferences mirroring legacy Iris Show Options / Preferences dialogs.
 * Persisted to localStorage; separate from per-connection workspace.
 */
import { create } from 'zustand';
import {
  loadUiPreferences,
  saveUiPreferences,
  type PersistedUiPreferences,
  type TreeLabelMode,
} from '../utils/preferencesPersistence';
import type { SearchMatchOptions } from '../utils/buildVariableTree';

export type { TreeLabelMode };

type SetPrefFn = <K extends keyof PersistedUiPreferences>(
  key: K,
  value: PersistedUiPreferences[K],
) => void;

interface UiPreferencesState extends PersistedUiPreferences {
  setPref: SetPrefFn;
  addWatchIoHistory: (name: string) => void;
  loadFromDisk: () => void;
  // Named helpers keep the external API stable.
  setTreeLabelMode: (mode: TreeLabelMode) => void;
  setDirectFilter: (on: boolean) => void;
  setSearchMatchCase: (on: boolean) => void;
  setSearchMatchWholeWord: (on: boolean) => void;
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
}

export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => {
  const setPref: SetPrefFn = (key, value) => {
    set({ [key]: value } as Pick<PersistedUiPreferences, typeof key>);
    saveUiPreferences({ ...get(), [key]: value });
  };

  return {
    ...loadUiPreferences(),
    setPref,
    addWatchIoHistory: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const watchIoHistory = [
        trimmed,
        ...get().watchIoHistory.filter((h) => h !== trimmed),
      ].slice(0, 20);
      setPref('watchIoHistory', watchIoHistory);
    },
    loadFromDisk: () => set(loadUiPreferences()),
    setTreeLabelMode: (v) => setPref('treeLabelMode', v),
    setDirectFilter: (v) => setPref('directFilter', v),
    setSearchMatchCase: (v) => setPref('searchMatchCase', v),
    setSearchMatchWholeWord: (v) => setPref('searchMatchWholeWord', v),
    setShowFullNameInTable: (v) => setPref('showFullNameInTable', v),
    setShowRegisColumn: (v) => setPref('showRegisColumn', v),
    setShowSourceColumn: (v) => setPref('showSourceColumn', v),
    setTreeSort: (v) => setPref('treeSort', v),
    setPlotGridX: (v) => setPref('plotGridX', v),
    setPlotGridY: (v) => setPref('plotGridY', v),
    setPlotZeroLine: (v) => setPref('plotZeroLine', v),
    setPlotAutoYScale: (v) => setPref('plotAutoYScale', v),
    setPlotNameTruncate: (v) => setPref('plotNameTruncate', v),
    setSessionDescription: (v) => setPref('sessionDescription', v),
    setStartupOpenSession: (v) => setPref('startupOpenSession', v),
    setStartupConnectWatchIo: (v) => setPref('startupConnectWatchIo', v),
  };
});

export function readSearchMatchOptions(): SearchMatchOptions {
  const { searchMatchCase, searchMatchWholeWord } = useUiPreferencesStore.getState();
  return { matchCase: searchMatchCase, matchWholeWord: searchMatchWholeWord };
}
