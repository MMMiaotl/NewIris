/** Format elapsed seconds as m:ss for plot X-axis labels. */
export function formatPlotAxisTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Rolling X-axis viewport on absolute elapsed time.
 *
 * - elapsed <= window: axis [0, window] (e.g. 3 min data, 10 min window → 0:00–10:00)
 * - elapsed > window:  axis [elapsed − window, elapsed] (live tail, scrolls with new data)
 * - viewEndSec set (sample mode): axis [viewEnd − window, viewEnd], clamped to data range
 *
 * Series data stays in absolute coordinates; only uPlot scale min/max changes.
 */
export function computePlotXViewport(
  elapsedSec: number,
  windowSec: number,
  viewEndSec?: number | null,
): { min: number; max: number } {
  if (viewEndSec !== null && viewEndSec !== undefined) {
    const end = Math.max(windowSec, Math.min(viewEndSec, Math.max(elapsedSec, windowSec)));
    return { min: Math.max(0, end - windowSec), max: end };
  }
  if (elapsedSec <= windowSec) {
    return { min: 0, max: windowSec };
  }
  return {
    min: elapsedSec - windowSec,
    max: elapsedSec,
  };
}

export function collectPlotTimes(
  seriesData: Record<string, PlotPoint[]>,
  plotVariables: string[],
): number[] {
  const allTimes = new Set<number>();
  for (const name of plotVariables) {
    for (const p of seriesData[name] ?? []) allTimes.add(p.t);
  }
  return Array.from(allTimes).sort((a, b) => a - b);
}

export function latestPlotTimeSec(times: number[]): number {
  return times.length > 0 ? times[times.length - 1]! : 0;
}

export interface PlotPoint {
  t: number;
  /** Raw server value — converted to display units at render time. */
  raw: string;
}

/** Keep up to one hour of plot history for Sample mode scrubbing. */
export const MAX_PLOT_RETENTION_SEC = 3600;

/** Cap buffer size only; also drop points older than retention window. */
export function trimSeriesPoints(
  points: PlotPoint[],
  maxPoints: number,
  retentionSec = MAX_PLOT_RETENTION_SEC,
): PlotPoint[] {
  if (points.length === 0) return points;
  const latest = points[points.length - 1]!.t;
  const cutoff = latest - retentionSec;
  let trimmed = points.filter((p) => p.t >= cutoff);
  if (trimmed.length > maxPoints) trimmed = trimmed.slice(-maxPoints);
  return trimmed;
}

/** Last sample at or before tSec (step-hold interpolation). */
export function nearestPlotValueAt(
  points: PlotPoint[],
  tSec: number,
): PlotPoint | null {
  if (!points.length) return null;
  let best: PlotPoint | null = null;
  for (const p of points) {
    if (p.t <= tSec) best = p;
    else break;
  }
  return best;
}

/** Build uPlot aligned data; single-series uses native arrays, multi-series unions times. */
export function buildPlotAlignedData(
  seriesData: Record<string, PlotPoint[]>,
  plotVariables: string[],
  valueAt: (name: string, raw: string) => number | null,
): (number | null)[][] {
  if (plotVariables.length === 0) return [[]];

  if (plotVariables.length === 1) {
    const name = plotVariables[0]!;
    const points = seriesData[name] ?? [];
    return [
      points.map((p) => p.t),
      points.map((p) => valueAt(name, p.raw)),
    ];
  }

  const allTimes = collectPlotTimes(seriesData, plotVariables);
  return [
    allTimes,
    ...plotVariables.map((name) => {
      const map = new Map(
        (seriesData[name] ?? []).map((p) => [p.t, valueAt(name, p.raw)]),
      );
      return allTimes.map((t) => map.get(t) ?? null);
    }),
  ];
}
