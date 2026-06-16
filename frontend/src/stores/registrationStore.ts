/**
 * Registration store — accumulates variable samples in memory and flushes them
 * to a downloadable JSON Lines (.nirislog) file on stop or manual save.
 *
 * One registration line per sample tick; optionally skips lines where nothing
 * changed (changesOnly).  The store is deliberately separate from sessionStore
 * so replay and registration can run concurrently.
 */
import { create } from 'zustand';
import type { RegistrationLine, RegistrationSettings, RegistrationState } from '../api/types';

const DEFAULT_SETTINGS: RegistrationSettings = {
  filename: 'registration',
  autoIncrementNumber: true,
  includeTimestamp: true,
  changesOnly: false,
  sampleIntervalMs: 0,
};

interface RegistrationStore extends RegistrationState {
  startRegistration: (variables: string[], settings?: Partial<RegistrationSettings>) => void;
  stopRegistration: () => RegistrationLine[];
  pauseRegistration: () => void;
  resumeRegistration: () => void;
  appendLine: (values: Record<string, string>) => void;
  updateSettings: (patch: Partial<RegistrationSettings>) => void;
  setVariables: (variables: string[]) => void;
  clearLines: () => void;
}

export const useRegistrationStore = create<RegistrationStore>((set, get) => ({
  active: false,
  paused: false,
  lines: [],
  startedAt: 0,
  variables: [],
  settings: { ...DEFAULT_SETTINGS },

  startRegistration: (variables, settings) =>
    set({
      active: true,
      paused: false,
      lines: [],
      startedAt: Date.now(),
      variables,
      settings: { ...DEFAULT_SETTINGS, ...settings },
    }),

  stopRegistration: () => {
    const lines = get().lines;
    set({ active: false, paused: false });
    return lines;
  },

  pauseRegistration: () => set({ paused: true }),

  resumeRegistration: () => set({ paused: false }),

  appendLine: (values) => {
    const { active, paused, lines, startedAt, settings } = get();
    if (!active || paused) return;

    if (settings.changesOnly && lines.length > 0) {
      const prev = lines[lines.length - 1].values;
      const changed = Object.keys(values).some((k) => values[k] !== prev[k]);
      if (!changed) return;
    }

    const line: RegistrationLine = {
      t: Date.now() - startedAt,
      values,
    };
    set({ lines: [...lines, line] });
  },

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  setVariables: (variables) => set({ variables }),

  clearLines: () => set({ lines: [] }),
}));
