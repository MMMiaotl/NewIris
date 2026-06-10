import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { usePlotStore, DEFAULT_PLOT_LINE_WIDTH } from '../../stores/plotStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { formatPlotAxisTime, plotXWindowRange } from '../../utils/plotTime';

const PLOT_Y_AXIS = { stroke: '#9a9a9a', grid: { show: true, stroke: '#4a4a4a' } };
const PLOT_X_AXIS = {
  stroke: '#9a9a9a',
  grid: { show: true, stroke: '#4a4a4a' },
  values: (_u: uPlot, ticks: number[]) => ticks.map((t) => formatPlotAxisTime(t)),
};

export function PlotPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { plotVariables, colors, lineWidths, seriesData, yMin, yMax, xWindowSec } = usePlotStore();
  const { appMode } = useConnectionStore();
  const plotVariableKey = plotVariables.join(',');

  useEffect(() => {
    if (!containerRef.current) return;

    const windowSec = xWindowSec;

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight - 8,
      scales: {
        x: {
          time: false,
          auto: false,
          range: (_u, _min, max) => {
            const latest =
              typeof max === 'number' && !Number.isNaN(max) ? max : 0;
            const { min: xMin, max: xMax } = plotXWindowRange(latest, windowSec);
            return [xMin, xMax];
          },
        },
        y: {
          auto: false,
          range: [yMin, yMax],
        },
      },
      series: [
        {},
        ...plotVariables.map((name) => ({
          label: name,
          stroke: colors[name] ?? '#4fc3f7',
          width: lineWidths[name] ?? DEFAULT_PLOT_LINE_WIDTH,
          points: { show: false },
        })),
      ],
      axes: [PLOT_X_AXIS, PLOT_Y_AXIS],
    };

    const data: uPlot.AlignedData = [
      [],
      ...plotVariables.map(() => [] as number[]),
    ];

    if (plotRef.current) {
      plotRef.current.destroy();
    }
    plotRef.current = new uPlot(opts, data, containerRef.current);

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
  }, [plotVariableKey, colors, lineWidths, yMin, yMax, plotVariables, xWindowSec]);

  useEffect(() => {
    const u = plotRef.current;
    if (!u || plotVariables.length === 0) return;

    const allTimes = new Set<number>();
    for (const name of plotVariables) {
      for (const p of seriesData[name] ?? []) allTimes.add(p.t);
    }
    const times = Array.from(allTimes).sort((a, b) => a - b);
    const data: uPlot.AlignedData = [
      times,
      ...plotVariables.map((name) => {
        const map = new Map((seriesData[name] ?? []).map((p) => [p.t, p.v]));
        return times.map((t) => map.get(t) ?? null) as number[];
      }),
    ];
    u.setScale('y', { min: yMin, max: yMax });
    u.setData(data, false);
    u.redraw();
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
