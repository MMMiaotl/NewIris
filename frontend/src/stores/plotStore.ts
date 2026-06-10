import { create } from 'zustand';
import { useConnectionStore } from './connectionStore';
import { useVariableStore } from './variableStore';

const PLOT_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#ffd54f', '#90a4ae'];

export const DEFAULT_PLOT_X_WINDOW_SEC = 600;
const MIN_PLOT_X_WINDOW_SEC = 30;
const MAX_PLOT_X_WINDOW_SEC = 3600;

function clampXWindowSec(seconds: number): number {
  return Math.max(MIN_PLOT_X_WINDOW_SEC, Math.min(MAX_PLOT_X_WINDOW_SEC, seconds));
}

function maxPointsForWindow(xWindowSec: number): number {
  const sampleInterval = useConnectionStore.getState().config.sampleInterval;
  const intervalSec = Math.max(0.05, sampleInterval / 1000);
  return Math.ceil(xWindowSec / intervalSec) + 20;
}

interface PlotState {
  plotVariables: string[];
  colors: Record<string, string>;
  yMin: number;
  yMax: number;
  /** Fixed rolling X-axis window width in seconds (default 10 minutes). */
  xWindowSec: number;
  seriesData: Record<string, { t: number; v: number }[]>;
  plotStartMs: number | null;
  maxPoints: number;
  addPlotVariable: (name: string) => void;
  removePlotVariable: (name: string) => void;
  setYRange: (min: number, max: number) => void;
  setXWindowSec: (seconds: number) => void;
  scaleYRange: (factor: number) => void;
  setColor: (name: string, color: string) => void;
  /** Append a sample; optional tMs is epoch ms (replay); live mode uses Date.now(). */
  appendPoint: (name: string, value: string, tMs?: number) => void;
  clearSeries: () => void;
  loadPlotConfig: (
    vars: string[],
    colors: Record<string, string>,
    min: number,
    max: number,
    xWindowSec?: number,
  ) => void;
}

export const usePlotStore = create<PlotState>((set, get) => ({
  plotVariables: [],
  colors: {},
  yMin: -10,
  yMax: 10,
  xWindowSec: DEFAULT_PLOT_X_WINDOW_SEC,
  seriesData: {},
  plotStartMs: null,
  maxPoints: maxPointsForWindow(DEFAULT_PLOT_X_WINDOW_SEC),
  addPlotVariable: (name) => {
    const plotVariables = get().plotVariables;
    if (plotVariables.includes(name) || plotVariables.length >= 8) return;
    const colors = { ...get().colors };
    colors[name] = PLOT_COLORS[plotVariables.length % PLOT_COLORS.length];
    set({
      plotVariables: [...plotVariables, name],
      colors,
      seriesData: { ...get().seriesData, [name]: get().seriesData[name] ?? [] },
    });
    const current = useVariableStore.getState().variables.find((v) => v.name === name);
    if (current?.value) {
      get().appendPoint(name, current.value);
    }
  },
  removePlotVariable: (name) => {
    const { [name]: _, ...seriesData } = get().seriesData;
    const { [name]: __, ...colors } = get().colors;
    set({
      plotVariables: get().plotVariables.filter((v) => v !== name),
      colors,
      seriesData,
    });
  },
  setYRange: (yMin, yMax) => set({ yMin, yMax }),
  setXWindowSec: (seconds) => {
    const xWindowSec = clampXWindowSec(seconds);
    set({ xWindowSec, maxPoints: maxPointsForWindow(xWindowSec) });
  },
  scaleYRange: (factor) => {
    const mid = (get().yMin + get().yMax) / 2;
    const half = ((get().yMax - get().yMin) / 2) * factor;
    set({ yMin: mid - half, yMax: mid + half });
  },
  setColor: (name, color) => set({ colors: { ...get().colors, [name]: color } }),
  appendPoint: (name, value, tMs) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    const sampleMs = tMs ?? Date.now();
    const state = get();
    const plotStartMs = state.plotStartMs ?? sampleMs;
    const t = (sampleMs - plotStartMs) / 1000;
    const arr = [...(state.seriesData[name] ?? []), { t, v: num }];
    if (arr.length > state.maxPoints) arr.splice(0, arr.length - state.maxPoints);
    set({
      plotStartMs: state.plotStartMs ?? plotStartMs,
      seriesData: { ...state.seriesData, [name]: arr },
    });
  },
  clearSeries: () => set({ seriesData: {}, plotStartMs: null }),
  loadPlotConfig: (plotVariables, colors, yMin, yMax, xWindowSec) => {
    const windowSec = clampXWindowSec(xWindowSec ?? get().xWindowSec);
    set({
      plotVariables,
      colors,
      yMin,
      yMax,
      xWindowSec: windowSec,
      maxPoints: maxPointsForWindow(windowSec),
      seriesData: {},
      plotStartMs: null,
    });
  },
}));
