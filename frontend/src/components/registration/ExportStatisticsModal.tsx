/** Export Statistics — legacy Iris ExportStatistics parity. */
import {
  Button,
  Checkbox,
  Form,
  InputNumber,
  Modal,
  Space,
  Table,
  Typography,
} from 'antd';
import { useState, useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useRegistrationStore } from '../../stores/registrationStore';
import { useVariableStore } from '../../stores/variableStore';
import {
  computeVariableStatistics,
  statisticsToCsv,
  type StatisticsOptions,
} from '../../utils/exportStatistics';
import { downloadJson } from '../../utils/recordingFormat';

interface ExportStatisticsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportStatisticsModal({ open, onClose }: ExportStatisticsModalProps) {
  const replayData = useSessionStore((s) => s.replayData);
  const regLines = useRegistrationStore((s) => s.lines);
  const { selectedVariables, registeredNames } = useVariableStore();

  const [startMs, setStartMs] = useState<number | null>(null);
  const [stopMs, setStopMs] = useState<number | null>(null);
  const [opts, setOpts] = useState<StatisticsOptions>({
    includeAverage: true,
    includeStdDev: true,
    includeMaxMin: true,
    includeDerivative: false,
    regisOnly: false,
  });

  const frames = useMemo(() => {
    if (replayData?.frames.length) return replayData.frames;
    return regLines.map((l) => ({ t: l.t, values: l.values }));
  }, [replayData, regLines]);

  const variables = useMemo(() => {
    if (replayData?.variables.length) return replayData.variables;
    const names = Array.from(new Set([...selectedVariables, ...registeredNames]));
    return names;
  }, [replayData, selectedVariables, registeredNames]);

  const filteredVars = useMemo(
    () => (opts.regisOnly ? variables.filter((n) => registeredNames.has(n)) : variables),
    [opts.regisOnly, variables, registeredNames],
  );

  const rows = useMemo(() => {
    if (!frames.length || !filteredVars.length) return [];
    return computeVariableStatistics(frames, filteredVars, {
      ...opts,
      startMs,
      stopMs,
    });
  }, [frames, filteredVars, opts, startMs, stopMs]);

  const maxT = frames.length ? Math.max(...frames.map((f) => f.t)) : 0;

  const handleExport = () => {
    const csv = statisticsToCsv(rows);
    downloadJson('export-statistics.csv', csv);
  };

  const columns = [
    { title: 'Variable', dataIndex: 'name', key: 'name' },
    { title: 'Count', dataIndex: 'count', key: 'count' },
    ...(opts.includeAverage ? [{ title: 'Avg', dataIndex: 'average', key: 'average' }] : []),
    ...(opts.includeStdDev ? [{ title: 'StdDev', dataIndex: 'stdDev', key: 'stdDev' }] : []),
    ...(opts.includeMaxMin
      ? [
          { title: 'Min', dataIndex: 'min', key: 'min' },
          { title: 'Max', dataIndex: 'max', key: 'max' },
        ]
      : []),
    ...(opts.includeDerivative
      ? [{ title: 'Deriv avg', dataIndex: 'derivativeAvg', key: 'derivativeAvg' }]
      : []),
  ];

  return (
    <Modal
      title="Export Statistics"
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" onClick={handleExport} disabled={!rows.length}>
            Export CSV
          </Button>
        </Space>
      }
    >
      {!frames.length && (
        <Typography.Text type="warning">
          No data. Record, register, or open a replay file first.
        </Typography.Text>
      )}

      <Form layout="vertical" size="small">
        <Form.Item label={`Time range (ms) — 0–${maxT}`}>
          <Space>
            <InputNumber
              placeholder="Start"
              min={0}
              max={maxT}
              value={startMs ?? undefined}
              onChange={(v) => setStartMs(v ?? null)}
            />
            <span>to</span>
            <InputNumber
              placeholder="Stop"
              min={0}
              max={maxT}
              value={stopMs ?? undefined}
              onChange={(v) => setStopMs(v ?? null)}
            />
          </Space>
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Checkbox
              checked={opts.includeAverage}
              onChange={(e) => setOpts((o) => ({ ...o, includeAverage: e.target.checked }))}
            >
              Average
            </Checkbox>
            <Checkbox
              checked={opts.includeStdDev}
              onChange={(e) => setOpts((o) => ({ ...o, includeStdDev: e.target.checked }))}
            >
              Std dev
            </Checkbox>
            <Checkbox
              checked={opts.includeMaxMin}
              onChange={(e) => setOpts((o) => ({ ...o, includeMaxMin: e.target.checked }))}
            >
              Max / min
            </Checkbox>
            <Checkbox
              checked={opts.includeDerivative}
              onChange={(e) => setOpts((o) => ({ ...o, includeDerivative: e.target.checked }))}
            >
              Derivative
            </Checkbox>
            <Checkbox
              checked={opts.regisOnly}
              onChange={(e) => setOpts((o) => ({ ...o, regisOnly: e.target.checked }))}
            >
              Registered only
            </Checkbox>
          </Space>
        </Form.Item>
      </Form>

      <Table
        size="small"
        pagination={false}
        dataSource={rows.map((r) => ({ ...r, key: r.name }))}
        columns={columns}
        scroll={{ y: 240 }}
      />
    </Modal>
  );
}
