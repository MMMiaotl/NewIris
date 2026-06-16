import { create } from 'zustand';
import { useConnectionStore } from './connectionStore';
import { useVariableStore } from './variableStore';
import { trimSeriesPoints, MAX_PLOT_RETENTION_SEC, type PlotPoint, collectPlotTimes, latestPlotTimeSec } from '../utils/plotTime';
import { workspaceScope } from '../utils/workspaceScope';
import { WORKSPACE_STORAGE_KEY } from '../utils/workspacePersistence';

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

/** Read persisted Y range before first render — avoids a frame at hardcoded defaults. */
function readInitialPlotScales(): { yMin: number; yMax: number; xWindowSec: number } {
  const defaults = { yMin: -10, yMax: 10, xWindowSec: DEFAULT_PLOT_X_WINDOW_SEC };
  try {
    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return defaults;
    const snapshot = JSON.parse(raw) as {
      scope?: string;
      plotMin?: number;
      plotMax?: number;
      plotXWindowSec?: number;
    };
    const scope = workspaceScope(useConnectionStore.getState().config);
    if (snapshot.scope !== scope) return defaults;
    return {
      yMin: typeof snapshot.plotMin === 'number' ? snapshot.plotMin : defaults.yMin,
      yMax: typeof snapshot.plotMax === 'number' ? snapshot.plotMax : defaults.yMax,
      xWindowSec:
        typeof snapshot.plotXWindowSec === 'number' ? snapshot.plotXWindowSec : defaults.xWindowSec,
    };
  } catch {
    return defaults;
  }
}

const initialPlotScales = readInitialPlotScales();

function clampXWindowSec(seconds: number): number {
  return Math.max(MIN_PLOT_X_WINDOW_SEC, Math.min(MAX_PLOT_X_WINDOW_SEC, seconds));
}

function maxPointsForStore(): number {
  const sampleInterval = useConnectionStore.getState().config.sampleInterval;
  const intervalSec = Math.max(0.05, sampleInterval / 1000);
  return Math.ceil(MAX_PLOT_RETENTION_SEC / intervalSec) + 50;
}

function plotElapsedSec(state: PlotState): number {
  return latestPlotTimeSec(collectPlotTimes(state.seriesData, state.plotVariables));
}

/** Minimal segment at add time so uPlot can draw a line (two distinct timestamps). */
const PLOT_SEED_SEGMENT_MS = 50;

/** Seed from when the variable was added — not before. */
function seedPlotVariable(
  get: () => PlotState,
  name: string,
  value: string,
  startedMs: number,
): void {
  const state = get();
  const startT = (startedMs - state.plotInitMs) / 1000;
  if (startT < 0) return;
  get().appendPoint(name, value, startedMs);
  get().appendPoint(name, value, startedMs + PLOT_SEED_SEGMENT_MS);
}

interface PlotState {
  plotVariables: string[];
  /** Epoch ms when each variable was added to the plot (plot timeline anchor). */
  plotStartedAtMs: Record<string, number>;
  colors: Record<string, string>;
  lineWidths: Record<string, number>;
  yMin: number;
  yMax: number;
  /** Fixed rolling X-axis window width in seconds (default 10 minutes). */
  xWindowSec: number;
  seriesData: Record<string, PlotPoint[]>;
  /** Epoch ms for plot t = 0 (frontend init, or replay recording start). */
  plotInitMs: number;
  maxPoints: number;
  /** Live plot frozen — inspect buffered history with a manual time window. */
  plotSampleMode: boolean;
  /** Sample mode: right edge of the visible X range (seconds); null = live tail. */
  xViewEndSec: number | null;
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
  /** Replace plot series with the current parameter value (after live reload). */
  resyncPlotSeries: (name: string, value?: string, sampleMs?: number) => void;
  setPlotSampleMode: (enabled: boolean) => void;
  setXViewEndSec: (endSec: number) => void;
}

export const usePlotStore = create<PlotState>((set, get) => ({
  plotVariables: [],
  plotStartedAtMs: {},
  colors: {},
  lineWidths: {},
  yMin: initialPlotScales.yMin,
  yMax: initialPlotScales.yMax,
  xWindowSec: initialPlotScales.xWindowSec,
  seriesData: {},
  plotInitMs: PLOT_INIT_MS,
  maxPoints: maxPointsForStore(),
  plotSampleMode: false,
  xViewEndSec: null,
  addPlotVariable: (name) => {
    const plotVariables = get().plotVariables;
    if (plotVariables.includes(name) || plotVariables.length >= 8) return;
    const colors = { ...get().colors };
    colors[name] = PLOT_COLORS[plotVariables.length % PLOT_COLORS.length];
    const lineWidths = { ...get().lineWidths, [name]: DEFAULT_PLOT_LINE_WIDTH };
    const startedMs = Date.now();
    set({
      plotVariables: [...plotVariables, name],
      plotStartedAtMs: { ...get().plotStartedAtMs, [name]: startedMs },
      colors,
      lineWidths,
      seriesData: { ...get().seriesData, [name]: get().seriesData[name] ?? [] },
    });
    const current = useVariableStore.getState().variables.find((v) => v.name === name);
    const value = current?.value;
    if (value !== undefined && value !== '') {
      seedPlotVariable(get, name, value, startedMs);
    }
  },
  removePlotVariable: (name) => {
    const { [name]: _series, ...seriesData } = get().seriesData;
    const { [name]: _color, ...colors } = get().colors;
    const { [name]: _width, ...lineWidths } = get().lineWidths;
    const { [name]: _started, ...plotStartedAtMs } = get().plotStartedAtMs;
    set({
      plotVariables: get().plotVariables.filter((v) => v !== name),
      plotStartedAtMs,
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
    if (get().plotSampleMode) return;
    const trimmed = value.trim();
    if (!trimmed || Number.isNaN(Number(trimmed))) return;
    const sampleMs = tMs ?? Date.now();
    const state = get();
    const startedMs = state.plotStartedAtMs[name];
    if (startedMs !== undefined && sampleMs < startedMs) return;
    const t = (sampleMs - state.plotInitMs) / 1000;
    if (t < 0) return;
    const prev = state.seriesData[name] ?? [];
    const last = prev[prev.length - 1];
    const merged =
      last && last.t === t
        ? [...prev.slice(0, -1), { t, raw: trimmed }]
        : [...prev, { t, raw: trimmed }];
    const arr = trimSeriesPoints(merged, state.maxPoints);
    set({
      seriesData: { ...state.seriesData, [name]: arr },
    });
  },
  clearSeries: () =>
    set({ seriesData: {}, plotStartedAtMs: {}, plotSampleMode: false, xViewEndSec: null }),
  setPlotInitMs: (plotInitMs) =>
    set({ plotInitMs, seriesData: {}, plotStartedAtMs: {}, plotSampleMode: false, xViewEndSec: null }),
  loadPlotConfig: (plotVariables, colors, yMin, yMax, xWindowSec, lineWidths) => {
    const windowSec = clampXWindowSec(xWindowSec ?? get().xWindowSec);
    const nextLineWidths: Record<string, number> = {};
    const startedMs = Date.now();
    const plotStartedAtMs: Record<string, number> = {};
    for (const name of plotVariables) {
      nextLineWidths[name] = clampLineWidth(lineWidths?.[name] ?? DEFAULT_PLOT_LINE_WIDTH);
      plotStartedAtMs[name] = startedMs;
    }
    set({
      plotVariables,
      plotStartedAtMs,
      colors,
      lineWidths: nextLineWidths,
      yMin,
      yMax,
      xWindowSec: windowSec,
      seriesData: {},
    });
  },
  resyncPlotSeries: (name, value, sampleMs) => {
    if (get().plotSampleMode) return;
    const state = get();
    if (!state.plotVariables.includes(name)) return;
    const resolved =
      value ??
      useVariableStore.getState().variables.find((v) => v.name === name)?.value ??
      '';
    if (resolved === '') return;
    const startedMs = state.plotStartedAtMs[name] ?? Date.now();
    const { [name]: _drop, ...rest } = state.seriesData;
    set({ seriesData: { ...rest, [name]: [] } });
    seedPlotVariable(get, name, resolved, startedMs);
    if (sampleMs !== undefined) {
      get().appendPoint(name, resolved, sampleMs);
    }
  },
  setPlotSampleMode: (enabled) => {
    if (!enabled) {
      set({ plotSampleMode: false, xViewEndSec: null });
      return;
    }
    const state = get();
    if (!state.plotVariables.length) return;
    const elapsed = plotElapsedSec(state);
    set({
      plotSampleMode: true,
      xViewEndSec: elapsed > 0 ? elapsed : state.xWindowSec,
    });
  },
  setXViewEndSec: (endSec) => {
    const state = get();
    const elapsed = plotElapsedSec(state);
    const window = state.xWindowSec;
    const end = Math.max(window, Math.min(endSec, Math.max(elapsed, window)));
    set({ xViewEndSec: end });
  },
}));

/** Append one sample per plot variable from the parameter table (live plot tick). */
export function sampleLivePlotVariables(sampleMs = Date.now()): void {
  if (usePlotStore.getState().plotSampleMode) return;
  const { plotVariables, plotStartedAtMs, resyncPlotSeries, appendPoint } = usePlotStore.getState();
  if (!plotVariables.length) return;

  const variables = useVariableStore.getState().variables;
  for (const name of plotVariables) {
    const variable = variables.find((v) => v.name === name);
    const value = variable?.value;
    if (value === undefined || value === '') continue;

    const startedMs = plotStartedAtMs[name];
    const points = usePlotStore.getState().seriesData[name] ?? [];
    const cacheOnly = variable?.sessionCacheOnly === true;

    if (cacheOnly || points.length === 0) {
      if (startedMs !== undefined) {
        resyncPlotSeries(name, value, sampleMs);
      }
      continue;
    }
    appendPoint(name, value, sampleMs);
  }
}
