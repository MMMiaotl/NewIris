/**
 * Single factory for transport clients. All live I/O goes through useWatchIo → createWatchIoClient.
 */
import { HttpWatchIoClient } from './httpWatchIoClient';
import { SmcServerClient } from './smcServerClient';
import { StompWatchIoClient } from './stompWatchIoClient';
import type { ConnectionConfig } from './types';
import type { WatchIoClient } from './watchIoClient';
import { defaultWsUrl } from './watchIoPaths';

export function createWatchIoClient(config: ConnectionConfig): WatchIoClient {
  switch (config.transport) {
    case 'watchIoHttp':
      return new HttpWatchIoClient(
        config.httpUrl,
        config.serverPath,
        config.watchIoName,
        config.sampleInterval,
      );
    case 'watchIoWs':
    case 'sharedMemory':
      return new StompWatchIoClient(
        config.wsUrl || defaultWsUrl(config.hostAddress),
        config.serverPath,
        config.watchIoName,
        config.sampleInterval,
      );
    case 'smcServer':
      return new SmcServerClient(config.httpUrl, config.serverPath, config.sampleInterval);
  }
}
