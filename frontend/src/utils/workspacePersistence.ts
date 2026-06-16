import type { ConnectionConfig, ViewMode, VariableDisplayOverride } from '../api/types';
import { useConnectionStore } from '../stores/connectionStore';
import { useDisplayStore } from '../stores/displayStore';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';
import { collectPinnedVariableValues } from './pinnedVariables';

/** sessionStorage: survives refresh, cleared when the tab closes. */
export const WORKSPACE_STORAGE_KEY = 'newiris-workspace-v1';

export interface WorkspaceSnapshot {
  version: 1;
  /** transport|host|serverPath|watchIoName — avoid restoring vars for another instance. */
  scope: string;
  savedAt: number;
  selectedVariables: string[];
  focusedVariable: string | null;
  plotVariables: string[];
  plotColors: Record<string, string>;
  plotLineWidths: Record<string, number>;
  plotMin: number;
  plotMax: number;
  plotXWindowSec: number;
  flatTree: boolean;
  viewMode: ViewMode;
  /** Last known values for pinned parameters — small cache for refresh display. */
  pinnedValues?: Record<string, string>;
  /** Client-side display overrides (style, unit, custom name). */
  displayOverrides?: Record<string, VariableDisplayOverride>;
}

export function workspaceScope(config: ConnectionConfig): string {
  return [config.transport, config.hostAddress, config.serverPath, config.watchIoName].join('|');
}

export function collectWorkspaceSnapshot(): WorkspaceSnapshot {
  const { config, flatTree, viewMode } = useConnectionStore.getState();
  const { selectedVariables, focusedVariable } = useVariableStore.getState();
  const {
    plotVariables,
    colors,
    lineWidths,
    yMin,
    yMax,
    xWindowSec,
  } = usePlotStore.getState();
  const { overrides } = useDisplayStore.getState();

  return {
    version: 1,
    scope: workspaceScope(config),
    savedAt: Date.now(),
    selectedVariables: [...selectedVariables],
    focusedVariable,
    plotVariables: [...plotVariables],
    plotColors: { ...colors },
    plotLineWidths: { ...lineWidths },
    plotMin: yMin,
    plotMax: yMax,
    plotXWindowSec: xWindowSec,
    flatTree,
    viewMode,
    pinnedValues: collectPinnedVariableValues(),
    displayOverrides: { ...overrides },
  };
}

function parseSnapshot(raw: string): WorkspaceSnapshot | null {
  try {
    const data = JSON.parse(raw) as WorkspaceSnapshot;
    if (data.version !== 1 || typeof data.scope !== 'string') return null;
    if (!Array.isArray(data.selectedVariables) || !Array.isArray(data.plotVariables)) return null;
    return data;
  } catch {
    return null;
  }
}

export function readWorkspaceSnapshot(): WorkspaceSnapshot | null {
  try {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    return parseSnapshot(raw);
  } catch {
    return null;
  }
}

export function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  try {
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota exceeded or private mode — ignore silently.
  }
}

export function clearWorkspaceSnapshot(): void {
  try {
    sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

let workspaceHydrated = false;

/** Restore workspace once per page load (main.tsx + hook share this guard). */
export function hydrateWorkspaceOnce(): boolean {
  if (workspaceHydrated) return false;
  workspaceHydrated = true;
  return restoreWorkspaceSnapshotIfMatching();
}

/** Restore selection/plot UI if snapshot matches current connection scope. Returns true if applied. */
export function restoreWorkspaceSnapshotIfMatching(): boolean {
  const snapshot = readWorkspaceSnapshot();
  if (!snapshot) return false;

  const scope = workspaceScope(useConnectionStore.getState().config);
  if (snapshot.scope !== scope) return false;

  useVariableStore.getState().restoreWorkspaceSelection(
    snapshot.selectedVariables,
    snapshot.focusedVariable,
  );

  if (snapshot.pinnedValues && Object.keys(snapshot.pinnedValues).length) {
    useVariableStore.getState().seedPinnedVariableCache(snapshot.pinnedValues);
  }

  const plot = usePlotStore.getState();
  const yMin = typeof snapshot.plotMin === 'number' ? snapshot.plotMin : -10;
  const yMax = typeof snapshot.plotMax === 'number' ? snapshot.plotMax : 10;
  const xWindowSec =
    typeof snapshot.plotXWindowSec === 'number'
      ? snapshot.plotXWindowSec
      : plot.xWindowSec;
  plot.loadPlotConfig(
    snapshot.plotVariables,
    snapshot.plotColors,
    yMin,
    yMax,
    xWindowSec,
    snapshot.plotLineWidths,
  );

  if (snapshot.displayOverrides && Object.keys(snapshot.displayOverrides).length) {
    useDisplayStore.getState().loadOverrides(snapshot.displayOverrides);
  }

  useConnectionStore.setState({
    flatTree: snapshot.flatTree,
    viewMode: snapshot.viewMode,
  });

  return true;
}
