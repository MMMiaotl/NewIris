import { Button, ColorPicker, InputNumber, List, Space, Tabs } from 'antd';
import { CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { usePlotStore } from '../../stores/plotStore';
import { useVariableStore } from '../../stores/variableStore';
import { useDisplayStore } from '../../stores/displayStore';
import { getDisplayLabel } from '../../utils/formatVariableValue';
import { PlotLineWidthPicker } from './PlotLineWidthPicker';
import { VariableControlView } from './VariableControlView';
import { PlotSamplePanel } from './PlotSamplePanel';
import { RegistrationBody } from '../registration/RegistrationPanel';

interface ControlPanelProps {
  onClose: () => void;
  onSetValue: (name: string, value: string) => void;
  onRefreshVariable: (name: string) => void;
}

export function ControlPanel({ onClose, onSetValue, onRefreshVariable }: ControlPanelProps) {
  const { selectedVariables, focusedVariable } = useVariableStore();
  const {
    plotVariables,
    colors,
    lineWidths,
    yMin,
    yMax,
    xWindowSec,
    addPlotVariable,
    removePlotVariable,
    setYRange,
    setXWindowSec,
    scaleYRange,
    setColor,
    setLineWidth,
  } = usePlotStore();
  const displayOverrides = useDisplayStore((s) => s.overrides);

  const lastSelectedParameter =
    focusedVariable && selectedVariables.includes(focusedVariable)
      ? focusedVariable
      : (selectedVariables.at(-1) ?? null);

  const plotTab = (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <div className="control-label">Plot variables (max 8)</div>
        <List
          size="small"
          bordered
          dataSource={plotVariables}
          locale={{ emptyText: 'No variables selected' }}
          renderItem={(name) => (
            <List.Item className="plot-variable-row">
              <div className="plot-variable-row-inner">
                <span className="plot-variable-name" title={name}>
                  {getDisplayLabel(name, displayOverrides[name])}
                </span>
                <div className="plot-variable-controls">
                  <PlotLineWidthPicker
                    value={lineWidths[name] ?? 1}
                    color={colors[name] ?? '#333'}
                    onChange={(width) => setLineWidth(name, width)}
                  />
                  <ColorPicker
                    size="small"
                    className="plot-variable-color-picker"
                    value={colors[name]}
                    onChangeComplete={(color) => setColor(name, color.toHexString())}
                  />
                  <Button
                    type="text"
                    size="small"
                    className="plot-variable-delete-btn"
                    icon={<DeleteOutlined />}
                    onClick={() => removePlotVariable(name)}
                  />
                </div>
              </div>
            </List.Item>
          )}
        />
        <Button
          block
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
          disabled={
            !lastSelectedParameter ||
            plotVariables.includes(lastSelectedParameter)
          }
          onClick={() => {
            if (lastSelectedParameter) addPlotVariable(lastSelectedParameter);
          }}
        >
          Add selected variable
        </Button>
      </div>

      <div>
        <div className="control-label">Y range</div>
        <Space>
          <span>Min</span>
          <InputNumber value={yMin} onChange={(v) => setYRange(v ?? yMin, yMax)} step={1} />
          <span>Max</span>
          <InputNumber value={yMax} onChange={(v) => setYRange(yMin, v ?? yMax)} step={1} />
        </Space>
        <Space style={{ marginTop: 8 }}>
          <Button size="small" onClick={() => scaleYRange(2)}>
            × 2
          </Button>
          <Button size="small" onClick={() => scaleYRange(0.5)}>
            ÷ 2
          </Button>
          <Button size="small" onClick={() => setYRange(-10, 10)}>
            Set default
          </Button>
        </Space>
      </div>

      <div>
        <div className="control-label">Time window</div>
        <Space>
          <InputNumber
            min={0.5}
            max={60}
            step={0.5}
            value={xWindowSec / 60}
            onChange={(v) => setXWindowSec(Math.round((v ?? xWindowSec / 60) * 60))}
          />
          <span>min</span>
        </Space>
        <Space style={{ marginTop: 8 }} wrap>
          <Button size="small" onClick={() => setXWindowSec(60)}>1 min</Button>
          <Button size="small" onClick={() => setXWindowSec(300)}>5 min</Button>
          <Button size="small" onClick={() => setXWindowSec(600)}>10 min</Button>
          <Button size="small" onClick={() => setXWindowSec(1800)}>30 min</Button>
        </Space>
      </div>
    </Space>
  );

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <span className="control-panel-title">Control</span>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          aria-label="Close Control panel"
          onClick={onClose}
        />
      </div>
      <div className="control-panel-body">
        <Tabs
          size="small"
          className="control-panel-tabs"
          items={[
            {
              key: 'view',
              label: 'View',
              children: (
                <VariableControlView onSetValue={onSetValue} onRefresh={onRefreshVariable} />
              ),
            },
            {
              key: 'plot',
              label: 'Plot',
              children: plotTab,
            },
            {
              key: 'sample',
              label: 'Sample',
              children: <PlotSamplePanel />,
            },
            {
              key: 'registration',
              label: 'Registration',
              children: (
                <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
                  <RegistrationBody />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
