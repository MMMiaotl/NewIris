import { Button, Drawer, Form, Input, InputNumber, Select, Space } from 'antd';
import type { ConnectionTransport } from '../../api/types';
import { transportOptions } from '../../constants/transport';
import { WatchIoNameField } from '../connection/WatchIoNameField';
import { useConnectionStore } from '../../stores/connectionStore';

interface SettingsDrawerProps {
  onApplyWatchIoName: (name: string) => Promise<boolean>;
}

export function SettingsDrawer({ onApplyWatchIoName }: SettingsDrawerProps) {
  const {
    config,
    settingsDrawerOpen,
    setSettingsDrawerOpen,
    setWatchIoLogDrawerOpen,
    setConfig,
    status,
  } = useConnectionStore();
  const isWatchIo = config.transport === 'watchIoHttp' || config.transport === 'watchIoWs';

  return (
    <Drawer
      title="Connection"
      open={settingsDrawerOpen}
      onClose={() => setSettingsDrawerOpen(false)}
      size={400}
    >
      <Form layout="vertical">
        <Form.Item label="Connection type">
          <Select
            value={config.transport}
            onChange={(transport: ConnectionTransport) =>
              setConfig({
                transport,
                serverPath: transport === 'smcServer' ? '/SmcServer1' : '/watchio',
              })
            }
            options={transportOptions}
          />
        </Form.Item>

        <Form.Item
          label="HTTP base URL (HttpWebServer)"
          extra="Leave empty to use the Vite proxy (:5173→:8082). Do not set http://localhost:8082 on :5173 — CORS will fail."
        >
          <Input
            value={config.httpUrl}
            onChange={(e) => setConfig({ httpUrl: e.target.value })}
            placeholder="Leave empty (recommended)"
          />
        </Form.Item>

        {config.transport === 'watchIoWs' && (
          <Form.Item
            label="WebSocket URL (WatchIoWebServer)"
            extra="Default ws://localhost:8083 when HTTP gateway is on :8082."
          >
            <Input
              value={config.wsUrl}
              onChange={(e) => setConfig({ wsUrl: e.target.value })}
              placeholder="ws://localhost:8083"
            />
          </Form.Item>
        )}

        <Form.Item
          label={isWatchIo ? 'Gateway path (/watchio)' : 'SmcServer path'}
        >
          <Input
            value={config.serverPath}
            onChange={(e) => setConfig({ serverPath: e.target.value })}
            placeholder={isWatchIo ? '/watchio' : '/SmcServer1'}
          />
        </Form.Item>

        <Form.Item
          label="WatchIO instance name"
          extra="Segment to connect: SmcControl1, CasServer, etc. Reconnects automatically when live."
        >
          <WatchIoNameField
            appliedName={config.watchIoName}
            onApply={onApplyWatchIoName}
            connected={status === 'connected' || status === 'connecting'}
          />
        </Form.Item>
        <Form.Item label="Sample interval (ms)">
          <InputNumber
            min={100}
            max={5000}
            step={100}
            style={{ width: '100%' }}
            value={config.sampleInterval}
            onChange={(v) => setConfig({ sampleInterval: v ?? 500 })}
          />
        </Form.Item>

        <Form.Item label="Debug">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              onClick={() => {
                setSettingsDrawerOpen(false);
                setWatchIoLogDrawerOpen(true);
              }}
            >
              WatchIO raw messages
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
