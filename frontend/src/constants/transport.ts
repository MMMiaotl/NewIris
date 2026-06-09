import type { ConnectionTransport } from '../api/types';

export const transportOptions: { label: string; value: ConnectionTransport }[] = [
  { label: 'SmcServer API (/SmcServer1)', value: 'smcServer' },
  { label: 'WatchIO HTTP (/watchio)', value: 'watchIoHttp' },
  { label: 'WatchIO WebSocket (STOMP)', value: 'watchIoWs' },
];

const validTransports = new Set<ConnectionTransport>(
  transportOptions.map((o) => o.value),
);

export function parseTransportEnv(value: string | undefined): ConnectionTransport {
  if (value && validTransports.has(value as ConnectionTransport)) {
    return value as ConnectionTransport;
  }
  return 'smcServer';
}

export const defaultWatchIoNames: Record<ConnectionTransport, string> = {
  smcServer: 'SmcControl1',
  watchIoHttp: 'SmcControl1',
  watchIoWs: 'SmcControl1',
};
