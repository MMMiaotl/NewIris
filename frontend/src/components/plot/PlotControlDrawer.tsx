import { Button, ColorPicker, Drawer, InputNumber, List, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { usePlotStore } from '../../stores/plotStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useVariableStore } from '../../stores/variableStore';

export function PlotControlDrawer() {
  const { plotDrawerOpen, setPlotDrawerOpen } = useConnectionStore();
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

  return (
    <Drawer
      title="Control — Plot"
      open={plotDrawerOpen}
      onClose={() => setPlotDrawerOpen(false)}
      size={360}
    >
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
    </Drawer>
  );
}
