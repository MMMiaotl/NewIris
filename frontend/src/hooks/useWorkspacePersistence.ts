import { useLayoutEffect, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';
import {
  collectWorkspaceSnapshot,
  hydrateWorkspaceOnce,
  restoreWorkspaceSnapshotIfMatching,
  writeWorkspaceSnapshot,
  workspaceScope,
} from '../utils/workspacePersistence';
import { collectPinnedVariableNames } from '../utils/pinnedVariables';

const SAVE_DEBOUNCE_MS = 400;

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

/**
 * Short-term workspace memory: selected parameters + plot config in sessionStorage.
 * Does not persist time-series data (seriesData) — only names and plot UI settings.
 */
export function useWorkspacePersistence(): void {
  useLayoutEffect(() => {
    hydrateWorkspaceOnce();
  }, []);

  useEffect(() => {
    const unsubVariable = useVariableStore.subscribe((state, prev) => {
      if (
        state.selectedVariables !== prev.selectedVariables ||
        state.focusedVariable !== prev.focusedVariable
      ) {
        scheduleWorkspaceSave();
        return;
      }
      const pinned = new Set(collectPinnedVariableNames());
      if (!pinned.size) return;
      const valuesChanged = state.variables.some((v) => {
        if (!pinned.has(v.name)) return false;
        const prevVar = prev.variables.find((p) => p.name === v.name);
        return prevVar?.value !== v.value;
      });
      if (valuesChanged) scheduleWorkspaceSave();
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
