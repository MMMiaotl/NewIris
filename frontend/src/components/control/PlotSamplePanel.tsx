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
    setPlotSampleMode,
    setXViewEndSec,
  } = usePlotStore();
  const overrides = useDisplayStore((s) => s.overrides);

  const elapsedSec = latestPlotTimeSec(collectPlotTimes(seriesData, plotVariables));
  const viewEnd = xViewEndSec ?? elapsedSec;
  const viewStart = Math.max(0, viewEnd - xWindowSec);
  const canScroll = elapsedSec > xWindowSec;
  const hasPlotData = plotVariables.length > 0 && elapsedSec > 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
        Pause live updates, then scroll the plot time window or hover the chart for values.
      </Typography.Paragraph>

      <Button
        block
        type={plotSampleMode ? 'primary' : 'default'}
        icon={plotSampleMode ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
        disabled={!hasPlotData}
        onClick={() => setPlotSampleMode(!plotSampleMode)}
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
              tooltip={{ formatter: (v) => (v !== undefined ? formatPlotAxisTime(v) : '') }}
            />
          </div>

          <div>
            <div className="control-label">Values at window end ({formatPlotAxisTime(viewEnd)})</div>
            <List
              size="small"
              bordered
              dataSource={plotVariables}
              locale={{ emptyText: 'No plot variables' }}
              renderItem={(name) => {
                const raw = nearestPlotValueAt(seriesData[name] ?? [], viewEnd)?.raw;
                const num =
                  raw !== undefined
                    ? convertRawToDisplayNumber(raw, getVariableDisplayOverride(name))
                    : null;
                return (
                  <List.Item style={{ padding: '4px 8px' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span className="plot-variable-name" title={name}>
                        {getDisplayLabel(name, overrides[name])}
                      </span>
                      <Typography.Text code>
                        {num !== null && !Number.isNaN(num) ? String(num) : '—'}
                      </Typography.Text>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </div>
        </>
      )}
    </Space>
  );
}
