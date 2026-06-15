/** sessionStorage layout prefs — survive refresh, cleared when the tab closes. */

export const PARAMETER_PLOT_SPLIT_KEY = 'newiris-parameter-plot-split-v1';

/** Default fraction of vertical space for the parameter table (rest goes to plot). */
export const DEFAULT_PARAMETER_PLOT_RATIO = 0.45;

export function ratioToPanelPercent(ratio: number): string {
  const clamped = Math.min(0.8, Math.max(0.2, ratio));
  return `${(clamped * 100).toFixed(4)}%`;
}

export function readPersistedParameterPlotSplitRatio(): number | null {
  try {
    const raw = sessionStorage.getItem(PARAMETER_PLOT_SPLIT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { ratio?: unknown; size?: unknown };

    if (typeof data.ratio === 'number' && Number.isFinite(data.ratio) && data.ratio > 0) {
      return Math.min(0.8, Math.max(0.2, data.ratio));
    }

    // Legacy v1: { size: number | string }
    const size = data.size;
    if (typeof size === 'string' && size.endsWith('%')) {
      const pct = Number.parseFloat(size.slice(0, -1));
      if (Number.isFinite(pct) && pct > 0) return Math.min(0.8, Math.max(0.2, pct / 100));
    }
    return null;
  } catch {
    return null;
  }
}

export function writePersistedParameterPlotSplitRatio(ratio: number): void {
  try {
    const clamped = Math.min(0.8, Math.max(0.2, ratio));
    sessionStorage.setItem(PARAMETER_PLOT_SPLIT_KEY, JSON.stringify({ ratio: clamped }));
  } catch {
    // ignore quota / private mode
  }
}

export function readInitialParameterPanelDefaultSize(): string {
  const ratio = readPersistedParameterPlotSplitRatio();
  return ratio != null ? ratioToPanelPercent(ratio) : ratioToPanelPercent(DEFAULT_PARAMETER_PLOT_RATIO);
}

export function readInitialPlotPanelDefaultSize(): string {
  const ratio = readPersistedParameterPlotSplitRatio() ?? DEFAULT_PARAMETER_PLOT_RATIO;
  return ratioToPanelPercent(1 - ratio);
}
