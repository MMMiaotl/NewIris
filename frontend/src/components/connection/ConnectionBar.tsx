import { Button, Input, Select, Space, Typography } from 'antd';
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

/** request → select service → Connect (SmcServer or WatchIoWebServer). */
export function ConnectionBar() {
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
  } = useConnectionStore();

  const isWatchIo = isWatchIoTransport(config.transport);
  const wsDisplay = config.wsUrl || defaultWsUrl(config.hostAddress);
  const defaultWatchIo = createDefaultWatchIoService();
  const watchIoFromRequest = discoveredServices.some(
    (s) =>
      s.uri.toLowerCase().includes('/watchio') && s.description !== defaultWatchIo.description,
  );

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
        <Select
          style={{ width: 220 }}
          value={config.transport}
          onChange={onTransportChange}
          options={transportOptions}
        />
        <Typography.Text type="secondary">
          {config.transport === 'watchIoWs' ? 'HTTP gateway' : 'Server'}
        </Typography.Text>
        <Select
          style={{ width: 160 }}
          value={config.hostAddress}
          onChange={(hostAddress) => setConfig({ hostAddress })}
          options={predefinedHosts.map((h) => ({ label: h, value: h }))}
        />
        {config.transport === 'watchIoWs' && (
          <>
            <Typography.Text type="secondary">WebSocket</Typography.Text>
            <Typography.Text code style={{ fontSize: 12 }}>
              {wsDisplay}
            </Typography.Text>
          </>
        )}
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
        <Typography.Text type="secondary">WatchIO</Typography.Text>
        <Input
          style={{ width: 140 }}
          value={config.watchIoName}
          onChange={(e) => setConfig({ watchIoName: e.target.value })}
          placeholder={isWatchIo ? 'SmcControl1 / CasServer' : 'SmcControl1'}
        />
        {requestStatus === 'error' && (
          <Typography.Text type="danger">{requestError}</Typography.Text>
        )}
        {isWatchIo && requestStatus === 'ok' && !watchIoFromRequest && config.transport === 'watchIoHttp' && (
          <Typography.Text type="secondary">
            HTTP /request has no /watchio — using default; need http=1 on WatchIoWebServer
          </Typography.Text>
        )}
        {isWatchIo && requestStatus === 'ok' && !watchIoFromRequest && config.transport === 'watchIoWs' && (
          <Typography.Text type="secondary">
            WS /request unavailable — using default /watchio; Connect if WatchIoWebServer is on :8083
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
