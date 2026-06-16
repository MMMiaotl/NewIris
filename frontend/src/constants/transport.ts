import type { ConnectionTransport } from '../api/types';

export const transportOptions: { label: string; value: ConnectionTransport }[] = [
  { label: 'SmcServer API', value: 'smcServer' },
  { label: 'Shared Memory', value: 'sharedMemory' },
  { label: 'WatchIO HTTP', value: 'watchIoHttp' },
  { label: 'WatchIO WebSocket', value: 'watchIoWs' },
];

const validTransports = new Set<ConnectionTransport>(
  transportOptions.map((o) => o.value),
);

export function parseTransportEnv(value: string | undefined): ConnectionTransport {
  if (value && validTransports.has(value as ConnectionTransport)) {
    return value as ConnectionTransport;
  }
  return 'watchIoWs';
}

export function isSmcServerTransport(transport: ConnectionTransport): boolean {
  return transport === 'smcServer';
}

/** Default gateway path when switching transport or restoring sessions without serverPath. */
export function defaultServerPath(transport: ConnectionTransport): string {
  return isSmcServerTransport(transport) ? '/SmcServer1' : '/watchio';
}

export const defaultWatchIoNames: Record<ConnectionTransport, string> = {
  smcServer: 'SmcControl1',
  sharedMemory: 'SmcControl1',
  watchIoHttp: 'SmcControl1',
  watchIoWs: 'SmcControl1',
};
