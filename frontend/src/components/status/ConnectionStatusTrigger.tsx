/**
 * Compact connection summary in the header — opens ConnectionStatusDrawer on click.
 * Replaces the legacy footer bar for veteran users who want more vertical workspace.
 */
import { Tooltip } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';

function statusClass(status: string): string {
  if (status === 'connected') return 'footer-status--connected';
  if (status === 'error') return 'footer-status--error';
  if (status === 'connecting') return 'footer-status--connecting';
  return 'footer-status--disconnected';
}

export function ConnectionStatusTrigger() {
  const {
    config,
    status,
    statusDetail,
    appMode,
    requestError,
    setStatusDrawerOpen,
  } = useConnectionStore();

  const modeLabel =
    appMode === 'offline' ? 'Offline' : appMode === 'replay' ? 'Replay' : status;

  const summary = `${config.transport} · ${config.hostAddress}${config.serverPath} · ${config.watchIoName}`;
  const tooltip = [summary, statusDetail, requestError].filter(Boolean).join('\n');

  return (
    <Tooltip title={tooltip || 'Connection details'}>
      <button
        type="button"
        className="connection-status-trigger"
        onClick={() => setStatusDrawerOpen(true)}
        aria-label="Open connection status"
      >
        <span className={`footer-status connection-status-trigger-badge ${statusClass(status)}`}>
          {modeLabel}
        </span>
        <span className="connection-status-trigger-summary">{summary}</span>
      </button>
    </Tooltip>
  );
}
