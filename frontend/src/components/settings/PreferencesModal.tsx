/** Preferences dialog — startup behaviour and session metadata. */
import { Checkbox, Form, Input, InputNumber, Modal, Space, Typography } from 'antd';
import { useUiPreferencesStore } from '../../stores/uiPreferencesStore';

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  const {
    sessionDescription,
    startupOpenSession,
    startupConnectWatchIo,
    plotNameTruncate,
    watchIoHistory,
    setSessionDescription,
    setStartupOpenSession,
    setStartupConnectWatchIo,
    setPlotNameTruncate,
  } = useUiPreferencesStore();

  return (
    <Modal title="Preferences" open={open} onCancel={onClose} onOk={onClose} width={480}>
      <Form layout="vertical" size="small">
        <Form.Item label="Session description">
          <Input.TextArea
            rows={3}
            value={sessionDescription}
            onChange={(e) => setSessionDescription(e.target.value)}
            placeholder="Optional notes for this workspace"
          />
        </Form.Item>
        <Form.Item label="Plot name truncate (0 = full name)">
          <InputNumber
            min={0}
            max={80}
            value={plotNameTruncate}
            onChange={(v) => setPlotNameTruncate(v ?? 0)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item>
          <Space direction="vertical">
            <Checkbox
              checked={startupConnectWatchIo}
              onChange={(e) => setStartupConnectWatchIo(e.target.checked)}
            >
              Connect WatchIO on startup (when live mode)
            </Checkbox>
            <Checkbox
              checked={startupOpenSession}
              onChange={(e) => setStartupOpenSession(e.target.checked)}
            >
              Prompt to open last session on startup
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>
      {watchIoHistory.length > 0 && (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Recent WatchIO names
          </Typography.Text>
          <ul style={{ fontSize: 12, margin: '4px 0 0', paddingLeft: 18 }}>
            {watchIoHistory.slice(0, 8).map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
