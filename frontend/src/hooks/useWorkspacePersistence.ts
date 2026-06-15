import { useLayoutEffect, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';
import {
  collectWorkspaceSnapshot,
  restoreWorkspaceSnapshotIfMatching,
  writeWorkspaceSnapshot,
  workspaceScope,
} from '../utils/workspacePersistence';

const SAVE_DEBOUNCE_MS = 400;

let restoreDone = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedScope: string | null = null;

function scheduleWorkspaceSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = collectWorkspaceSnapshot();
    lastSavedScope = snapshot.scope;
    writeWorkspaceSnapshot(snapshot);
  }, SAVE_DEBOUNCE_MS);
}

function flushWorkspaceSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const snapshot = collectWorkspaceSnapshot();
  lastSavedScope = snapshot.scope;
  writeWorkspaceSnapshot(snapshot);
}

function ensureRestoredOnce(): void {
  if (restoreDone) return;
  restoreDone = true;
  restoreWorkspaceSnapshotIfMatching();
}

/**
 * Short-term workspace memory: selected parameters + plot config in sessionStorage.
 * Does not persist time-series data (seriesData) — only names and plot UI settings.
 */
export function useWorkspacePersistence(): void {
  useLayoutEffect(() => {
    ensureRestoredOnce();
  }, []);

  useEffect(() => {
    const unsubVariable = useVariableStore.subscribe((state, prev) => {
      if (
        state.selectedVariables !== prev.selectedVariables ||
        state.focusedVariable !== prev.focusedVariable
      ) {
        scheduleWorkspaceSave();
      }
    });

    const unsubPlot = usePlotStore.subscribe((state, prev) => {
      if (
        state.plotVariables !== prev.plotVariables ||
        state.colors !== prev.colors ||
        state.lineWidths !== prev.lineWidths ||
        state.yMin !== prev.yMin ||
        state.yMax !== prev.yMax ||
        state.xWindowSec !== prev.xWindowSec
      ) {
        scheduleWorkspaceSave();
      }
    });

    const unsubConnection = useConnectionStore.subscribe((state, prev) => {
      const scopeChanged = workspaceScope(state.config) !== workspaceScope(prev.config);
      if (scopeChanged) {
        if (lastSavedScope && lastSavedScope !== workspaceScope(state.config)) {
          restoreWorkspaceSnapshotIfMatching();
        }
        scheduleWorkspaceSave();
        return;
      }
      if (state.flatTree !== prev.flatTree || state.viewMode !== prev.viewMode) {
        scheduleWorkspaceSave();
      }
    });

    const onPageHide = () => flushWorkspaceSave();
    window.addEventListener('pagehide', onPageHide);

    return () => {
      unsubVariable();
      unsubPlot();
      unsubConnection();
      window.removeEventListener('pagehide', onPageHide);
      flushWorkspaceSave();
    };
  }, []);
}
