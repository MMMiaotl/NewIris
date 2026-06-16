import type { ConnectionTransport } from '../api/types';
import type { MonitorVariable, WatchIoClient } from '../api/watchIoClient';
import { branchPathForVariableName } from './buildVariableTree';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';
import { collectPinnedVariableNames, missingPinnedVariableNames } from './pinnedVariables';

/** Build the desired WatchIO monitor set (selected + plot + toolbar registered). */
export function buildDesiredMonitorVariables(): MonitorVariable[] {
  const { variables, selectedVariables, registeredNames } = useVariableStore.getState();
  const plotVars = usePlotStore.getState().plotVariables;
  const names = new Set([...selectedVariables, ...plotVars, ...registeredNames]);
  return [...names].map((name) => {
    const variable = variables.find((v) => v.name === name);
    return {
      name,
      dataType: variable?.dataType,
      mode: plotVars.includes(name) ? 'value' : 'set',
    };
  });
}

export function monitorVariableKey(v: MonitorVariable): string {
  return `${v.name}:${v.mode ?? 'set'}:${v.dataType ?? ''}`;
}

/** True when varleaves/varinfo populated this row — safe to pass type= to monitor add. */
export function isReadyForMonitor(name: string): boolean {
  const v = useVariableStore.getState().variables.find((x) => x.name === name);
  return v?.serverMetadataLoaded === true;
}

export function pinnedMetadataReady(): boolean {
  const pinned = collectPinnedVariableNames();
  if (!pinned.length) return true;
  return missingPinnedVariableNames().length === 0;
}

/**
 * Sync server monitor via add/delete only — never type:list (list resets live update stream).
 * Returns true when at least one add/remove was sent.
 */
export function syncWatchIoMonitorDiff(
  client: WatchIoClient,
  serverMonitored: Map<string, MonitorVariable>,
  desired: MonitorVariable[],
): boolean {
  const desiredMap = new Map<string, MonitorVariable>();
  for (const v of desired) {
    if (!isReadyForMonitor(v.name)) continue;
    desiredMap.set(v.name, v);
  }

  let changed = false;

  for (const name of [...serverMonitored.keys()]) {
    if (!desiredMap.has(name)) {
      client.removeVariable(name);
      serverMonitored.delete(name);
      changed = true;
    }
  }

  for (const v of desiredMap.values()) {
    const prev = serverMonitored.get(v.name);
    const nextKey = monitorVariableKey(v);
    const prevKey = prev ? monitorVariableKey(prev) : '';
    if (!prev) {
      client.addVariable(v.name, v.mode ?? 'set', v.dataType);
      serverMonitored.set(v.name, v);
      changed = true;
    } else if (nextKey !== prevKey) {
      client.removeVariable(v.name);
      client.addVariable(v.name, v.mode ?? 'set', v.dataType);
      serverMonitored.set(v.name, v);
      changed = true;
    }
  }

  return changed;
}

export interface PinnedLivePipelineState {
  serverMonitored: Map<string, MonitorVariable>;
  /** Branches with varleaves in flight for pinned metadata recovery. */
  pendingBranches: Set<string>;
}

/**
 * Single pinned-live orchestrator: branch varleaves → incremental monitor add → requestUpdate.
 * Uses varleaves (not varinfo) — SmcControl1 STOMP often does not reply to varinfo.
 */
export function runPinnedLivePipeline(
  client: WatchIoClient | null,
  state: PinnedLivePipelineState,
  transport: ConnectionTransport,
): 'loading-metadata' | 'synced' | 'idle' {
  if (!client) return 'idle';

  const missing = missingPinnedVariableNames();
  if (missing.length > 0) {
    const branches = new Set<string>();
    for (const name of missing) {
      const branch = branchPathForVariableName(name, transport);
      if (branch) branches.add(branch);
    }
    for (const branch of branches) {
      if (state.pendingBranches.has(branch)) continue;
      state.pendingBranches.add(branch);
      client.fetchVarLeaves(branch, true, true);
    }
    return 'loading-metadata';
  }

  state.pendingBranches.clear();

  if (!pinnedMetadataReady()) return 'idle';

  const desired = buildDesiredMonitorVariables();
  if (!desired.length) return 'idle';

  const changed = syncWatchIoMonitorDiff(client, state.serverMonitored, desired);
  if (changed) {
    client.requestUpdate();
    refreshPinnedMetadataInBackground(client, transport);
    return 'synced';
  }
  return 'idle';
}

/** Low-priority varleaves to refresh metadata after a fast monitor add from workspace cache. */
export function refreshPinnedMetadataInBackground(
  client: WatchIoClient,
  transport: ConnectionTransport,
): void {
  const branches = new Set<string>();
  for (const name of collectPinnedVariableNames()) {
    const branch = branchPathForVariableName(name, transport);
    if (branch) branches.add(branch);
  }
  for (const branch of branches) {
    client.fetchVarLeaves(branch, true, false);
  }
}

export function clearPinnedBranchPending(state: PinnedLivePipelineState, branch: string | null): void {
  if (branch) state.pendingBranches.delete(branch);
}
