import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { usePlotStore, DEFAULT_PLOT_LINE_WIDTH } from '../../stores/plotStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  buildPlotAlignedData,
  collectPlotTimes,
  computePlotXViewport,
  formatPlotAxisTime,
  latestPlotTimeSec,
} from '../../utils/plotTime';

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
): uPlot.Series[] {
  return plotVariables.map((name) => ({
    label: name,
    stroke: colors[name] ?? '#4fc3f7',
    width: lineWidths[name] ?? DEFAULT_PLOT_LINE_WIDTH,
    spanGaps: true,
    points: { show: false },
  }));
}

function syncPlot(
  u: uPlot,
  plotVariables: string[],
  seriesData: Record<string, { t: number; v: number }[]>,
  yMin: number,
  yMax: number,
  xWindowSec: number,
): void {
  const allTimes = collectPlotTimes(seriesData, plotVariables);
  const elapsedSec = latestPlotTimeSec(allTimes);
  const { min: viewMin, max: viewMax } = computePlotXViewport(elapsedSec, xWindowSec);
  const data = buildPlotAlignedData(seriesData, plotVariables) as uPlot.AlignedData;

  u.setData(data, false);
  u.setScale('x', { min: viewMin, max: viewMax });
  u.setScale('y', { min: yMin, max: yMax });
}

export function PlotPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { plotVariables, colors, lineWidths, seriesData, yMin, yMax, xWindowSec } =
    usePlotStore();
  const { appMode } = useConnectionStore();
  const plotVariableKey = plotVariables.join(',');

  useEffect(() => {
    if (!containerRef.current) return;

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight - 8,
      scales: {
        x: { time: false, auto: false },
        y: { auto: false },
      },
      series: [{}, ...seriesOptions(plotVariables, colors, lineWidths)],
      axes: [PLOT_X_AXIS, PLOT_Y_AXIS],
    };

    plotRef.current?.destroy();
    plotRef.current = new uPlot(
      opts,
      buildPlotAlignedData(seriesData, plotVariables) as uPlot.AlignedData,
      containerRef.current,
    );

    syncPlot(plotRef.current, plotVariables, seriesData, yMin, yMax, xWindowSec);

    const el = containerRef.current;
    const onResize = () => {
      if (el && plotRef.current) {
        plotRef.current.setSize({
          width: el.clientWidth,
          height: el.clientHeight - 8,
        });
      }
    };
    const observer = new ResizeObserver(() => requestAnimationFrame(onResize));
    observer.observe(el);
    return () => {
      observer.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [plotVariableKey]);

  useEffect(() => {
    const u = plotRef.current;
    if (!u) return;
    plotVariables.forEach((name, i) => {
      u.setSeries(i + 1, {
        stroke: colors[name] ?? '#4fc3f7',
        width: lineWidths[name] ?? DEFAULT_PLOT_LINE_WIDTH,
        spanGaps: true,
      } as uPlot.Series);
    });
  }, [colors, lineWidths, plotVariables]);

  useEffect(() => {
    const u = plotRef.current;
    if (!u || plotVariables.length === 0) return;
    syncPlot(u, plotVariables, seriesData, yMin, yMax, xWindowSec);
  }, [seriesData, plotVariables, yMin, yMax, xWindowSec]);

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
