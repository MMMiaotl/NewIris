import { Button, ColorPicker, InputNumber, List, Space, Tabs } from 'antd';
import { CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { usePlotStore } from '../../stores/plotStore';
import { useVariableStore } from '../../stores/variableStore';
import { VariableControlView } from './VariableControlView';

interface ControlPanelProps {
  onClose: () => void;
  onSetValue: (name: string, value: string) => void;
  onRefreshVariable: (name: string) => void;
}

export function ControlPanel({ onClose, onSetValue, onRefreshVariable }: ControlPanelProps) {
  const { selectedVariables } = useVariableStore();
  const {
    plotVariables,
    colors,
    yMin,
    yMax,
    addPlotVariable,
    removePlotVariable,
    setYRange,
    scaleYRange,
    setColor,
  } = usePlotStore();

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
            <List.Item
              actions={[
                <ColorPicker
                  key="color"
                  size="small"
                  value={colors[name]}
                  onChange={(_, hex) => setColor(name, hex)}
                />,
                <Button
                  key="del"
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removePlotVariable(name)}
                />,
              ]}
            >
              {name}
            </List.Item>
          )}
        />
        <Button
          block
          icon={<PlusOutlined />}
          style={{ marginTop: 8 }}
          disabled={
            !selectedVariables.length ||
            selectedVariables.every((name) => plotVariables.includes(name))
          }
          onClick={() => {
            for (const name of selectedVariables) addPlotVariable(name);
          }}
        >
          Add selected variables
        </Button>
      </div>

      <div>
        <div className="control-label">Range</div>
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
          ]}
        />
      </div>
    </div>
  );
}
