/**
 * RegistrationPanel — modal for configuring and controlling continuous
 * log-to-file (Registration).  Opened from MenuBar → File → Registration…
 */
import {
  Button,
  Checkbox,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useRegistrationStore } from '../../stores/registrationStore';
import { useVariableStore } from '../../stores/variableStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  downloadJson,
  serializeNirisLog,
} from '../../utils/recordingFormat';

interface RegistrationPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Shared body — renders as-is inside ControlPanel Tab, or wrapped in Modal. */
export function RegistrationBody() {
  const {
    active,
    paused,
    lines,
    startedAt,
    variables,
    settings,
    startRegistration,
    stopRegistration,
    pauseRegistration,
    resumeRegistration,
    updateSettings,
    setVariables,
  } = useRegistrationStore();

  const { selectedVariables, registeredNames } = useVariableStore();
  const watchIoName = useConnectionStore((s) => s.config.watchIoName);

  const candidateVars = Array.from(
    new Set([...selectedVariables, ...Array.from(registeredNames)]),
  );

  const handleStart = () => {
    const vars = variables.length ? variables : candidateVars;
    startRegistration(vars, settings);
  };

  const handleStop = () => {
    const finishedLines = stopRegistration();
    if (finishedLines.length === 0) return;
    saveLog(finishedLines);
  };

  const handleSaveNow = () => {
    if (lines.length === 0) return;
    saveLog(lines);
  };

  const saveLog = (logLines: typeof lines) => {
    const content = serializeNirisLog(
      watchIoName,
      variables,
      logLines,
      settings.includeTimestamp,
      startedAt,
    );
    const name = settings.filename || 'registration';
    downloadJson(`${name}.nirislog`, content);
  };

  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!active || paused) return;
    const base = startedAt;
    const id = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - base) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active, paused, startedAt]);
  const elapsed = active ? elapsedSec : 0;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {/* Status */}
      <div>
        {active ? (
          paused ? (
            <Tag color="warning">Paused — {lines.length} lines</Tag>
          ) : (
            <Tag color="success">Recording — {lines.length} lines ({elapsed}s)</Tag>
          )
        ) : (
          <Tag color="default">Stopped{lines.length > 0 ? ` — ${lines.length} lines` : ''}</Tag>
        )}
      </div>

      {/* Controls */}
      <Space wrap>
        {!active && (
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
            Start
          </Button>
        )}
        {active && !paused && (
          <Button size="small" icon={<PauseCircleOutlined />} onClick={pauseRegistration}>
            Pause
          </Button>
        )}
        {active && paused && (
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={resumeRegistration}>
            Resume
          </Button>
        )}
        {active && (
          <Button size="small" danger icon={<StopOutlined />} onClick={handleStop}>
            Stop &amp; Save
          </Button>
        )}
        {lines.length > 0 && (
          <Button size="small" icon={<SaveOutlined />} onClick={handleSaveNow}>
            Save Now
          </Button>
        )}
      </Space>

      <Divider style={{ margin: '4px 0' }} />

      {/* Settings */}
      <Form layout="vertical" size="small">
        <Form.Item label="Filename" style={{ marginBottom: 8 }}>
          <Input
            value={settings.filename}
            onChange={(e) => updateSettings({ filename: e.target.value })}
            disabled={active}
            addonAfter=".nirislog"
          />
        </Form.Item>
        <Form.Item label="Sample interval override (ms, 0 = global)" style={{ marginBottom: 8 }}>
          <InputNumber
            min={0}
            max={60000}
            value={settings.sampleIntervalMs}
            onChange={(v) => updateSettings({ sampleIntervalMs: v ?? 0 })}
            disabled={active}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item style={{ marginBottom: 8 }}>
          <Space direction="vertical" size={2}>
            <Checkbox
              checked={settings.includeTimestamp}
              onChange={(e) => updateSettings({ includeTimestamp: e.target.checked })}
              disabled={active}
            >
              Include elapsed timestamp
            </Checkbox>
            <Checkbox
              checked={settings.changesOnly}
              onChange={(e) => updateSettings({ changesOnly: e.target.checked })}
              disabled={active}
            >
              Changes only
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>

      <Divider style={{ margin: '4px 0' }} />

      {/* Variable selection */}
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        Variables (defaults to all selected/registered)
      </Typography.Text>
      <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 4 }}>
        {candidateVars.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Select variables in the tree first.
          </Typography.Text>
        ) : (
          <Checkbox.Group
            value={variables.length ? variables : candidateVars}
            onChange={(vals) => setVariables(vals as string[])}
            disabled={active}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {candidateVars.map((name) => (
              <Checkbox key={name} value={name} style={{ marginLeft: 0 }}>
                <Typography.Text style={{ fontSize: 12 }}>{name}</Typography.Text>
              </Checkbox>
            ))}
          </Checkbox.Group>
        )}
      </div>
    </Space>
  );
}

export function RegistrationPanel({ open, onClose }: RegistrationPanelProps) {
  return (
    <Modal title="Registration" open={open} onCancel={onClose} footer={null} width={480}>
      <RegistrationBody />
    </Modal>
  );
}
