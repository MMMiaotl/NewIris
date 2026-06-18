import { useEffect } from 'react';
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import { PlugConnectedIcon, PlugDisconnectedIcon } from './PlugIcons';
import { WatchIoNameField } from './WatchIoNameField';
import { createDefaultWatchIoService, isWatchIoTransport, isStompWatchIoTransport } from '../../api/smcHttp';
import { isSharedMemoryTransport, isSmcServerTransport, transportOptions } from '../../constants/transport';
import { predefinedHosts, useConnectionStore } from '../../stores/connectionStore';

interface ConnectionBarProps {
  onConnect: () => void | Promise<boolean | void>;
  onDisconnect: () => void;
  onApplyWatchIoName: (name: string) => Promise<boolean | 'saved'>;
}

export function ConnectionBar({
  onConnect,
  onDisconnect,
  onApplyWatchIoName,
}: ConnectionBarProps) {
  const {
    config,
    discoveredServices,
    selectedServiceName,
    requestStatus,
    requestError,
    setConfig,
    setTransport,
    resetWatchIoDiscovery,
    runDiscovery,
    selectService,
    status,
    appMode,
  } = useConnectionStore();

  const isWatchIo = isWatchIoTransport(config.transport);
  const isStomp = isStompWatchIoTransport(config.transport);
  const isShm = isSharedMemoryTransport(config.transport);
  const defaultWatchIo = createDefaultWatchIoService();
  const watchIoFromRequest = discoveredServices.some(
    (s) =>
      s.uri.toLowerCase().includes('/watchio') && s.description !== defaultWatchIo.description,
  );

  useEffect(() => {
    if (!isStomp || selectedServiceName) return;
    resetWatchIoDiscovery();
  }, [isStomp, selectedServiceName, resetWatchIoDiscovery]);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const connectDisabled =
    appMode !== 'live' ||
    isConnecting ||
    (isSmcServerTransport(config.transport) && !selectedServiceName);

  const servicePlaceholder = isWatchIo
    ? 'Default /watchio — Connect directly'
    : requestStatus === 'idle' && !selectedServiceName
      ? 'Click request first'
      : 'Select SmcServer';

  return (
    <div className="connection-bar">
      <Space wrap size="small" align="center">
        <Typography.Text type="secondary">Connection type</Typography.Text>
        <Space.Compact className="transport-connect-group">
          <Select
            style={{ width: 200 }}
            value={config.transport}
            onChange={setTransport}
            options={transportOptions}
          />
          <Tooltip
            title={
              appMode !== 'live'
                ? 'Not available in offline/replay mode'
                : isConnected
                  ? 'Disconnect'
                  : isSmcServerTransport(config.transport) && !selectedServiceName
                    ? 'Select a service first'
                    : 'Connect'
            }
          >
            <Button
              className={isConnected ? 'connect-btn connect-btn--connected' : 'connect-btn'}
              icon={isConnected ? <PlugConnectedIcon /> : <PlugDisconnectedIcon />}
              loading={isConnecting}
              disabled={connectDisabled && !isConnected}
              onClick={isConnected ? onDisconnect : onConnect}
              aria-label={isConnected ? 'Disconnect' : 'Connect'}
            />
          </Tooltip>
        </Space.Compact>
        {!isStomp && !isShm && (
          <>
            <Typography.Text type="secondary">Server</Typography.Text>
            <Select
              style={{ width: 160 }}
              value={config.hostAddress}
              onChange={(hostAddress) => setConfig({ hostAddress })}
              options={predefinedHosts.map((h) => ({ label: h, value: h }))}
            />
            <Tooltip title="GET /request — discover services">
              <Button loading={requestStatus === 'loading'} onClick={() => void runDiscovery()}>
                Discover
              </Button>
            </Tooltip>
            {isSmcServerTransport(config.transport) && (
              <>
                <Typography.Text type="secondary">Service</Typography.Text>
                <Select
                  style={{ minWidth: 260 }}
                  placeholder={servicePlaceholder}
                  value={selectedServiceName ?? undefined}
                  onChange={selectService}
                  options={discoveredServices.map((s) => ({
                    label: `${s.name} → ${s.uri}${s.category ? ` [${s.category}]` : ''}`,
                    value: s.name,
                  }))}
                />
              </>
            )}
          </>
        )}
        <Typography.Text type="secondary">WatchIO</Typography.Text>
        <WatchIoNameField
          appliedName={config.watchIoName}
          onApply={onApplyWatchIoName}
          placeholder={isWatchIo ? 'SmcControl1 / CasServer' : 'SmcControl1'}
          connected={status === 'connected' || status === 'connecting'}
        />
        {requestStatus === 'error' && (
          <Typography.Text type="danger">{requestError}</Typography.Text>
        )}
        {isShm && (
          <Typography.Text type="secondary">
            WatchIoCom.ocx (Edge IE mode) — local shared memory
          </Typography.Text>
        )}
        {isWatchIo && !isStomp && !isShm && requestStatus === 'ok' && !watchIoFromRequest && (
          <Typography.Text type="secondary">
            HTTP /request has no /watchio — using default; need http=1 on WatchIoWebServer
          </Typography.Text>
        )}
        {requestStatus === 'ok' &&
          !discoveredServices.length &&
          isSmcServerTransport(config.transport) && (
            <Typography.Text type="warning">
              No SmcServer in /request — ensure HttpWebServer is running
            </Typography.Text>
          )}
      </Space>
    </div>
  );
}
