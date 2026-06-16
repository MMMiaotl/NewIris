/** WatchIoWebServer WebSocket/STOMP client — ws://host:8083 destination=/watchio */

import type { VariableType, WatchIoMessage } from './types';
import type { MessageHandler, StatusHandler, WatchIoClient } from './watchIoClient';
import {
  decodeWebSocketData,
  formatStompFrame,
  parseStompFrames,
} from './stompFrame';
import { watchIoAttributesParam, watchIoEntry, WATCHIO_VARLEAVES_ATTRS, WATCHIO_VARTREE_BRANCH_ATTRS, watchIoMonitorAttributes } from './watchIoServerJson';
import { parseWatchIoResponse, isDataReady, parseVartreeParent, extractBranchNames } from '../utils/parseWatchIoMessage';
import { watchIoLog, watchIoLogMessage, watchIoLogSendBody, watchIoLogVerbose } from '../utils/watchIoDebug';

/** Retry root vartree when segment is not dataok yet or response is empty. */
const VARTREE_RETRY_MS = 150;
const VARTREE_MAX_RETRIES = 15;
/** Release metadata queue if server never replies to varleaves. */
const METADATA_REQUEST_TIMEOUT_MS = 3000;

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
  private vartreeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private awaitingVartree = false;
  private vartreeRetryCount = 0;
  private rootVarTreeLoaded = false;
  private lastVarLeavesBranch: string | null = null;
  private metadataQueue: Array<{ kind: 'varleaves'; branch: string; withMeta: boolean }> = [];
  private metadataInFlight: (typeof this.metadataQueue)[number] | null = null;
  private metadataTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
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
        } else if (msg.type === 'varleaves') {
          const inflight = this.metadataInFlight;
          const branch =
            inflight?.kind === 'varleaves'
              ? inflight.branch
              : this.lastVarLeavesBranch;
          if (branch) {
            this.lastVarLeavesBranch = branch;
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
          }
          if (this.metadataInFlight?.kind === 'varleaves') {
            this.completeMetadataRequest('response');
          }
        } else if (
          msg.type === 'status' &&
          this.awaitingVartree &&
          !this.rootVarTreeLoaded
        ) {
          if (isDataReady(msg)) {
            watchIoLog('ws', 'dataok — requesting vartree');
            this.sendJsonNow({ type: 'vartree' });
          } else {
            this.scheduleVarTreeRetry();
          }
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
        queueMicrotask(() => {
          this.flushPendingSend();
          this.beginRootVarTreeLoad();
          resolve();
        });
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
        this.pendingSend = [];
        if (this.ws === ws) {
          this.ws = null;
        }
        this.emitStatus('disconnected');
      };
    });
  }

  disconnect(): void {
    this.clearVarTreeRetry();
    this.clearMetadataTimeout();
    this.awaitingVartree = false;
    this.vartreeRetryCount = 0;
    this.rootVarTreeLoaded = false;
    this.lastVarLeavesBranch = null;
    this.metadataQueue = [];
    this.metadataInFlight = null;
    this.monitoredNames.clear();
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
    if (!branch) {
      this.beginRootVarTreeLoad();
      return;
    }
    this.sendJson({
      type: 'vartree',
      entries: [watchIoEntry(branch, WATCHIO_VARTREE_BRANCH_ATTRS)],
    });
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

  fetchVarLeaves(branch: string, withMeta = true, priority = false): void {
    if (
      this.metadataInFlight?.kind === 'varleaves' &&
      this.metadataInFlight.branch === branch
    ) {
      return;
    }
    this.metadataQueue = this.metadataQueue.filter(
      (req) => !(req.kind === 'varleaves' && req.branch === branch),
    );
    const req = { kind: 'varleaves' as const, branch, withMeta };
    if (priority) {
      this.metadataQueue.unshift(req);
    } else {
      this.metadataQueue.push(req);
    }
    this.pumpMetadataQueue();
  }

  /** Serialize varleaves requests — one in flight avoids branch mis-association. */
  private pumpMetadataQueue(): void {
    if (this.metadataInFlight || this.metadataQueue.length === 0) return;
    const req = this.metadataQueue.shift()!;
    this.metadataInFlight = req;
    this.scheduleMetadataTimeout();
    this.lastVarLeavesBranch = req.branch;
    const attrs = req.withMeta ? WATCHIO_VARLEAVES_ATTRS : 'fullname=1';
    this.sendJson({
      type: 'varleaves',
      entries: [watchIoEntry(req.branch, attrs)],
    });
  }

  private scheduleMetadataTimeout(): void {
    this.clearMetadataTimeout();
    this.metadataTimeoutTimer = setTimeout(() => {
      this.metadataTimeoutTimer = null;
      this.completeMetadataRequest('timeout');
    }, METADATA_REQUEST_TIMEOUT_MS);
  }

  private clearMetadataTimeout(): void {
    if (this.metadataTimeoutTimer) {
      clearTimeout(this.metadataTimeoutTimer);
      this.metadataTimeoutTimer = null;
    }
  }

  private completeMetadataRequest(reason: 'response' | 'timeout'): void {
    if (!this.metadataInFlight) return;
    if (reason === 'timeout') {
      watchIoLog('ws', 'metadata request timed out', this.metadataInFlight);
    }
    this.clearMetadataTimeout();
    this.metadataInFlight = null;
    queueMicrotask(() => this.pumpMetadataQueue());
  }

  fetchVarList(filter = ''): void {
    this.sendJson(
      filter
        ? { type: 'varlist', params: watchIoAttributesParam(`matchfilter=${filter}`) }
        : { type: 'varlist' },
    );
  }

  addVariable(name: string, mode: 'value' | 'set' = 'set', dataType?: VariableType): void {
    this.monitoredNames.add(name);
    this.sendJson({
      type: 'add',
      entries: [watchIoEntry(name, watchIoMonitorAttributes(dataType, mode))],
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
    if (!this.subscribed) {
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
