import { useEffect } from 'react';
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import { PlugConnectedIcon, PlugDisconnectedIcon } from './PlugIcons';
import { WatchIoNameField } from './WatchIoNameField';
import {
  createDefaultWatchIoService,
  fetchRequestServices,
  isWatchIoTransport,
} from '../../api/smcHttp';
import { defaultWsUrl } from '../../api/watchIoPaths';
import type { ConnectionTransport } from '../../api/types';
import { defaultWatchIoNames, transportOptions } from '../../constants/transport';
import { predefinedHosts, useConnectionStore } from '../../stores/connectionStore';
import { watchIoLog } from '../../utils/watchIoDebug';

function applyWatchIoDefaults(
  setDiscoveredServices: (services: ReturnType<typeof createDefaultWatchIoService>[]) => void,
  selectService: (name: string) => void,
) {
  const fallback = createDefaultWatchIoService();
  setDiscoveredServices([fallback]);
  selectService(fallback.name);
}

interface ConnectionBarProps {
  onConnect: () => void;
  onDisconnect: () => void;
}

/** request → select service → Connect (SmcServer or WatchIoWebServer). */
export function ConnectionBar({ onConnect, onDisconnect }: ConnectionBarProps) {
  const {
    config,
    discoveredServices,
    selectedServiceName,
    requestStatus,
    requestError,
    setConfig,
    setDiscoveredServices,
    selectService,
    setRequestStatus,
    status,
    appMode,
  } = useConnectionStore();

  const isWatchIo = isWatchIoTransport(config.transport);
  const isWatchIoWs = config.transport === 'watchIoWs';
  const defaultWatchIo = createDefaultWatchIoService();
  const watchIoFromRequest = discoveredServices.some(
    (s) =>
      s.uri.toLowerCase().includes('/watchio') && s.description !== defaultWatchIo.description,
  );

  useEffect(() => {
    if (!isWatchIoWs || selectedServiceName) return;
    applyWatchIoDefaults(setDiscoveredServices, selectService);
    setRequestStatus('ok');
  }, [isWatchIoWs, selectedServiceName, setDiscoveredServices, selectService, setRequestStatus]);

  const onTransportChange = (transport: ConnectionTransport) => {
    setConfig({
      transport,
      serverPath: transport === 'smcServer' ? '/SmcServer1' : '/watchio',
      watchIoName: defaultWatchIoNames[transport],
    });
    setRequestStatus('idle');
    if (isWatchIoTransport(transport)) {
      applyWatchIoDefaults(setDiscoveredServices, selectService);
      setRequestStatus('ok');
    } else {
      setDiscoveredServices([]);
    }
  };

  const doRequest = async () => {
    setRequestStatus('loading');
    try {
      const services = await fetchRequestServices(
        config.httpUrl,
        config.transport,
        config.wsUrl || defaultWsUrl(config.hostAddress),
      );
      setDiscoveredServices(services);
      setRequestStatus('ok');
      watchIoLog('discover', `/request (${config.transport})`, {
        count: services.length,
        services,
      });

      const pick =
        config.transport === 'smcServer'
          ? (services.find((s) => s.name === 'SmcServer1') ??
            services.find((s) => s.uri.toLowerCase().includes('smcserver1')) ??
            services[0])
          : (services.find((s) => s.uri.toLowerCase().includes('/watchio')) ?? services[0]);
      if (pick) selectService(pick.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setRequestStatus('error', msg);
      if (isWatchIo) {
        applyWatchIoDefaults(setDiscoveredServices, selectService);
      } else {
        setDiscoveredServices([]);
      }
    }
  };

  const serviceOptions = discoveredServices.map((s) => ({
    label: `${s.name} → ${s.uri}${s.category ? ` [${s.category}]` : ''}`,
    value: s.name,
  }));

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const connectDisabled =
    appMode !== 'live' ||
    isConnecting ||
    (config.transport === 'smcServer' && !selectedServiceName);

  const servicePlaceholder =
    isWatchIo
      ? 'Default /watchio — Connect directly'
      : requestStatus === 'idle' && !selectedServiceName
        ? 'Click request first'
        : 'Select SmcServer';

  return (
    <div className="connection-bar">
      <Space wrap size="small" align="center">
        <Typography.Text type="secondary">Transport</Typography.Text>
        <Space.Compact className="transport-connect-group">
          <Select
            style={{ width: 200 }}
            value={config.transport}
            onChange={onTransportChange}
            options={transportOptions}
          />
          <Tooltip
            title={
              appMode !== 'live'
                ? 'Not available in offline/replay mode'
                : isConnected
                  ? 'Disconnect'
                  : config.transport === 'smcServer' && !selectedServiceName
                    ? 'Select a service first'
                    : 'Connect'
            }
          >
            <Button
              className={isConnected ? 'connect-btn connect-btn--connected' : 'connect-btn'}
              icon={
                isConnected ? (
                  <PlugConnectedIcon />
                ) : (
                  <PlugDisconnectedIcon />
                )
              }
              loading={isConnecting}
              disabled={connectDisabled && !isConnected}
              onClick={isConnected ? onDisconnect : onConnect}
              aria-label={isConnected ? 'Disconnect' : 'Connect'}
            />
          </Tooltip>
        </Space.Compact>
        {!isWatchIoWs && (
          <>
            <Typography.Text type="secondary">Server</Typography.Text>
            <Select
              style={{ width: 160 }}
              value={config.hostAddress}
              onChange={(hostAddress) => setConfig({ hostAddress })}
              options={predefinedHosts.map((h) => ({ label: h, value: h }))}
            />
            <Button loading={requestStatus === 'loading'} onClick={() => void doRequest()}>
              request
            </Button>
            <Typography.Text type="secondary">Service</Typography.Text>
            <Select
              style={{ minWidth: 260 }}
              placeholder={servicePlaceholder}
              value={selectedServiceName ?? undefined}
              onChange={selectService}
              options={serviceOptions}
            />
          </>
        )}
        <Typography.Text type="secondary">WatchIO</Typography.Text>
        <WatchIoNameField
          appliedName={config.watchIoName}
          onApply={(watchIoName) => setConfig({ watchIoName })}
          placeholder={isWatchIo ? 'SmcControl1 / CasServer' : 'SmcControl1'}
          connected={status === 'connected'}
        />
        {requestStatus === 'error' && (
          <Typography.Text type="danger">{requestError}</Typography.Text>
        )}
        {isWatchIo && !isWatchIoWs && requestStatus === 'ok' && !watchIoFromRequest && (
          <Typography.Text type="secondary">
            HTTP /request has no /watchio — using default; need http=1 on WatchIoWebServer
          </Typography.Text>
        )}
        {requestStatus === 'ok' && !discoveredServices.length && config.transport === 'smcServer' && (
          <Typography.Text type="warning">
            No SmcServer in /request — ensure HttpWebServer is running
          </Typography.Text>
        )}
      </Space>
    </div>
  );
}
