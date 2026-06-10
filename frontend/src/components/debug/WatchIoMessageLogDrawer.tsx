import { Button, Collapse, Drawer, Empty, Select, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { getEntryAttributes } from '../../utils/parseAttributes';
import { normalizeEntries } from '../../utils/parseWatchIoMessage';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  useWatchIoMessageLogStore,
  type WatchIoLoggedMessage,
} from '../../stores/watchIoMessageLogStore';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function entryTypeSummary(entry: { name: string; params?: unknown }): Record<string, unknown> {
  const parsed = getEntryAttributes(
    entry as { params?: Record<string, string> | Array<{ name: string; value: string }> },
  );
  return {
    name: entry.name,
    rawParams: entry.params ?? null,
    parsed: {
      dataType: parsed.dataType ?? '',
      varKind: parsed.varKind ?? '',
      description: parsed.description ?? '',
      scale: parsed.scale ?? '',
      override: parsed.override ?? '',
      iodisable: parsed.iodisable ?? '',
    },
  };
}

function messageDetail(record: WatchIoLoggedMessage): Record<string, unknown> {
  const msg = record.msg;
  const entries = normalizeEntries(msg.entries);
  const base: Record<string, unknown> = {
    direction: record.direction,
    type: msg.type,
    topLevel: {
      name: msg.name,
      value: msg.value,
      params: msg.params,
      values: msg.values,
      names: msg.names,
    },
    entryCount: entries.length,
  };
  if (entries.length > 0) {
    base.entries = entries.map((e) => entryTypeSummary(e));
    base.entriesRaw = entries;
  }
  return base;
}

export function WatchIoMessageLogDrawer() {
  const open = useConnectionStore((s) => s.watchIoLogDrawerOpen);
  const setOpen = useConnectionStore((s) => s.setWatchIoLogDrawerOpen);
  const messages = useWatchIoMessageLogStore((s) => s.messages);
  const clear = useWatchIoMessageLogStore((s) => s.clear);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return [...messages].reverse();
    return [...messages].filter((m) => m.msg.type === typeFilter).reverse();
  }, [messages, typeFilter]);

  const typeOptions = useMemo(() => {
    const types = new Set(messages.map((m) => m.msg.type).filter(Boolean));
    return [
      { value: 'all', label: 'All types' },
      ...[...types].sort().map((t) => ({ value: t, label: t })),
    ];
  }, [messages]);

  return (
    <Drawer
      title="WatchIO raw messages"
      open={open}
      onClose={() => setOpen(false)}
      size="large"
      extra={
        <Space>
          <Select
            size="small"
            style={{ width: 140 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
          />
          <Button size="small" onClick={clear}>
            Clear
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Incoming WatchIO JSON (excluding high-frequency value-only updates). Expand a message to
        see raw <code>params</code> and parsed type fields (
        <code>varKind</code>, <code>dataType</code>). Connect and expand tree branches to capture
        varleaves responses.
      </Typography.Paragraph>
      {filtered.length === 0 ? (
        <Empty description="No messages yet — connect and load variables" />
      ) : (
        <Collapse
          accordion
          size="small"
          items={filtered.map((record) => ({
            key: String(record.id),
            label: (
              <span>
                {formatTime(record.at)} · {record.direction} · <strong>{record.msg.type}</strong>
                {normalizeEntries(record.msg.entries).length
                  ? ` · ${normalizeEntries(record.msg.entries).length} entries`
                  : ''}
              </span>
            ),
            children: (
              <pre className="watchio-log-json">{JSON.stringify(messageDetail(record), null, 2)}</pre>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
