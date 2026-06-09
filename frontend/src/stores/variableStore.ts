import { create } from 'zustand';
import type { TreeNode, VariableType, WatchIoVariable } from '../api/types';
import { getEntryAttributes } from '../utils/parseAttributes';
import type { WatchIoEntry } from '../api/types';

function inferType(attrs: Record<string, string>): VariableType {
  const t = attrs.type ?? 'unknown';
  if (t === 'int' || t === 'double' || t === 'string' || t === 'array') return t;
  return 'unknown';
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
  selectedVariable: string | null;
  setTreeNodes: (nodes: TreeNode[]) => void;
  setSelectedBranch: (branch: string | null) => void;
  setBranchVarPrefix: (prefix: string | null) => void;
  setSelectedVariable: (name: string | null) => void;
  mergeVarLeaves: (entries: WatchIoEntry[], branchOverride?: string | null) => void;
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
  selectedVariable: null,
  setTreeNodes: (treeNodes) => set({ treeNodes }),
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setBranchVarPrefix: (branchVarPrefix) => set({ branchVarPrefix }),
  setSelectedVariable: (selectedVariable) => set({ selectedVariable }),
  mergeVarLeaves: (entries, branchOverride) => {
    const list = normalizeEntries(entries);
    const branch = branchOverride ?? get().selectedBranch;
    const isSmcBranch = Boolean(branch?.includes('/'));
    const varPrefix = get().branchVarPrefix ?? '';
    const prefix =
      isSmcBranch && varPrefix
        ? varPrefix
        : branch && branch !== '.'
          ? `${branch}.`
          : '';
    const kept = get().variables.filter(
      (v) => !prefix || (!v.name.startsWith(prefix) && v.name !== branch),
    );
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
      selectedVariable: null,
    }),
}));
