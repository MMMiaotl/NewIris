/**
 * ExportVariablesModal — export a subset of variables from the current
 * live monitor or an in-memory recording, with start/stop time filters.
 *
 * Output format: JSON Lines (.nirislog) — same as Registration output.
 * Can also export as .niris (RecordingFile JSON) for replay.
 */
import {
  Button,
  Checkbox,
  Divider,
  Form,
  InputNumber,
  Modal,
  Radio,
  Space,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useVariableStore } from '../../stores/variableStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  downloadJson,
  serializeNirisLog,
  serializeRecording,
  createRecording,
} from '../../utils/recordingFormat';

interface ExportVariablesModalProps {
  open: boolean;
  onClose: () => void;
}

type OutputFormat = 'nirislog' | 'niris';

export function ExportVariablesModal({ open, onClose }: ExportVariablesModalProps) {
  const { replayData } = useSessionStore();
  const { selectedVariables, registeredNames, variables: liveVars } = useVariableStore();
  const watchIoName = useConnectionStore((s) => s.config.watchIoName);

  const [format, setFormat] = useState<OutputFormat>('nirislog');
  const [startMs, setStartMs] = useState<number | null>(null);
  const [stopMs, setStopMs] = useState<number | null>(null);
  const [changesOnly, setChangesOnly] = useState(false);
  const [includeTimestamp, setIncludeTimestamp] = useState(true);

  // Candidate variable names from replay or live monitor
  const replayVars = replayData?.variables ?? [];
  const liveNames = Array.from(
    new Set([...selectedVariables, ...Array.from(registeredNames)]),
  );
  const candidateVars = replayVars.length ? replayVars : liveNames;
  const [chosenVars, setChosenVars] = useState<string[]>([]);

  const effectiveVars = chosenVars.length ? chosenVars : candidateVars;

  const handleExport = () => {
    if (replayData) {
      exportFromReplay();
    } else {
      exportFromLive();
    }
  };

  const exportFromReplay = () => {
    if (!replayData) return;
    let frames = replayData.frames;
    if (startMs !== null) frames = frames.filter((f) => f.t >= startMs);
    if (stopMs !== null) frames = frames.filter((f) => f.t <= stopMs);

    // Filter to chosen variables
    const filtered = frames.map((f) => {
      const vals: Record<string, string> = {};
      for (const name of effectiveVars) vals[name] = f.values[name] ?? '';
      return { t: f.t, values: vals };
    });

    // changesOnly
    const output = changesOnly
      ? filtered.filter((line, i) => {
          if (i === 0) return true;
          const prev = filtered[i - 1].values;
          return effectiveVars.some((k) => line.values[k] !== prev[k]);
        })
      : filtered;

    if (format === 'nirislog') {
      const content = serializeNirisLog(
        replayData.watchIoName,
        effectiveVars,
        output,
        includeTimestamp,
        Date.now(),
      );
      downloadJson(`${replayData.watchIoName}-export.nirislog`, content);
    } else {
      const rec = createRecording(replayData.watchIoName, effectiveVars, output);
      downloadJson(`${replayData.watchIoName}-export.niris`, serializeRecording(rec));
    }
    onClose();
  };

  const exportFromLive = () => {
    // Build snapshot from current live variable values
    const varMap = new Map(liveVars.map((v) => [v.name, v.value]));
    const snapshot: Record<string, string> = {};
    for (const name of effectiveVars) snapshot[name] = varMap.get(name) ?? '';
    const line = { t: 0, values: snapshot };

    if (format === 'nirislog') {
      const content = serializeNirisLog(watchIoName, effectiveVars, [line], includeTimestamp, Date.now());
      downloadJson(`${watchIoName}-export.nirislog`, content);
    } else {
      const rec = createRecording(watchIoName, effectiveVars, [{ t: 0, values: snapshot }]);
      downloadJson(`${watchIoName}-export.niris`, serializeRecording(rec));
    }
    onClose();
  };

  const hasData = replayData ? replayData.frames.length > 0 : liveVars.length > 0;
  const totalFrames = replayData?.frames.length ?? 1;
  const maxT = replayData ? Math.max(...replayData.frames.map((f) => f.t)) : 0;

  return (
    <Modal
      title="Export Variables"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleExport} disabled={!hasData}>
            Export
          </Button>
        </Space>
      }
      width={480}
    >
      {!hasData && (
        <Typography.Text type="warning">
          No data available. Connect and select variables, or open a recording first.
        </Typography.Text>
      )}

      <Form layout="vertical" size="small">
        <Form.Item label="Output format">
          <Radio.Group value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}>
            <Radio value="nirislog">JSON Lines (.nirislog)</Radio>
            <Radio value="niris">Recording (.niris)</Radio>
          </Radio.Group>
        </Form.Item>

        {replayData && (
          <>
            <Form.Item label={`Time range (ms) — total: ${totalFrames} frames, 0–${maxT} ms`}>
              <Space>
                <InputNumber
                  placeholder="Start ms"
                  min={0}
                  max={maxT}
                  value={startMs ?? undefined}
                  onChange={(v) => setStartMs(v ?? null)}
                  style={{ width: 130 }}
                />
                <span>to</span>
                <InputNumber
                  placeholder="Stop ms"
                  min={0}
                  max={maxT}
                  value={stopMs ?? undefined}
                  onChange={(v) => setStopMs(v ?? null)}
                  style={{ width: 130 }}
                />
              </Space>
            </Form.Item>
          </>
        )}

        <Form.Item>
          <Space direction="vertical">
            <Checkbox
              checked={includeTimestamp}
              onChange={(e) => setIncludeTimestamp(e.target.checked)}
            >
              Include elapsed timestamp
            </Checkbox>
            <Checkbox
              checked={changesOnly}
              onChange={(e) => setChangesOnly(e.target.checked)}
            >
              Changes only
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>

      <Divider style={{ margin: '8px 0' }} />

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Variables — defaults to all if none selected
      </Typography.Text>
      <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
        <Checkbox.Group
          value={chosenVars.length ? chosenVars : candidateVars}
          onChange={(vals) => setChosenVars(vals as string[])}
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          {candidateVars.map((name) => (
            <Checkbox key={name} value={name} style={{ marginLeft: 0 }}>
              <Typography.Text style={{ fontSize: 12 }}>{name}</Typography.Text>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </div>
    </Modal>
  );
}
