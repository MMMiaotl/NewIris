import type { ConnectionTransport } from '../api/types';
import { branchPathForVariableName } from './buildVariableTree';
import { usePlotStore } from '../stores/plotStore';
import { useVariableStore } from '../stores/variableStore';

/** Names restored from workspace or actively pinned in the parameter table / plot. */
export function collectPinnedVariableNames(): string[] {
  const { selectedVariables } = useVariableStore.getState();
  const plotVars = usePlotStore.getState().plotVariables;
  return [...new Set([...selectedVariables, ...plotVars])];
}

export function isPinnedVariableLoaded(name: string): boolean {
  return useVariableStore.getState().variables.some((v) => v.name === name);
}

/** True after server varleaves/update — not sessionStorage cache placeholder. */
export function isPinnedVariableLiveLoaded(name: string): boolean {
  const v = useVariableStore.getState().variables.find((x) => x.name === name);
  if (!v) return false;
  return !v.sessionCacheOnly;
}

export function missingPinnedVariableNames(): string[] {
  const pinned = collectPinnedVariableNames();
  return pinned.filter((name) => !isPinnedVariableLiveLoaded(name));
}

export function pinnedNamesMissingOnBranch(
  branch: string,
  transport: ConnectionTransport,
  pinnedNames: string[],
): boolean {
  return pinnedNames.some((name) => {
    if (isPinnedVariableLiveLoaded(name)) return false;
    return branchPathForVariableName(name, transport) === branch;
  });
}

/** Stop varleaves retry once a branch fetch completed — live values come via monitor update. */
export function clearSessionCacheForPinnedOnBranch(
  branch: string,
  transport: ConnectionTransport,
): void {
  const pinned = new Set(collectPinnedVariableNames());
  if (!pinned.size) return;
  useVariableStore.setState((state) => ({
    variables: state.variables.map((v) => {
      if (!v.sessionCacheOnly || !pinned.has(v.name)) return v;
      if (branchPathForVariableName(v.name, transport) !== branch) return v;
      return { ...v, sessionCacheOnly: false };
    }),
  }));
}

export function collectPinnedVariableValues(): Record<string, string> {
  const pinned = new Set(collectPinnedVariableNames());
  const values: Record<string, string> = {};
  for (const variable of useVariableStore.getState().variables) {
    if (!pinned.has(variable.name)) continue;
    if (variable.value === '') continue;
    values[variable.name] = variable.value;
  }
  return values;
}
