/** WatchIoWebServer HTTP client — GET/POST on /watchio/{name}:option paths. */

import type { WatchIoMessage } from './types';
import type { MessageHandler, StatusHandler, WatchIoClient } from './watchIoClient';
import { smcHttpGet } from './smcHttp';
import { normalizeEntries, parseWatchIoResponse } from '../utils/parseWatchIoMessage';
import { watchIoLog, watchIoLogMessage } from '../utils/watchIoDebug';
import { buildWatchIoBase, buildWatchIoInstanceUrl } from './watchIoPaths';
import { WATCHIO_VARLEAVES_ATTRS } from './watchIoServerJson';

export class HttpWatchIoClient implements WatchIoClient {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private base: string;
  private watchIoName: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private registered = new Set<string>();
  private sampleInterval: number;

  constructor(
    httpHost: string,
    serverPath: string,
    watchIoName: string,
    sampleInterval = 500,
  ) {
    this.base = buildWatchIoBase(httpHost, serverPath);
    this.watchIoName = watchIoName;
    this.sampleInterval = sampleInterval;
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

  async connect(): Promise<void> {
    this.emitStatus('connecting', `WatchIO HTTP ${this.base}/${this.watchIoName}`);
    try {
      const openUrl = buildWatchIoInstanceUrl(
        this.base,
        this.watchIoName,
        'open',
        undefined,
        `watchioname=${encodeURIComponent(this.watchIoName)}`,
      );
      await smcHttpGet(openUrl, 15_000);
      this.connected = true;
      this.emitStatus('connected');
      this.fetchVarTree();
      this.startPolling();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'WatchIO HTTP connect failed';
      this.emitStatus('error', detail);
      throw err;
    }
  }

  disconnect(): void {
    this.stopPolling();
    this.connected = false;
    this.registered.clear();
    void this.postJson({ type: 'close' }).catch(() => undefined);
    this.emitStatus('disconnected');
  }

  fetchVarTree(branch?: string): void {
    void this.loadVarTree(branch);
  }

  fetchVarLeaves(branch: string, withMeta = true): void {
    void this.loadVarLeaves(branch, withMeta);
  }

  fetchVarList(_filter = ''): void {
    void this.requestJson({ type: 'varlist' });
  }

  addVariable(name: string, mode: 'value' | 'set' = 'set'): void {
    this.registered.add(name);
    const attrs = `mode=${mode}`;
    const url = buildWatchIoInstanceUrl(this.base, this.watchIoName, 'add', name, attrs);
    void smcHttpGet(url, 12_000)
      .then(({ text }) => this.handleResponse(text))
      .catch((err) => watchIoLog('http', `add ${name} failed`, err));
    this.startPolling();
  }

  removeVariable(name: string): void {
    this.registered.delete(name);
    const url = buildWatchIoInstanceUrl(this.base, this.watchIoName, 'delete', name);
    void smcHttpGet(url, 12_000).catch((err) => watchIoLog('http', `delete ${name} failed`, err));
  }

  setVariable(name: string, value: string): void {
    void this.postSetAndCommand(name, value);
  }

  requestUpdate(): void {
    void this.pollUpdate();
  }

  private async loadVarTree(branch?: string): Promise<void> {
    try {
      if (!branch) {
        const url = buildWatchIoInstanceUrl(
          this.base,
          this.watchIoName,
          'vartree',
          undefined,
          'fulltree=1',
        );
        const { text } = await smcHttpGet(url, 30_000);
        this.handleResponse(text, null);
        return;
      }

      const url = buildWatchIoInstanceUrl(
        this.base,
        this.watchIoName,
        'vartree',
        branch,
        'branch=1',
      );
      const { text } = await smcHttpGet(url, 30_000);
      this.handleResponse(text, branch);
    } catch (err) {
      watchIoLog('http', 'vartree failed', err);
    }
  }

  private async loadVarLeaves(branch: string, withMeta: boolean): Promise<void> {
    const attrs = withMeta ? WATCHIO_VARLEAVES_ATTRS : 'fullname=1';
    const url = buildWatchIoInstanceUrl(
      this.base,
      this.watchIoName,
      'varleaves',
      branch,
      attrs,
    );
    try {
      const { text } = await smcHttpGet(url, 30_000);
      const msg = parseWatchIoResponse(text);
      if (!msg) return;
      const entries = normalizeEntries(msg.entries).map((e) => ({
        ...e,
        name: e.name.includes('.') ? e.name : branch ? `${branch}.${e.name}` : e.name,
      }));
      this.emit({
        type: 'varleaves',
        entries,
        params: [{ name: 'attributes', value: `branch=${branch}` }],
      });
      this.emit({ type: 'status', entries: [{ name: 'status', value: '1' }] });
    } catch (err) {
      watchIoLog('http', `varleaves ${branch} failed`, err);
    }
  }

  private async pollUpdate(): Promise<void> {
    if (!this.connected) return;
    const url = buildWatchIoInstanceUrl(this.base, this.watchIoName, 'update');
    try {
      const { text } = await smcHttpGet(url, 15_000);
      this.handleResponse(text);
    } catch (err) {
      watchIoLog('http', 'update poll failed', err);
    }
  }

  private async postSetAndCommand(name: string, value: string): Promise<void> {
    try {
      await this.postJson({
        type: 'set',
        entries: [{ name, value }],
      });
      await this.postJson({ type: 'command' });
      watchIoLog('http', `set+command ${name}=${value}`);
    } catch (err) {
      watchIoLog('http', `set ${name} failed`, err);
    }
  }

  private async postJson(body: Record<string, unknown>): Promise<void> {
    const url = `${this.base}/${encodeURIComponent(this.watchIoName)}`;
    const payload = JSON.stringify(body) + '\r\n';
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        void res.body?.cancel();
        throw new Error(`POST failed: ${res.status}`);
      }
      const text = await res.text();
      if (text.trim()) this.handleResponse(text);
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async requestJson(body: Record<string, unknown>): Promise<void> {
    try {
      await this.postJson(body);
    } catch (err) {
      watchIoLog('http', 'request failed', err);
    }
  }

  private handleResponse(text: string, vartreeBranch?: string | null): void {
    const msg = parseWatchIoResponse(text);
    if (!msg) return;

    if (msg.type === 'vartree' && vartreeBranch !== undefined) {
      const branches = normalizeEntries(msg.entries)
        .map((e) => e.name)
        .filter(Boolean);
      this.emit({
        type: 'vartree',
        entries: branches.map((name) => ({ name })),
        params: [{ name: 'attributes', value: `branch=${vartreeBranch ?? ''}` }],
      });
      return;
    }

    if (msg.type === 'vartree' && !vartreeBranch) {
      const fromValues = Array.isArray(msg.values)
        ? msg.values
        : typeof msg.values === 'string'
          ? [msg.values]
          : [];
      const branches =
        fromValues.length > 0
          ? fromValues.filter(Boolean)
          : normalizeEntries(msg.entries)
              .map((e) => e.name)
              .filter(Boolean);
      this.emit({ type: 'vartree', entries: branches.map((name) => ({ name })) });
      return;
    }

    this.emit(msg);
  }

  private startPolling(): void {
    this.stopPolling();
    if (!this.connected) return;
    this.pollTimer = setInterval(() => void this.pollUpdate(), this.sampleInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
