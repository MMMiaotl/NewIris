import { create } from 'zustand';

const PLOT_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#e57373', '#ba68c8', '#4db6ac', '#ffd54f', '#90a4ae'];

interface PlotState {
  plotVariables: string[];
  colors: Record<string, string>;
  yMin: number;
  yMax: number;
  seriesData: Record<string, { t: number; v: number }[]>;
  maxPoints: number;
  addPlotVariable: (name: string) => void;
  removePlotVariable: (name: string) => void;
  setYRange: (min: number, max: number) => void;
  scaleYRange: (factor: number) => void;
  setColor: (name: string, color: string) => void;
  appendPoint: (name: string, t: number, value: string) => void;
  clearSeries: () => void;
  loadPlotConfig: (vars: string[], colors: Record<string, string>, min: number, max: number) => void;
}

export const usePlotStore = create<PlotState>((set, get) => ({
  plotVariables: [],
  colors: {},
  yMin: -10,
  yMax: 10,
  seriesData: {},
  maxPoints: 600,
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
  scaleYRange: (factor) => {
    const mid = (get().yMin + get().yMax) / 2;
    const half = ((get().yMax - get().yMin) / 2) * factor;
    set({ yMin: mid - half, yMax: mid + half });
  },
  setColor: (name, color) => set({ colors: { ...get().colors, [name]: color } }),
  appendPoint: (name, t, value) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    const arr = [...(get().seriesData[name] ?? []), { t, v: num }];
    const maxPoints = get().maxPoints;
    if (arr.length > maxPoints) arr.splice(0, arr.length - maxPoints);
    set({ seriesData: { ...get().seriesData, [name]: arr } });
  },
  clearSeries: () => set({ seriesData: {} }),
  loadPlotConfig: (plotVariables, colors, yMin, yMax) =>
    set({ plotVariables, colors, yMin, yMax, seriesData: {} }),
}));
