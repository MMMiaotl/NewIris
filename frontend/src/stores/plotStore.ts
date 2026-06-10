import { create } from 'zustand';
import { useConnectionStore } from './connectionStore';
import { useVariableStore } from './variableStore';
import { trimSeriesPoints } from '../utils/plotTime';

const PLOT_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#ffd54f', '#90a4ae'];

/** Epoch ms when the frontend plot timeline starts (t = 0). */
export const PLOT_INIT_MS = Date.now();

export const DEFAULT_PLOT_LINE_WIDTH = 1;
export const PLOT_LINE_WIDTH_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6] as const;

const MIN_PLOT_LINE_WIDTH = PLOT_LINE_WIDTH_OPTIONS[0];
const MAX_PLOT_LINE_WIDTH = PLOT_LINE_WIDTH_OPTIONS[PLOT_LINE_WIDTH_OPTIONS.length - 1];

export function snapPlotLineWidth(width: number): number {
  return PLOT_LINE_WIDTH_OPTIONS.reduce((best, option) =>
    Math.abs(option - width) < Math.abs(best - width) ? option : best,
  );
}

function clampLineWidth(width: number): number {
  return snapPlotLineWidth(
    Math.max(MIN_PLOT_LINE_WIDTH, Math.min(MAX_PLOT_LINE_WIDTH, width)),
  );
}

export const DEFAULT_PLOT_X_WINDOW_SEC = 600;
const MIN_PLOT_X_WINDOW_SEC = 30;
const MAX_PLOT_X_WINDOW_SEC = 3600;

function clampXWindowSec(seconds: number): number {
  return Math.max(MIN_PLOT_X_WINDOW_SEC, Math.min(MAX_PLOT_X_WINDOW_SEC, seconds));
}

function maxPointsForStore(): number {
  const sampleInterval = useConnectionStore.getState().config.sampleInterval;
  const intervalSec = Math.max(0.05, sampleInterval / 1000);
  return Math.ceil(MAX_PLOT_X_WINDOW_SEC / intervalSec) + 50;
}

interface PlotState {
  plotVariables: string[];
  colors: Record<string, string>;
  lineWidths: Record<string, number>;
  yMin: number;
  yMax: number;
  /** Fixed rolling X-axis window width in seconds (default 10 minutes). */
  xWindowSec: number;
  seriesData: Record<string, { t: number; v: number }[]>;
  /** Epoch ms for plot t = 0 (frontend init, or replay recording start). */
  plotInitMs: number;
  maxPoints: number;
  addPlotVariable: (name: string) => void;
  removePlotVariable: (name: string) => void;
  setYRange: (min: number, max: number) => void;
  setXWindowSec: (seconds: number) => void;
  scaleYRange: (factor: number) => void;
  setColor: (name: string, color: string) => void;
  setLineWidth: (name: string, width: number) => void;
  /** Append a sample; optional tMs is epoch ms (replay); live mode uses Date.now(). */
  appendPoint: (name: string, value: string, tMs?: number) => void;
  clearSeries: () => void;
  /** Reset plot timeline origin (e.g. replay load). */
  setPlotInitMs: (ms: number) => void;
  loadPlotConfig: (
    vars: string[],
    colors: Record<string, string>,
    min: number,
    max: number,
    xWindowSec?: number,
    lineWidths?: Record<string, number>,
  ) => void;
}

export const usePlotStore = create<PlotState>((set, get) => ({
  plotVariables: [],
  colors: {},
  lineWidths: {},
  yMin: -10,
  yMax: 10,
  xWindowSec: DEFAULT_PLOT_X_WINDOW_SEC,
  seriesData: {},
  plotInitMs: PLOT_INIT_MS,
  maxPoints: maxPointsForStore(),
  addPlotVariable: (name) => {
    const plotVariables = get().plotVariables;
    if (plotVariables.includes(name) || plotVariables.length >= 8) return;
    const colors = { ...get().colors };
    colors[name] = PLOT_COLORS[plotVariables.length % PLOT_COLORS.length];
    const lineWidths = { ...get().lineWidths, [name]: DEFAULT_PLOT_LINE_WIDTH };
    set({
      plotVariables: [...plotVariables, name],
      colors,
      lineWidths,
      seriesData: { ...get().seriesData, [name]: get().seriesData[name] ?? [] },
    });
    const current = useVariableStore.getState().variables.find((v) => v.name === name);
    if (current?.value) {
      get().appendPoint(name, current.value);
    }
  },
  removePlotVariable: (name) => {
    const { [name]: _series, ...seriesData } = get().seriesData;
    const { [name]: _color, ...colors } = get().colors;
    const { [name]: _width, ...lineWidths } = get().lineWidths;
    set({
      plotVariables: get().plotVariables.filter((v) => v !== name),
      colors,
      lineWidths,
      seriesData,
    });
  },
  setYRange: (yMin, yMax) => set({ yMin, yMax }),
  setXWindowSec: (seconds) => {
    set({ xWindowSec: clampXWindowSec(seconds) });
  },
  scaleYRange: (factor) => {
    const mid = (get().yMin + get().yMax) / 2;
    const half = ((get().yMax - get().yMin) / 2) * factor;
    set({ yMin: mid - half, yMax: mid + half });
  },
  setColor: (name, color) => set({ colors: { ...get().colors, [name]: color } }),
  setLineWidth: (name, width) =>
    set({ lineWidths: { ...get().lineWidths, [name]: clampLineWidth(width) } }),
  appendPoint: (name, value, tMs) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    const sampleMs = tMs ?? Date.now();
    const state = get();
    const t = (sampleMs - state.plotInitMs) / 1000;
    if (t < 0) return;
    const prev = state.seriesData[name] ?? [];
    const last = prev[prev.length - 1];
    const merged =
      last && last.t === t
        ? [...prev.slice(0, -1), { t, v: num }]
        : [...prev, { t, v: num }];
    const arr = trimSeriesPoints(merged, state.maxPoints);
    set({
      seriesData: { ...state.seriesData, [name]: arr },
    });
  },
  clearSeries: () => set({ seriesData: {} }),
  setPlotInitMs: (plotInitMs) => set({ plotInitMs, seriesData: {} }),
  loadPlotConfig: (plotVariables, colors, yMin, yMax, xWindowSec, lineWidths) => {
    const windowSec = clampXWindowSec(xWindowSec ?? get().xWindowSec);
    const nextLineWidths: Record<string, number> = {};
    for (const name of plotVariables) {
      nextLineWidths[name] = clampLineWidth(lineWidths?.[name] ?? DEFAULT_PLOT_LINE_WIDTH);
    }
    set({
      plotVariables,
      colors,
      lineWidths: nextLineWidths,
      yMin,
      yMax,
      xWindowSec: windowSec,
      seriesData: {},
    });
  },
}));
