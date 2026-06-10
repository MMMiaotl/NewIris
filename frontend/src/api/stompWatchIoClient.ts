/** WatchIoWebServer WebSocket/STOMP client — ws://host:8083 destination=/watchio */

import type { WatchIoMessage } from './types';
import type { MessageHandler, MonitorVariable, StatusHandler, WatchIoClient } from './watchIoClient';
import {
  decodeWebSocketData,
  formatStompFrame,
  parseStompFrames,
} from './stompFrame';
import { watchIoAttributesParam, watchIoEntry, WATCHIO_VARLEAVES_ATTRS, WATCHIO_VARTREE_BRANCH_ATTRS, watchIoMonitorAttributes } from './watchIoServerJson';
import { parseWatchIoResponse, isDataReady, parseVartreeParent, extractBranchNames } from '../utils/parseWatchIoMessage';
import { watchIoLog, watchIoLogMessage, watchIoLogSendBody, watchIoLogVerbose } from '../utils/watchIoDebug';

/** Wait after STOMP SUBSCRIBE before first SEND (match watchIoWsDiscovery). */
const SUBSCRIBE_SETTLE_MS = 120;
/** Retry root vartree when segment is not dataok yet or response is empty. */
const VARTREE_RETRY_MS = 400;
const VARTREE_MAX_RETRIES = 10;

export class StompWatchIoClient implements WatchIoClient {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private ws: WebSocket | null = null;
  private stompBuffer = '';
  private wsUrl: string;
  private serverPath: string;
  private watchIoName: string;
  private subscribed = false;
  private pendingSend: Array<Record<string, unknown>> = [];
  private subscribeTimer: ReturnType<typeof setTimeout> | null = null;
  private vartreeDebounce: ReturnType<typeof setTimeout> | null = null;
  private vartreeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingVartree = false;
  private vartreeRetryCount = 0;
  private rootVarTreeLoaded = false;
  private lastVarLeavesBranch: string | null = null;
  private monitoredNames = new Set<string>();

  constructor(wsUrl: string, serverPath: string, watchIoName: string, _sampleInterval = 500) {
    this.wsUrl = wsUrl.replace(/\/$/, '');
    this.serverPath = serverPath.startsWith('/') ? serverPath : `/${serverPath}`;
    this.watchIoName = watchIoName;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private emitStatus(status: Parameters<StatusHandler>[0], detail?: string): void {
    watchIoLog('status', status, detail);
    for (const h of this.statusHandlers) h(status, detail);
  }

  private emit(msg: WatchIoMessage): void {
    watchIoLogMessage('recv', msg);
    for (const h of this.messageHandlers) h(msg);
  }

  private flushPendingSend(): void {
    const queue = this.pendingSend.splice(0);
    for (const body of queue) this.sendJsonNow(body);
  }

  private handleIncoming(text: string): void {
    if (!text) return;
    watchIoLogVerbose('ws', 'raw chunk', { bytes: text.length, buffer: this.stompBuffer.length + text.length });
    this.stompBuffer += text;
    const { frames, rest } = parseStompFrames(this.stompBuffer);
    this.stompBuffer = rest;
    if (frames.length) {
      watchIoLogVerbose('ws', `STOMP ${frames.length} MESSAGE frame(s)`);
    } else if (this.stompBuffer.length > 200) {
      watchIoLog('ws', 'unparsed STOMP buffer head', this.stompBuffer.slice(0, 200));
    }

    for (const frame of frames) {
      if (frame.command === 'ERROR') {
        watchIoLog('ws', 'STOMP ERROR', frame.body || frame.headers.message);
        this.emitStatus('error', frame.headers.message ?? frame.body ?? 'STOMP error');
        continue;
      }
      let msg = parseWatchIoResponse(frame.body.trim());
      if (msg) {
        if (msg.type === 'vartree') {
          const parent = parseVartreeParent(msg);
          const branches = extractBranchNames(msg);
          if (parent) {
            this.awaitingVartree = false;
            this.clearVarTreeRetry();
          } else if (branches.length > 0) {
            this.awaitingVartree = false;
            this.clearVarTreeRetry();
            this.rootVarTreeLoaded = true;
          } else if (this.awaitingVartree) {
            watchIoLog('ws', 'empty root vartree — segment may not be dataok yet, retrying');
            this.scheduleVarTreeRetry();
          }
        } else if (msg.type === 'varleaves' && this.lastVarLeavesBranch) {
          const branch = this.lastVarLeavesBranch;
          const existingParams = msg.params
            ? Array.isArray(msg.params)
              ? msg.params
              : [msg.params]
            : [];
          const params: Array<{ name: string; value: string }> = existingParams.map((p) => ({
            name: p.name,
            value: p.value,
          }));
          if (!params.some((p) => p.name === 'attributes' && p.value.includes('branch='))) {
            params.push({ name: 'attributes', value: `branch=${branch}` });
          }
          msg = { ...msg, params };
        } else if (
          msg.type === 'status' &&
          isDataReady(msg) &&
          this.awaitingVartree &&
          !this.rootVarTreeLoaded
        ) {
          watchIoLog('ws', 'dataok — requesting vartree');
          this.sendJsonNow({ type: 'vartree' });
        }
        this.emit(msg);
      } else {
        watchIoLog('ws', 'unparsed MESSAGE body', frame.body.slice(0, 200));
      }
    }
  }

  connect(): Promise<void> {
    this.emitStatus('connecting', `WatchIO WS ${this.wsUrl}`);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        const frame = formatStompFrame('SUBSCRIBE', {
          destination: this.serverPath,
          id: this.watchIoName,
          attributes: `watchioname=${this.watchIoName} includedescription=1`,
        });
        ws.send(frame);
        this.subscribed = true;
        this.emitStatus('connected');

        this.subscribeTimer = setTimeout(() => {
          this.subscribeTimer = null;
          this.flushPendingSend();
          this.beginRootVarTreeLoad();
          resolve();
        }, SUBSCRIBE_SETTLE_MS);
      };

      ws.onmessage = (ev) => {
        void decodeWebSocketData(ev.data as string | Blob | ArrayBuffer)
          .then((text) => this.handleIncoming(text))
          .catch((err) => watchIoLog('ws', 'decode failed', err));
      };

      ws.onerror = () => {
        const detail = 'WebSocket error';
        this.emitStatus('error', detail);
        reject(new Error(detail));
      };

      ws.onclose = () => {
        this.subscribed = false;
        if (this.subscribeTimer) {
          clearTimeout(this.subscribeTimer);
          this.subscribeTimer = null;
        }
        this.pendingSend = [];
        if (this.ws === ws) {
          this.ws = null;
        }
        this.emitStatus('disconnected');
      };
    });
  }

  disconnect(): void {
    if (this.vartreeDebounce) {
      clearTimeout(this.vartreeDebounce);
      this.vartreeDebounce = null;
    }
    this.clearVarTreeRetry();
    this.awaitingVartree = false;
    this.vartreeRetryCount = 0;
    this.rootVarTreeLoaded = false;
    this.lastVarLeavesBranch = null;
    this.monitoredNames.clear();
    if (this.subscribeTimer) {
      clearTimeout(this.subscribeTimer);
      this.subscribeTimer = null;
    }
    this.pendingSend = [];
    if (this.ws && this.subscribed) {
      try {
        const frame = formatStompFrame('UNSUBSCRIBE', { id: this.watchIoName });
        this.ws.send(frame);
      } catch {
        /* ignore */
      }
    }
    this.ws?.close();
    this.ws = null;
    this.subscribed = false;
    this.stompBuffer = '';
    this.emitStatus('disconnected');
  }

  fetchVarTree(branch?: string): void {
    if (this.vartreeDebounce) clearTimeout(this.vartreeDebounce);
    this.vartreeDebounce = setTimeout(() => {
      this.vartreeDebounce = null;
      if (!branch) {
        this.beginRootVarTreeLoad();
        return;
      }
      this.sendJson({
        type: 'vartree',
        entries: [watchIoEntry(branch, WATCHIO_VARTREE_BRANCH_ATTRS)],
      });
    }, 50);
  }

  /** Poll vartree until WatchIO segment is dataok or retries exhausted. */
  private beginRootVarTreeLoad(): void {
    this.awaitingVartree = true;
    this.rootVarTreeLoaded = false;
    this.vartreeRetryCount = 0;
    this.clearVarTreeRetry();
    this.scheduleVarTreeRetry(true);
  }

  private clearVarTreeRetry(): void {
    if (this.vartreeRetryTimer) {
      clearTimeout(this.vartreeRetryTimer);
      this.vartreeRetryTimer = null;
    }
  }

  private scheduleVarTreeRetry(immediate = false): void {
    this.clearVarTreeRetry();
    const delay = immediate ? 0 : VARTREE_RETRY_MS;
    this.vartreeRetryTimer = setTimeout(() => {
      this.vartreeRetryTimer = null;
      if (!this.awaitingVartree) return;

      this.vartreeRetryCount += 1;
      if (this.vartreeRetryCount === 1) {
        this.sendJsonNow({ type: 'status' });
      }
      this.sendJsonNow({ type: 'vartree' });

      if (this.vartreeRetryCount >= VARTREE_MAX_RETRIES) {
        watchIoLog('ws', 'vartree gave up after retries');
        this.awaitingVartree = false;
        return;
      }
      if (this.awaitingVartree) {
        this.scheduleVarTreeRetry();
      }
    }, delay);
  }

  fetchVarLeaves(branch: string, withMeta = true): void {
    this.lastVarLeavesBranch = branch;
    const attrs = withMeta ? WATCHIO_VARLEAVES_ATTRS : 'fullname=1';
    this.sendJson({
      type: 'varleaves',
      entries: [watchIoEntry(branch, attrs)],
    });
  }

  setMonitorList(variables: MonitorVariable[]): void {
    const next = new Set(variables.map((v) => v.name));
    if (variables.length === 0) {
      if (this.monitoredNames.size === 0) return;
      this.monitoredNames.clear();
      this.sendJson({ type: 'clear' });
      watchIoLog('ws', 'monitor clear');
      return;
    }

    const entries = variables.map((v) =>
      watchIoEntry(v.name, watchIoMonitorAttributes(v.dataType, v.mode ?? 'set')),
    );
    this.monitoredNames = next;
    this.sendJson({ type: 'list', entries });
    watchIoLog('ws', 'monitor list', { count: variables.length, sample: variables.slice(0, 5).map((v) => v.name) });
  }

  fetchVarList(filter = ''): void {
    this.sendJson(
      filter
        ? { type: 'varlist', params: watchIoAttributesParam(`matchfilter=${filter}`) }
        : { type: 'varlist' },
    );
  }

  addVariable(name: string, mode: 'value' | 'set' = 'set'): void {
    this.monitoredNames.add(name);
    this.sendJson({
      type: 'add',
      entries: [watchIoEntry(name, watchIoMonitorAttributes(undefined, mode))],
    });
  }

  removeVariable(name: string): void {
    this.monitoredNames.delete(name);
    this.sendJson({ type: 'delete', entries: [{ name }] });
  }

  setVariable(name: string, value: string): void {
    this.sendJson({ type: 'set', entries: [{ name, value }] });
    this.sendJson({ type: 'command' });
  }

  requestUpdate(): void {
    this.sendJson({ type: 'update' });
  }

  private sendJson(body: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.pendingSend.length > 0 || this.subscribeTimer) {
      this.pendingSend.push(body);
      return;
    }
    this.sendJsonNow(body);
  }

  private sendJsonNow(body: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify(body);
    const frame = formatStompFrame('SEND', {
      destination: this.serverPath,
      id: this.watchIoName,
    }, payload);
    watchIoLogSendBody(body);
    try {
      this.ws.send(frame);
    } catch (err) {
      watchIoLog('ws', 'SEND failed', err);
    }
  }
}
