import { create } from 'zustand';
import type { VariableDisplayOverride } from '../constants/displayFormats';
import { createDefaultDisplayOverride, mergeDisplayOverride } from '../utils/formatVariableValue';

export type { VariableDisplayOverride };

interface DisplayState {
  overrides: Record<string, VariableDisplayOverride>;
  modalOpen: boolean;
  modalFocusVariable: string | null;
  getOverride: (name: string) => VariableDisplayOverride;
  setOverride: (name: string, partial: Partial<VariableDisplayOverride>) => void;
  resetOverride: (name: string) => void;
  applyToVariables: (names: string[], partial: Partial<VariableDisplayOverride>) => void;
  openModal: (focusVariable?: string | null) => void;
  closeModal: () => void;
  loadOverrides: (overrides: Record<string, VariableDisplayOverride>) => void;
  clearAll: () => void;
}

export const useDisplayStore = create<DisplayState>((set, get) => ({
  overrides: {},
  modalOpen: false,
  modalFocusVariable: null,
  getOverride: (name) => mergeDisplayOverride(get().overrides[name]),
  setOverride: (name, partial) => {
    const current = get().getOverride(name);
    set({
      overrides: {
        ...get().overrides,
        [name]: { ...current, ...partial },
      },
    });
  },
  resetOverride: (name) => {
    const { [name]: removed, ...rest } = get().overrides;
    void removed;
    set({ overrides: rest });
  },
  applyToVariables: (names, partial) => {
    const next = { ...get().overrides };
    for (const name of names) {
      const current = next[name] ?? createDefaultDisplayOverride();
      next[name] = { ...current, ...partial };
    }
    set({ overrides: next });
  },
  openModal: (focusVariable) =>
    set({ modalOpen: true, modalFocusVariable: focusVariable ?? null }),
  closeModal: () => set({ modalOpen: false, modalFocusVariable: null }),
  loadOverrides: (overrides) => {
    const normalized: Record<string, VariableDisplayOverride> = {};
    for (const [name, raw] of Object.entries(overrides)) {
      normalized[name] = mergeDisplayOverride(raw);
    }
    set({ overrides: normalized });
  },
  clearAll: () => set({ overrides: {}, modalOpen: false, modalFocusVariable: null }),
}));

/** Read override outside React (plot, persistence). */
export function getVariableDisplayOverride(name: string): VariableDisplayOverride {
  return useDisplayStore.getState().getOverride(name);
}
