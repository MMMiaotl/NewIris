/**
 * ImportVariablesModal — preview a .nirislog or .niris file before loading it
 * into the replay store.  Shows header metadata, variable count, frame count,
 * and optional start/stop time trim.
 */
import {
  Button,
  Descriptions,
  Divider,
  InputNumber,
  Modal,
  Space,
  Typography,
  Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  nirisLogToRecording,
  parseNirisLog,
  parseRecording,
  type NirisLogFile,
} from '../../utils/recordingFormat';
import type { RecordingFile } from '../../api/types';

interface ImportVariablesModalProps {
  open: boolean;
  onClose: () => void;
}

type ParsedFile =
  | { kind: 'nirislog'; log: NirisLogFile; rec: RecordingFile }
  | { kind: 'niris'; rec: RecordingFile };

export function ImportVariablesModal({ open, onClose }: ImportVariablesModalProps) {
  const { loadReplay } = useSessionStore();
  const setAppMode = useConnectionStore((s) => s.setAppMode);

  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [stopMs, setStopMs] = useState<number | null>(null);

  const reset = () => {
    setParsed(null);
    setError(null);
    setStartMs(null);
    setStopMs(null);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        if (file.name.endsWith('.nirislog')) {
          const log = parseNirisLog(text);
          setParsed({ kind: 'nirislog', log, rec: nirisLogToRecording(log) });
        } else {
          const rec = parseRecording(text);
          setParsed({ kind: 'niris', rec });
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
        setParsed(null);
      }
    };
    reader.readAsText(file);
    // Prevent antd Upload from actually uploading
    return false;
  };

  const handleLoad = () => {
    if (!parsed) return;
    let frames = parsed.rec.frames;
    if (startMs !== null) frames = frames.filter((f) => f.t >= startMs);
    if (stopMs !== null) frames = frames.filter((f) => f.t <= stopMs);
    const trimmed: RecordingFile = { ...parsed.rec, frames };
    loadReplay(trimmed);
    setAppMode('replay');
    reset();
    onClose();
  };

  const rec = parsed?.rec;
  const maxT = rec ? Math.max(0, ...rec.frames.map((f) => f.t)) : 0;
  const header = parsed?.kind === 'nirislog' ? parsed.log.header : null;

  return (
    <Modal
      title="Import Variables"
      open={open}
      onCancel={() => { reset(); onClose(); }}
      footer={
        <Space>
          <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button type="primary" onClick={handleLoad} disabled={!parsed}>
            Load into Replay
          </Button>
        </Space>
      }
      width={520}
    >
      {!parsed && (
        <Upload.Dragger
          accept=".nirislog,.niris,.json"
          showUploadList={false}
          beforeUpload={handleFile}
          style={{ marginBottom: 12 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag a .nirislog or .niris file here</p>
          <p className="ant-upload-hint">
            .nirislog — Registration log (JSON Lines)<br />
            .niris — Recording file (JSON)
          </p>
        </Upload.Dragger>
      )}

      {error && (
        <Typography.Text type="danger">{error}</Typography.Text>
      )}

      {parsed && (
        <>
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 12 }}>
            <Descriptions.Item label="Format" span={2}>
              {parsed.kind === 'nirislog' ? 'JSON Lines (.nirislog)' : 'Recording (.niris)'}
            </Descriptions.Item>
            <Descriptions.Item label="WatchIO name" span={2}>
              {rec?.watchIoName}
            </Descriptions.Item>
            {header && (
              <Descriptions.Item label="Started at" span={2}>
                {header.startedAt}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Variables">
              {rec?.variables.length ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Frames">
              {rec?.frames.length ?? 0} (0–{maxT} ms)
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '8px 0' }} />

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Time range trim (optional)
          </Typography.Text>
          <Space style={{ marginTop: 8 }}>
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

          <Button
            size="small"
            type="link"
            onClick={reset}
            style={{ marginTop: 8, display: 'block' }}
          >
            Load a different file
          </Button>
        </>
      )}
    </Modal>
  );
}
