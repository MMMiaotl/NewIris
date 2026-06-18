/**
 * Drawer for transport, endpoint, WatchIO name, and connection diagnostics.
 * Footer metadata and debug shortcuts live here instead of a persistent bar.
 */
import { Button, Descriptions, Drawer, Space, Typography } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';

function statusClass(status: string): string {
  if (status === 'connected') return 'footer-status--connected';
  if (status === 'error') return 'footer-status--error';
  if (status === 'connecting') return 'footer-status--connecting';
  return 'footer-status--disconnected';
}

export function ConnectionStatusDrawer() {
  const {
    config,
    status,
    statusDetail,
    appMode,
    requestStatus,
    requestError,
    discoveredServices,
    selectedServiceName,
    statusDrawerOpen,
    setStatusDrawerOpen,
    setWatchIoLogDrawerOpen,
    setConnectionModalOpen,
  } = useConnectionStore();

  const modeLabel =
    appMode === 'offline' ? 'Offline' : appMode === 'replay' ? 'Replay' : status;

  const selectedService = discoveredServices.find((s) => s.name === selectedServiceName);

  return (
    <Drawer
      title="Connection status"
      open={statusDrawerOpen}
      onClose={() => setStatusDrawerOpen(false)}
      size="default"
      extra={
        <Space>
          <Button size="small" onClick={() => setConnectionModalOpen(true)}>
            Settings
          </Button>
          <Button
            size="small"
            onClick={() => {
              setStatusDrawerOpen(false);
              setWatchIoLogDrawerOpen(true);
            }}
          >
            Message log
          </Button>
        </Space>
      }
    >
      <div className="connection-status-drawer-body">
        <span className={`footer-status ${statusClass(status)}`}>{modeLabel}</span>
        {statusDetail && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {statusDetail}
          </Typography.Paragraph>
        )}
        {requestError && (
          <Typography.Paragraph type="danger" style={{ marginTop: 8, marginBottom: 0 }}>
            {requestError}
          </Typography.Paragraph>
        )}

        <Descriptions
          className="connection-status-descriptions"
          size="small"
          column={1}
          bordered
          items={[
            { key: 'mode', label: 'App mode', children: appMode },
            { key: 'transport', label: 'Transport', children: config.transport },
            { key: 'host', label: 'Host', children: config.hostAddress },
            { key: 'path', label: 'Server path', children: config.serverPath || '—' },
            { key: 'watchio', label: 'WatchIO name', children: config.watchIoName },
            {
              key: 'service',
              label: 'Selected service',
              children: selectedService
                ? `${selectedService.name} → ${selectedService.uri}`
                : selectedServiceName ?? '—',
            },
            { key: 'discover', label: 'Discovery', children: requestStatus },
            {
              key: 'sample',
              label: 'Sample interval',
              children: `${config.sampleInterval} ms`,
            },
            ...(config.httpUrl
              ? [{ key: 'http', label: 'HTTP URL override', children: config.httpUrl }]
              : []),
            ...(config.wsUrl
              ? [{ key: 'ws', label: 'WebSocket URL', children: config.wsUrl }]
              : []),
          ]}
        />
      </div>
    </Drawer>
  );
}
