import { create } from 'zustand';
import type { TreeNode, VariableType, WatchIoVariable } from '../api/types';
import { getEntryAttributes } from '../utils/parseAttributes';
import type { WatchIoEntry } from '../api/types';
import {
  attachVariablesToBranch,
  filterVariablesByBranch,
  groupVariablesByParentBranch,
  stripVariableLeavesInBranchScope,
  variableNameMatchesSearch,
} from '../utils/buildVariableTree';
import { useConnectionStore } from './connectionStore';

function normalizeDataType(raw?: string): VariableType {
  const t = raw?.trim().toLowerCase();
  if (t === 'int' || t === 'double' || t === 'string' || t === 'array') return t;
  return 'unknown';
}

function buildWatchIoVariable(
  fullName: string,
  entry: WatchIoEntry,
  prev: WatchIoVariable | undefined,
  registered: boolean,
): WatchIoVariable {
  const attrs = getEntryAttributes(entry);
  return {
    name: fullName,
    value: entry.value ?? prev?.value ?? '',
    varKind: attrs.varKind ?? prev?.varKind ?? '',
    dataType: attrs.dataType ? normalizeDataType(attrs.dataType) : (prev?.dataType ?? 'unknown'),
    description: attrs.description ?? prev?.description ?? '',
    scale: attrs.scale ?? prev?.scale ?? '',
    registered,
    alias: attrs.alias ?? prev?.alias,
  };
}

export const MAX_SELECTED_PARAMETERS = 100;

export function createPlaceholderVariable(name: string): WatchIoVariable {
  return {
    name,
    value: '',
    varKind: '',
    dataType: 'unknown',
    description: '',
    scale: '',
    registered: false,
  };
}

function pinnedVariableNames(state: VariableState): Set<string> {
  return new Set([...state.selectedVariables, ...state.registeredNames]);
}

function normalizeEntries(entries: WatchIoEntry[] | Record<string, string> | undefined): WatchIoEntry[] {
  if (!entries) return [];
  if (Array.isArray(entries)) return entries;
  return Object.entries(entries).map(([name, value]) => ({ name, value }));
}

interface VariableState {
  treeNodes: TreeNode[];
  variables: WatchIoVariable[];
  registeredNames: Set<string>;
  selectedBranch: string | null;
  /** WatchIO dotted prefix for the selected SmcServer object (e.g. C.Filter.Surge.Coefs.) */
  branchVarPrefix: string | null;
  selectedVariables: string[];
  /** Variable shown in the Control drawer (View tab). */
  focusedVariable: string | null;
  /** Full varlist names for active tree filter (not merged into variables). */
  searchVarlistIndex: string[] | null;
  setTreeNodes: (nodes: TreeNode[]) => void;
  setSelectedBranch: (branch: string | null) => void;
  setBranchVarPrefix: (prefix: string | null) => void;
  setFocusedVariable: (name: string | null) => void;
  toggleSelectedVariable: (name: string) => boolean;
  removeSelectedVariable: (name: string) => void;
  moveSelectedVariable: (name: string, direction: 'up' | 'down') => void;
  insertSelectedVariable: (name: string) => void;
  clearSelectedVariables: () => void;
  /** Restore parameter list after refresh; does not load variable values. */
  restoreWorkspaceSelection: (
    selectedVariables: string[],
    focusedVariable: string | null,
  ) => void;
  /** Drop cached tree/leaves; keep selected parameters (reconnect / refresh). */
  clearConnectionCache: (keepVariableNames?: Iterable<string>) => void;
  /** Seed table rows from sessionStorage until live values arrive. */
  seedPinnedVariableCache: (values: Record<string, string>) => void;
  mergeVarLeaves: (
    entries: WatchIoEntry[],
    branchOverride?: string | null,
    varPrefixOverride?: string | null,
  ) => void;
  attachBranchVariables: (branch: string) => void;
  mergeVarList: (entries: WatchIoEntry[]) => void;
  applyUpdate: (entries: WatchIoEntry[]) => void;
  setRegistered: (name: string, registered: boolean) => void;
  updateLocalValue: (name: string, value: string) => void;
  setSearchVarlistIndex: (names: string[] | null) => void;
  clear: () => void;
}

export const useVariableStore = create<VariableState>((set, get) => ({
  treeNodes: [],
  variables: [],
  registeredNames: new Set(),
  selectedBranch: null,
  branchVarPrefix: null,
  selectedVariables: [],
  focusedVariable: null,
  searchVarlistIndex: null,
  setTreeNodes: (treeNodes) => set({ treeNodes }),
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setBranchVarPrefix: (branchVarPrefix) => set({ branchVarPrefix }),
  setFocusedVariable: (focusedVariable) => set({ focusedVariable }),
  toggleSelectedVariable: (name) => {
    const current = get().selectedVariables;
    if (current.includes(name)) {
      set({ selectedVariables: current.filter((n) => n !== name) });
      return true;
    }
    if (current.length >= MAX_SELECTED_PARAMETERS) return false;
    set({ selectedVariables: [...current, name] });
    return true;
  },
  removeSelectedVariable: (name) => {
    const selectedVariables = get().selectedVariables.filter((n) => n !== name);
    const focusedVariable =
      get().focusedVariable === name ? null : get().focusedVariable;
    set({ selectedVariables, focusedVariable });
  },
  moveSelectedVariable: (name, direction) => {
    const list = [...get().selectedVariables];
    const index = list.indexOf(name);
    if (index < 0) return;
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= list.length) return;
    [list[index], list[swap]] = [list[swap], list[index]];
    set({ selectedVariables: list });
  },
  insertSelectedVariable: (name) => {
    const current = get().selectedVariables;
    if (current.includes(name)) return;
    if (current.length >= MAX_SELECTED_PARAMETERS) return;
    const focused = get().focusedVariable;
    if (!focused || !current.includes(focused)) {
      set({ selectedVariables: [...current, name] });
      return;
    }
    const index = current.indexOf(focused);
    const next = [...current];
    next.splice(index + 1, 0, name);
    set({ selectedVariables: next });
  },
  clearSelectedVariables: () => set({ selectedVariables: [], focusedVariable: null }),
  restoreWorkspaceSelection: (selectedVariables, focusedVariable) => {
    const capped = selectedVariables.slice(0, MAX_SELECTED_PARAMETERS);
    const focused =
      focusedVariable && capped.includes(focusedVariable) ? focusedVariable : null;
    set({ selectedVariables: capped, focusedVariable: focused });
  },
  seedPinnedVariableCache: (values) => {
    const names = Object.keys(values);
    if (!names.length) return;
    const map = new Map(get().variables.map((v) => [v.name, v]));
    for (const name of names) {
      const cached = values[name];
      if (cached === undefined || cached === '') continue;
      const prev = map.get(name);
      map.set(
        name,
        prev
          ? { ...prev, value: cached }
          : {
              name,
              value: cached,
              varKind: '',
              dataType: 'unknown',
              description: '',
              scale: '',
              registered: false,
            },
      );
    }
    set({ variables: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)) });
  },
  clearConnectionCache: (keepVariableNames) => {
    const keep = keepVariableNames ? new Set(keepVariableNames) : new Set<string>();
    const kept = keep.size ? get().variables.filter((v) => keep.has(v.name)) : [];
    set({
      treeNodes: [],
      variables: kept,
      registeredNames: new Set(),
      selectedBranch: null,
      branchVarPrefix: null,
      searchVarlistIndex: null,
    });
  },
  mergeVarLeaves: (entries, branchOverride, varPrefixOverride) => {
    const list = normalizeEntries(entries);
    const branch = branchOverride ?? get().selectedBranch;
    const isSmcBranch = Boolean(branch?.includes('/'));
    const varPrefix = varPrefixOverride ?? get().branchVarPrefix ?? '';
    const prefix =
      isSmcBranch && varPrefix
        ? varPrefix
        : branch && branch !== '.'
          ? `${branch}.`
          : '';
    const pinned = pinnedVariableNames(get());
    const kept = get().variables.filter((v) => {
      if (pinned.has(v.name)) return true;
      if (!prefix) return true;
      return !v.name.startsWith(prefix) && v.name !== branch;
    });
    const existing = new Map(kept.map((v) => [v.name, v]));
    for (const entry of list) {
      const fullName =
        isSmcBranch || entry.name.includes('.') || !branch || branch === '.'
          ? entry.name
          : `${branch}.${entry.name}`;
      const prev = existing.get(fullName);
      existing.set(
        fullName,
        buildWatchIoVariable(fullName, entry, prev, get().registeredNames.has(fullName)),
      );
    }
    set({ variables: Array.from(existing.values()).sort((a, b) => a.name.localeCompare(b.name)) });
    if (branch) get().attachBranchVariables(branch);
  },
  attachBranchVariables: (branch) => {
    if (!branch) return;
    const { treeNodes, variables, branchVarPrefix } = get();
    let branchVars = filterVariablesByBranch(variables, branch, branchVarPrefix);
    const searchQuery = useConnectionStore.getState().searchQuery.trim();
    if (searchQuery) {
      branchVars = branchVars.filter((v) => variableNameMatchesSearch(v.name, searchQuery));
    }
    const byParent = groupVariablesByParentBranch(branchVars);
    let nextTree = stripVariableLeavesInBranchScope(treeNodes, branch);
    for (const [parentBranch, vars] of byParent) {
      nextTree = attachVariablesToBranch(nextTree, parentBranch, vars, branchVarPrefix);
    }
    set({ treeNodes: nextTree });
  },
  mergeVarList: (entries) => {
    const list = normalizeEntries(entries);
    const map = new Map(get().variables.map((v) => [v.name, v]));
    for (const entry of list) {
      const prev = map.get(entry.name);
      map.set(
        entry.name,
        buildWatchIoVariable(entry.name, entry, prev, get().registeredNames.has(entry.name)),
      );
    }
    set({ variables: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)) });
  },
  applyUpdate: (entries) => {
    const list = normalizeEntries(entries);
    const map = new Map(get().variables.map((v) => [v.name, v]));
    for (const entry of list) {
      const prev = map.get(entry.name);
      if (prev) map.set(entry.name, { ...prev, value: entry.value ?? prev.value });
      else {
        map.set(entry.name, {
          name: entry.name,
          value: entry.value ?? '',
          varKind: '',
          dataType: 'unknown',
          description: '',
          scale: '',
          registered: get().registeredNames.has(entry.name),
        });
      }
    }
    set({ variables: Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)) });
  },
  setRegistered: (name, registered) => {
    const registeredNames = new Set(get().registeredNames);
    if (registered) registeredNames.add(name);
    else registeredNames.delete(name);
    set({
      registeredNames,
      variables: get().variables.map((v) =>
        v.name === name ? { ...v, registered } : v,
      ),
    });
  },
  updateLocalValue: (name, value) => {
    set({
      variables: get().variables.map((v) => (v.name === name ? { ...v, value } : v)),
    });
  },
  setSearchVarlistIndex: (searchVarlistIndex) => set({ searchVarlistIndex }),
  clear: () =>
    set({
      treeNodes: [],
      variables: [],
      registeredNames: new Set(),
      selectedBranch: null,
      branchVarPrefix: null,
      selectedVariables: [],
      focusedVariable: null,
      searchVarlistIndex: null,
    }),
}));
