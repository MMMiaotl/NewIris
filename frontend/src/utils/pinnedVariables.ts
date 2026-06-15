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

export function missingPinnedVariableNames(): string[] {
  const pinned = collectPinnedVariableNames();
  return pinned.filter((name) => !isPinnedVariableLoaded(name));
}

export function pinnedNamesMissingOnBranch(
  branch: string,
  transport: ConnectionTransport,
  pinnedNames: string[],
): boolean {
  return pinnedNames.some((name) => {
    if (isPinnedVariableLoaded(name)) return false;
    return branchPathForVariableName(name, transport) === branch;
  });
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
