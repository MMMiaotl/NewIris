/** Discover registered services via STOMP destination:/request on ws://host:8083 */

import type { DiscoveredService } from './types';
import {
  createDefaultWatchIoService,
  entryParam,
  isWatchIoGatewayService,
} from './smcHttp';
import { decodeWebSocketData, formatStompFrame, parseStompFrames } from './stompFrame';
import { watchIoLog } from '../utils/watchIoDebug';
import { parseSmcJson } from '../utils/parseSmcJson';

const WS_REQUEST_TIMEOUT_MS = 8000;
const SUBSCRIBE_SETTLE_MS = 120;

function mapRequestEntries(data: ReturnType<typeof parseSmcJson>): DiscoveredService[] {
  if (!data) return [];
  return data.entries
    .filter((e) => e.value && isWatchIoGatewayService(e))
    .map((entry) => ({
      name: entry.name,
      uri: entry.value!,
      category: entryParam(entry, 'category'),
      description: entryParam(entry, 'description'),
    }));
}

function safeWsSend(ws: WebSocket, data: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(data);
    return true;
  } catch {
    return false;
  }
}

/** WS host lists WatchIoWebServer when HTTP GET :8082/request is empty. */
export function fetchRequestServicesViaWebSocket(wsUrl: string): Promise<DiscoveredService[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    let stompBuffer = '';
    let settled = false;
    let sendTimer: ReturnType<typeof setTimeout> | null = null;
    const requestId = 'NewIrisRequest';

    const clearSendTimer = () => {
      if (sendTimer) {
        clearTimeout(sendTimer);
        sendTimer = null;
      }
    };

    const closeWs = () => {
      if (ws.readyState === WebSocket.OPEN) {
        safeWsSend(ws, formatStompFrame('UNSUBSCRIBE', { id: requestId }));
      }
      window.setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }, 30);
    };

    const finish = (services: DiscoveredService[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearSendTimer();
      closeWs();
      resolve(services);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearSendTimer();
      closeWs();
      reject(err);
    };

    const timer = window.setTimeout(
      () => fail(new Error(`WS /request timed out (${WS_REQUEST_TIMEOUT_MS}ms)`)),
      WS_REQUEST_TIMEOUT_MS,
    );

    const handleMessage = (text: string) => {
      stompBuffer += text;
      const { frames, rest } = parseStompFrames(stompBuffer);
      stompBuffer = rest;

      for (const frame of frames) {
        if (frame.command === 'ERROR') {
          fail(new Error(frame.headers.message ?? frame.body ?? 'STOMP ERROR'));
          return;
        }
        if (frame.command !== 'MESSAGE') continue;

        watchIoLog('discover', 'WS /request MESSAGE', frame.body.slice(0, 300));

        const data = parseSmcJson(frame.body);
        if (!data || data.type !== 'request') continue;

        const services = mapRequestEntries(data);
        watchIoLog('discover', 'WS /request parsed', {
          entryCount: data.entries.length,
          services,
        });
        finish(services.length ? services : [createDefaultWatchIoService()]);
      }
    };

    ws.onopen = () => {
      watchIoLog('discover', 'WS /request connect', wsUrl);
      safeWsSend(
        ws,
        formatStompFrame('SUBSCRIBE', { destination: '/request', id: requestId }),
      );
      sendTimer = window.setTimeout(() => {
        sendTimer = null;
        if (settled) return;
        const body = '{}';
        safeWsSend(
          ws,
          formatStompFrame(
            'SEND',
            {
              destination: '/request',
              id: requestId,
            },
            body,
          ),
        );
      }, SUBSCRIBE_SETTLE_MS);
    };

    ws.onmessage = (ev) => {
      void decodeWebSocketData(ev.data as string | Blob | ArrayBuffer)
        .then(handleMessage)
        .catch((err) => fail(err instanceof Error ? err : new Error('WS decode failed')));
    };

    ws.onerror = () => fail(new Error('WebSocket error during /request'));
    ws.onclose = () => {
      if (!settled) fail(new Error('WebSocket closed before /request response'));
    };
  });
}
