import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { usePlotStore } from '../../stores/plotStore';
import { useConnectionStore } from '../../stores/connectionStore';

export function PlotPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { plotVariables, colors, seriesData, yMin, yMax } = usePlotStore();
  const { appMode } = useConnectionStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight - 8,
      scales: {
        x: { time: true },
        y: { min: yMin, max: yMax },
      },
      series: [{}, ...plotVariables.map((name) => ({ label: name, stroke: colors[name] ?? '#4fc3f7' }))],
      axes: [
        {},
        {
          grid: { show: true },
        },
      ],
    };

    const data: uPlot.AlignedData = [
      [],
      ...plotVariables.map(() => [] as number[]),
    ];

    if (plotRef.current) {
      plotRef.current.destroy();
    }
    plotRef.current = new uPlot(opts, data, containerRef.current);

    const onResize = () => {
      if (containerRef.current && plotRef.current) {
        plotRef.current.setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight - 8,
        });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [plotVariables.join(','), colors, yMin, yMax]);

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
    u.setData(data);
  }, [seriesData, plotVariables, yMin, yMax]);

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
