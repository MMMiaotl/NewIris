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

export function RegistrationPanel({ open, onClose }: RegistrationPanelProps) {
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

  // Candidate variables for registration (selected + registered)
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

  // Use lines.length as a proxy for elapsed — avoids calling Date.now() during render.
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
    <Modal
      title="Registration"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      {/* Status row */}
      <Space style={{ marginBottom: 12 }}>
        {active ? (
          paused ? (
            <Tag color="warning">Paused — {lines.length} lines</Tag>
          ) : (
            <Tag color="success">Recording — {lines.length} lines ({elapsed}s)</Tag>
          )
        ) : (
          <Tag color="default">Stopped {lines.length > 0 ? `— ${lines.length} lines saved` : ''}</Tag>
        )}
      </Space>

      {/* Controls */}
      <Space wrap style={{ marginBottom: 16 }}>
        {!active && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
            Start
          </Button>
        )}
        {active && !paused && (
          <Button icon={<PauseCircleOutlined />} onClick={pauseRegistration}>
            Pause
          </Button>
        )}
        {active && paused && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={resumeRegistration}>
            Resume
          </Button>
        )}
        {active && (
          <Button danger icon={<StopOutlined />} onClick={handleStop}>
            Stop &amp; Save
          </Button>
        )}
        {lines.length > 0 && (
          <Button icon={<SaveOutlined />} onClick={handleSaveNow}>
            Save Now
          </Button>
        )}
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      {/* Settings form */}
      <Form layout="vertical" size="small">
        <Form.Item label="Filename (without extension)">
          <Input
            value={settings.filename}
            onChange={(e) => updateSettings({ filename: e.target.value })}
            disabled={active}
            addonAfter=".nirislog"
          />
        </Form.Item>
        <Form.Item label="Sample interval override (ms, 0 = use global)">
          <InputNumber
            min={0}
            max={60000}
            value={settings.sampleIntervalMs}
            onChange={(v) => updateSettings({ sampleIntervalMs: v ?? 0 })}
            disabled={active}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item>
          <Space direction="vertical">
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
              Changes only (skip unchanged rows)
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>

      <Divider style={{ margin: '8px 0' }} />

      {/* Variable selection */}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Variables to log — defaults to all selected/registered if empty
      </Typography.Text>
      <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto' }}>
        {candidateVars.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            No variables selected. Select variables in the tree/table first.
          </Typography.Text>
        ) : (
          <Checkbox.Group
            value={variables.length ? variables : candidateVars}
            onChange={(vals) => setVariables(vals as string[])}
            disabled={active}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            {candidateVars.map((name) => (
              <Checkbox key={name} value={name} style={{ marginLeft: 0 }}>
                <Typography.Text style={{ fontSize: 12 }}>{name}</Typography.Text>
              </Checkbox>
            ))}
          </Checkbox.Group>
        )}
      </div>
    </Modal>
  );
}
