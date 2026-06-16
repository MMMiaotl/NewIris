import type { ConnectionConfig } from '../api/types';

/** Keys workspace/plot persistence to one connection instance — must match across stores. */
export function workspaceScope(config: ConnectionConfig): string {
  return [config.transport, config.hostAddress, config.serverPath, config.watchIoName].join('|');
}
