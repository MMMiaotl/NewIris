import { Tooltip } from 'antd';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  connectionEndpointSummary,
  connectionModeLabel,
  connectionStatusClass,
} from '../../utils/connectionStatus';

export function ConnectionStatusTrigger() {
  const { config, status, statusDetail, appMode, requestError, setStatusDrawerOpen } =
    useConnectionStore();

  const summary = connectionEndpointSummary(config);
  const tooltip = [summary, statusDetail, requestError].filter(Boolean).join('\n');

  return (
    <Tooltip title={tooltip || 'Connection details'}>
      <button
        type="button"
        className="connection-status-trigger"
        onClick={() => setStatusDrawerOpen(true)}
        aria-label="Open connection status"
      >
        <span className={`footer-status connection-status-trigger-badge ${connectionStatusClass(status)}`}>
          {connectionModeLabel(appMode, status)}
        </span>
        <span className="connection-status-trigger-summary">{summary}</span>
      </button>
    </Tooltip>
  );
}
