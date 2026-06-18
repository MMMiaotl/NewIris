import { Button, Descriptions, Drawer, Space, Typography } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';
import { connectionModeLabel, connectionStatusClass } from '../../utils/connectionStatus';

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

  const selectedService = discoveredServices.find((s) => s.name === selectedServiceName);
  const serviceLabel = selectedService
    ? `${selectedService.name} → ${selectedService.uri}`
    : (selectedServiceName ?? '—');

  const descriptionItems = [
    { key: 'mode', label: 'App mode', children: appMode },
    { key: 'transport', label: 'Transport', children: config.transport },
    { key: 'host', label: 'Host', children: config.hostAddress },
    { key: 'path', label: 'Server path', children: config.serverPath || '—' },
    { key: 'watchio', label: 'WatchIO name', children: config.watchIoName },
    { key: 'service', label: 'Selected service', children: serviceLabel },
    { key: 'discover', label: 'Discovery', children: requestStatus },
    { key: 'sample', label: 'Sample interval', children: `${config.sampleInterval} ms` },
    ...(config.httpUrl ? [{ key: 'http', label: 'HTTP URL override', children: config.httpUrl }] : []),
    ...(config.wsUrl ? [{ key: 'ws', label: 'WebSocket URL', children: config.wsUrl }] : []),
  ];

  return (
    <Drawer
      title="Connection status"
      open={statusDrawerOpen}
      onClose={() => setStatusDrawerOpen(false)}
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
      <span className={`footer-status ${connectionStatusClass(status)}`}>
        {connectionModeLabel(appMode, status)}
      </span>
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
        items={descriptionItems}
      />
    </Drawer>
  );
}
