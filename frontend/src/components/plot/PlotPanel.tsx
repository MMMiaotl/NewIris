import { useLayoutEffect, useRef, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { usePlotStore, DEFAULT_PLOT_LINE_WIDTH } from '../../stores/plotStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useDisplayStore, getVariableDisplayOverride } from '../../stores/displayStore';
import {
  buildPlotAlignedData,
  collectPlotTimes,
  computePlotXViewport,
  formatPlotAxisTime,
  latestPlotTimeSec,
} from '../../utils/plotTime';
import { convertRawToDisplayNumber, getDisplayLabel } from '../../utils/formatVariableValue';

const PLOT_CONTAINER_INSET = 8;

const PLOT_Y_AXIS = { stroke: '#9a9a9a', grid: { show: true, stroke: '#4a4a4a' } };
const PLOT_X_AXIS = {
  stroke: '#9a9a9a',
  grid: { show: true, stroke: '#4a4a4a' },
  values: (_u: uPlot, ticks: number[]) => ticks.map((t) => formatPlotAxisTime(t)),
};

function seriesOptions(
  plotVariables: string[],
  colors: Record<string, string>,
  lineWidths: Record<string, number>,
  overrides: Record<string, ReturnType<typeof getVariableDisplayOverride>>,
): uPlot.Series[] {
  return plotVariables.map((name) => ({
    label: getDisplayLabel(name, overrides[name]),
    stroke: colors[name] ?? '#4fc3f7',
    width: lineWidths[name] ?? DEFAULT_PLOT_LINE_WIDTH,
    spanGaps: true,
    auto: false,
    points: { show: false },
  }));
}

function syncPlot(
  u: uPlot,
  plotVariables: string[],
  seriesData: ReturnType<typeof usePlotStore.getState>['seriesData'],
  yMin: number,
  yMax: number,
  xWindowSec: number,
  valueAt: (name: string, raw: string) => number | null,
): void {
  const allTimes = collectPlotTimes(seriesData, plotVariables);
  const elapsedSec = latestPlotTimeSec(allTimes);
  const { min: viewMin, max: viewMax } = computePlotXViewport(elapsedSec, xWindowSec);
  const data = buildPlotAlignedData(seriesData, plotVariables, valueAt) as uPlot.AlignedData;

  // Lock Y before X — uPlot re-ranges Y from series data when X scale updates.
  u.setData(data, false);
  applyYScale(u, yMin, yMax);
  u.setScale('x', { min: viewMin, max: viewMax });
  applyYScale(u, yMin, yMax);
}

function plotCanvasHeight(containerHeight: number): number {
  return Math.max(0, containerHeight - PLOT_CONTAINER_INSET);
}

function fixedYRange(yMin: number, yMax: number): uPlot.Range.MinMax {
  return [yMin, yMax];
}

function yScaleOptions(yMin: number, yMax: number): uPlot.Scale {
  return {
    auto: false,
    min: yMin,
    max: yMax,
    range: () => fixedYRange(yMin, yMax),
  };
}

function applyYScale(u: uPlot, yMin: number, yMax: number): void {
  u.setScale('y', {
    min: yMin,
    max: yMax,
    range: () => fixedYRange(yMin, yMax),
  } as { min: number; max: number });
}

export function PlotPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const chartKeyRef = useRef('');
  const { plotVariables, colors, lineWidths, seriesData, yMin, yMax, xWindowSec } =
    usePlotStore();
  const overrides = useDisplayStore((s) => s.overrides);
  const { appMode } = useConnectionStore();

  const valueAt = useCallback((name: string, raw: string) => {
    return convertRawToDisplayNumber(raw, getVariableDisplayOverride(name));
  }, []);

  const plotChartKey = `${plotVariables.join(',')}|${JSON.stringify(colors)}|${JSON.stringify(lineWidths)}|${JSON.stringify(overrides)}`;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const syncSize = () => {
      const width = el.clientWidth;
      const height = plotCanvasHeight(el.clientHeight);
      if (width <= 0 || height <= 0) return;

      if (plotRef.current && chartKeyRef.current === plotChartKey) {
        plotRef.current.setSize({ width, height });
        return;
      }

      plotRef.current?.destroy();
      chartKeyRef.current = plotChartKey;

      const opts: uPlot.Options = {
        width,
        height,
        scales: {
          x: { time: false, auto: false },
          y: yScaleOptions(yMin, yMax),
        },
        series: [{}, ...seriesOptions(plotVariables, colors, lineWidths, overrides)],
        axes: [PLOT_X_AXIS, PLOT_Y_AXIS],
      };

      plotRef.current = new uPlot(
        opts,
        buildPlotAlignedData(seriesData, plotVariables, valueAt) as uPlot.AlignedData,
        el,
      );
      syncPlot(plotRef.current, plotVariables, seriesData, yMin, yMax, xWindowSec, valueAt);
    };

    syncSize();
    const observer = new ResizeObserver(() => requestAnimationFrame(syncSize));
    observer.observe(el);
    return () => {
      observer.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
      chartKeyRef.current = '';
    };
  }, [plotChartKey, valueAt]);

  /** Apply data + axis scales before paint so Y range does not flash. */
  useLayoutEffect(() => {
    const u = plotRef.current;
    if (!u) return;
    syncPlot(u, plotVariables, seriesData, yMin, yMax, xWindowSec, valueAt);
  }, [seriesData, plotVariables, yMin, yMax, xWindowSec, valueAt]);

  return (
    <div className="panel plot-panel">
      <div className="panel-header">
        Plot {appMode === 'replay' ? '(Replay)' : ''}
      </div>
      <div ref={containerRef} className="plot-container" />
      {plotVariables.length === 0 && (
        <div className="plot-empty">Double-click a parameter row or use Control → Plot to add variables</div>
      )}
    </div>
  );
}
