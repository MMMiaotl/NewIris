import { useMemo } from 'react';
import { Button, List, Slider, Space, Typography } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { usePlotStore } from '../../stores/plotStore';
import {
  collectPlotTimes,
  formatPlotAxisTime,
  latestPlotTimeSec,
  nearestPlotValueAt,
} from '../../utils/plotTime';
import { convertRawToDisplayNumber, getDisplayLabel } from '../../utils/formatVariableValue';
import { useDisplayStore, getVariableDisplayOverride } from '../../stores/displayStore';

export function PlotSamplePanel() {
  const {
    plotVariables,
    seriesData,
    xWindowSec,
    plotSampleMode,
    xViewEndSec,
    enterPlotSampleMode,
    exitPlotSampleMode,
    setXViewEndSec,
  } = usePlotStore();
  const overrides = useDisplayStore((s) => s.overrides);

  const elapsedSec = useMemo(
    () => latestPlotTimeSec(collectPlotTimes(seriesData, plotVariables)),
    [seriesData, plotVariables],
  );

  const viewEnd = xViewEndSec ?? elapsedSec;
  const viewStart = Math.max(0, viewEnd - xWindowSec);
  const canScroll = elapsedSec > xWindowSec;
  const hasPlotData = plotVariables.length > 0 && elapsedSec > 0;

  const valuesAtViewEnd = useMemo(() => {
    return plotVariables.map((name) => {
      const point = nearestPlotValueAt(seriesData[name] ?? [], viewEnd);
      const raw = point?.raw;
      const display =
        raw !== undefined
          ? convertRawToDisplayNumber(raw, getVariableDisplayOverride(name))
          : null;
      return {
        name,
        label: getDisplayLabel(name, overrides[name]),
        display: display !== null && !Number.isNaN(display) ? String(display) : '—',
        timeSec: point?.t,
      };
    });
  }, [plotVariables, seriesData, viewEnd, overrides]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
        Pause live plot updates and scroll the time window over captured history. Hover the plot
        for values at any point.
      </Typography.Paragraph>

      <Button
        block
        type={plotSampleMode ? 'primary' : 'default'}
        icon={plotSampleMode ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
        disabled={!hasPlotData}
        onClick={() => (plotSampleMode ? exitPlotSampleMode() : enterPlotSampleMode())}
      >
        {plotSampleMode ? 'Resume live plot' : 'Sample (pause & inspect)'}
      </Button>

      {plotSampleMode && (
        <>
          <div>
            <div className="control-label">Time window</div>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {formatPlotAxisTime(viewStart)} – {formatPlotAxisTime(viewEnd)}
              {!canScroll && ' (need more history to scroll)'}
            </Typography.Text>
            <Slider
              style={{ marginTop: 8 }}
              min={xWindowSec}
              max={Math.max(xWindowSec, elapsedSec)}
              step={0.5}
              disabled={!canScroll}
              value={viewEnd}
              onChange={setXViewEndSec}
              tooltip={{
                formatter: (v) => (v !== undefined ? formatPlotAxisTime(v) : ''),
              }}
            />
          </div>

          <div>
            <div className="control-label">Values at window end ({formatPlotAxisTime(viewEnd)})</div>
            <List
              size="small"
              bordered
              dataSource={valuesAtViewEnd}
              locale={{ emptyText: 'No plot variables' }}
              renderItem={(item) => (
                <List.Item style={{ padding: '4px 8px' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span className="plot-variable-name" title={item.name}>
                      {item.label}
                    </span>
                    <Typography.Text code>{item.display}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </div>
        </>
      )}
    </Space>
  );
}
