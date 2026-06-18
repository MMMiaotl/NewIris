import type { AppMode, ConnectionConfig } from '../api/types';

type ConnectStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const STATUS_CLASS: Record<ConnectStatus, string> = {
  connected: 'footer-status--connected',
  connecting: 'footer-status--connecting',
  error: 'footer-status--error',
  disconnected: 'footer-status--disconnected',
};

export function connectionStatusClass(status: ConnectStatus): string {
  return STATUS_CLASS[status];
}

export function connectionModeLabel(appMode: AppMode, status: ConnectStatus): string {
  if (appMode === 'offline') return 'Offline';
  if (appMode === 'replay') return 'Replay';
  return status;
}

export function connectionEndpointSummary(config: ConnectionConfig): string {
  return `${config.transport} · ${config.hostAddress}${config.serverPath} · ${config.watchIoName}`;
}
