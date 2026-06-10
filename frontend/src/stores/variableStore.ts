import { create } from 'zustand';
import type { TreeNode, VariableType, WatchIoVariable } from '../api/types';
import { getEntryAttributes } from '../utils/parseAttributes';
import type { WatchIoEntry } from '../api/types';
import { attachVariablesToBranch, filterVariablesByBranch } from '../utils/buildVariableTree';

const KNOWN_VARIABLE_TYPES: ReadonlySet<VariableType> = new Set([
  'int',
  'double',
  'string',
  'array',
  'local',
  'input',
  'output',
  'inout',
]);

function inferType(attrs: Record<string, string>): VariableType {
  const raw = attrs.type?.trim();
  if (!raw) return 'unknown';
  const normalized = raw.toLowerCase() as VariableType;
  return KNOWN_VARIABLE_TYPES.has(normalized) ? normalized : 'unknown';
}

export const MAX_SELECTED_PARAMETERS = 100;

export function createPlaceholderVariable(name: string): WatchIoVariable {
  return {
    name,
    value: '',
    type: 'unknown',
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
  setTreeNodes: (nodes: TreeNode[]) => void;
  setSelectedBranch: (branch: string | null) => void;
  setBranchVarPrefix: (prefix: string | null) => void;
  toggleSelectedVariable: (name: string) => boolean;
  clearSelectedVariables: () => void;
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
  clear: () => void;
}

export const useVariableStore = create<VariableState>((set, get) => ({
  treeNodes: [],
  variables: [],
  registeredNames: new Set(),
  selectedBranch: null,
  branchVarPrefix: null,
  selectedVariables: [],
  setTreeNodes: (treeNodes) => set({ treeNodes }),
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setBranchVarPrefix: (branchVarPrefix) => set({ branchVarPrefix }),
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
  clearSelectedVariables: () => set({ selectedVariables: [] }),
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
      const attrs = getEntryAttributes(entry);
      const prev = existing.get(fullName);
      existing.set(fullName, {
        name: fullName,
        value: entry.value ?? prev?.value ?? '',
        type: inferType(attrs),
        description: attrs.description ?? prev?.description ?? '',
        scale: attrs.scale ?? prev?.scale ?? '',
        registered: get().registeredNames.has(fullName),
        alias: attrs.alias,
      });
    }
    set({ variables: Array.from(existing.values()).sort((a, b) => a.name.localeCompare(b.name)) });
    if (branch) get().attachBranchVariables(branch);
  },
  attachBranchVariables: (branch) => {
    if (!branch) return;
    const { treeNodes, variables, branchVarPrefix } = get();
    const branchVars = filterVariablesByBranch(variables, branch, branchVarPrefix);
    set({
      treeNodes: attachVariablesToBranch(treeNodes, branch, branchVars, branchVarPrefix),
    });
  },
  mergeVarList: (entries) => {
    const list = normalizeEntries(entries);
    const vars: WatchIoVariable[] = list.map((entry) => {
      const attrs = getEntryAttributes(entry);
      return {
        name: entry.name,
        value: entry.value ?? '',
        type: inferType(attrs),
        description: attrs.description ?? '',
        scale: attrs.scale ?? '',
        registered: get().registeredNames.has(entry.name),
        alias: attrs.alias,
      };
    });
    set({ variables: vars.sort((a, b) => a.name.localeCompare(b.name)) });
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
          type: 'unknown',
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
  clear: () =>
    set({
      treeNodes: [],
      variables: [],
      registeredNames: new Set(),
      selectedBranch: null,
      branchVarPrefix: null,
      selectedVariables: [],
    }),
}));
