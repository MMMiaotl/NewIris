import { Button, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import type { ConnectionTransport } from '../../api/types';
import { transportOptions } from '../../constants/transport';
import { useConnectionStore } from '../../stores/connectionStore';

interface ConnectionSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionSettingsModal({ open, onClose }: ConnectionSettingsModalProps) {
  const { config, setWatchIoLogDrawerOpen, setConfig } = useConnectionStore();
  const isWatchIo = config.transport === 'watchIoHttp' || config.transport === 'watchIoWs';
  const showWsUrl = config.transport === 'watchIoWs';

  const openWatchIoLog = () => {
    onClose();
    setWatchIoLogDrawerOpen(true);
  };

  return (
    <Modal
      title="Connection"
      open={open}
      onCancel={onClose}
      width={560}
      className="connection-settings-modal"
      style={{ top: 48 }}
      footer={null}
      destroyOnHidden
    >
      {open ? (
        <Form layout="vertical" size="small" className="connection-settings-modal-body">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Connection type" className="connection-settings-field">
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
            </Col>
            <Col span={12}>
              <Form.Item
                label={isWatchIo ? 'Gateway path' : 'SmcServer path'}
                className="connection-settings-field"
              >
                <Input
                  value={config.serverPath}
                  onChange={(e) => setConfig({ serverPath: e.target.value })}
                  placeholder={isWatchIo ? '/watchio' : '/SmcServer1'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={showWsUrl ? 12 : 24}>
              <Form.Item label="HTTP base URL" className="connection-settings-field">
                <Input
                  value={config.httpUrl}
                  onChange={(e) => setConfig({ httpUrl: e.target.value })}
                  placeholder="Empty = Vite proxy (recommended)"
                />
              </Form.Item>
            </Col>
            {showWsUrl && (
              <Col span={12}>
                <Form.Item label="WebSocket URL" className="connection-settings-field">
                  <Input
                    value={config.wsUrl}
                    onChange={(e) => setConfig({ wsUrl: e.target.value })}
                    placeholder="ws://localhost:8083"
                  />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Sample (ms)" className="connection-settings-field">
                <InputNumber
                  min={100}
                  max={5000}
                  step={100}
                  style={{ width: '100%' }}
                  value={config.sampleInterval}
                  onChange={(v) => setConfig({ sampleInterval: v ?? 500 })}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="connection-settings-modal-footer">
            <Button type="link" size="small" className="connection-settings-debug-link" onClick={openWatchIoLog}>
              WatchIO raw messages
            </Button>
          </div>
        </Form>
      ) : null}
    </Modal>
  );
}
