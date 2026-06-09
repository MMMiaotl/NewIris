/** SmcServer API client — mirrors Web/SmcServerView.js against /SmcServer1. */

import type { WatchIoMessage } from './types';
import type { MessageHandler, StatusHandler, WatchIoClient } from './watchIoClient';
import { buildServiceAddress, smcHttpGet } from './smcHttp';
import { normalizeEntries, parseWatchIoResponse } from '../utils/parseWatchIoMessage';
import { watchIoLog, watchIoLogMessage } from '../utils/watchIoDebug';

export class SmcServerClient implements WatchIoClient {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private serverBase: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private moduleObjects = new Map<string, string[]>();
  private activeObjectPath: string | null = null;
  private varPrefix = '';
  private pollPaths = new Set<string>();
  private nameToPostPath = new Map<string, string>();
  private pathVarPrefix = new Map<string, string>();
  private sampleInterval: number;

  constructor(httpHost: string, serverPath: string, sampleInterval = 500) {
    this.serverBase = buildServiceAddress(httpHost, serverPath);
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
    this.emitStatus('connecting', `SmcServer ${this.serverBase}`);
    try {
      const { text } = await smcHttpGet(this.serverBase, 8000);
      const msg = parseWatchIoResponse(text);
      if (!msg || msg.type !== 'module') {
        throw new Error('SmcServer root did not return type=module');
      }
      this.connected = true;
      this.emitStatus('connected');
      this.fetchVarTree();
      this.startPolling();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'SmcServer connect failed';
      this.emitStatus('error', detail);
      throw err;
    }
  }

  disconnect(): void {
    this.stopPolling();
    this.connected = false;
    this.moduleObjects.clear();
    this.activeObjectPath = null;
    this.pollPaths.clear();
    this.nameToPostPath.clear();
    this.pathVarPrefix.clear();
    this.emitStatus('disconnected');
  }

  fetchVarTree(branch?: string): void {
    void this.loadVarTree(branch);
  }

  fetchVarLeaves(branch: string, _withMeta = true): void {
    void this.loadVariables(branch);
  }

  fetchVarList(_filter = ''): void {
    if (this.activeObjectPath) void this.loadVariables(this.activeObjectPath);
  }

  setMonitorList(): void {
    /* SmcServer polls object GET paths; branch vars are refreshed via loadVariables + pollActiveObjects. */
  }

  addVariable(name: string): void {
    const postPath = this.nameToPostPath.get(name);
    if (postPath) {
      const slash = postPath.lastIndexOf('/');
      if (slash > 0) this.pollPaths.add(postPath.slice(0, slash));
    } else if (this.activeObjectPath) {
      this.pollPaths.add(this.activeObjectPath);
    }
    this.startPolling();
  }

  removeVariable(name: string): void {
    const postPath = this.nameToPostPath.get(name);
    if (postPath) {
      const slash = postPath.lastIndexOf('/');
      if (slash > 0) this.pollPaths.delete(postPath.slice(0, slash));
    }
  }

  setVariable(name: string, value: string): void {
    const postPath = this.nameToPostPath.get(name);
    if (!postPath) {
      watchIoLog('http', `setVariable: no Smc post path for ${name}`);
      return;
    }
    void this.postVariable(postPath, value);
  }

  private async postVariable(name: string, value: string): Promise<void> {
    const url = `${this.serverBase}/${name}`;
    const body = JSON.stringify({ type: 'variable', value }) + '\r\n';
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        void res.body?.cancel();
        throw new Error(`POST ${name} failed: ${res.status}`);
      }
      watchIoLog('http', `POST set ${name}=${value}`);
    } finally {
      window.clearTimeout(timer);
    }
  }

  requestUpdate(): void {
    void this.pollActiveObjects();
  }

  private async loadVarTree(branch?: string): Promise<void> {
    if (!branch) {
      const { text } = await smcHttpGet(this.serverBase, 8000);
      const msg = parseWatchIoResponse(text);
      if (!msg) return;
      const modules = normalizeEntries(msg.entries)
        .map((e) => e.name)
        .filter(Boolean);
      this.emit({
        type: 'vartree',
        entries: modules.map((name) => ({ name })),
      });
      return;
    }

    const { module, objectPath } = parseSmcBranch(branch);
    const objects = await this.loadModuleObjects(module);
    const children = getSmcChildObjectPaths(module, objects, objectPath);
    this.emit({
      type: 'vartree',
      entries: children.map((name) => ({ name })),
      params: [{ name: 'attributes', value: `branch=${branch}` }],
    });
  }

  private async loadVariables(branch: string): Promise<void> {
    const url = `${this.serverBase}/${branch}:?value=1;vartype=1;description=1;override=1`;
    watchIoLog('http', `GET ${url}`);
    const { text } = await smcHttpGet(url, 20_000);
    const msg = parseWatchIoResponse(text);
    if (!msg) return;

    this.activeObjectPath = branch;
    this.pollPaths.add(branch);

    const infoUrl = `${this.serverBase}/${branch}:info`;
    try {
      const { text: infoText } = await smcHttpGet(infoUrl, 8000);
      const info = parseWatchIoResponse(infoText);
      const entries = Array.isArray(info?.entries) ? info.entries : [];
      for (const e of entries) {
        if (typeof e === 'object' && e && 'name' in e && e.name === 'varprefix' && e.value) {
          this.varPrefix = e.value;
        }
      }
    } catch {
      this.varPrefix = '';
    }

    const entries = normalizeVarEntries(msg);
    this.pathVarPrefix.set(branch, this.varPrefix);
    const withFullNames = entries.map((e) => {
      const shortName = e.name;
      const fullName =
        shortName.includes('.') || !this.varPrefix ? shortName : `${this.varPrefix}${shortName}`;
      this.nameToPostPath.set(fullName, `${branch}/${shortName}`);
      return {
        ...e,
        name: fullName,
        params: e.params,
      };
    });

    this.emit({
      type: 'varleaves',
      entries: withFullNames,
      params: [
        {
          name: 'attributes',
          value: `branch=${branch};varprefix=${this.varPrefix}`,
        },
      ],
    });
    this.emit({ type: 'status', entries: [{ name: 'status', value: '1' }] });
  }

  private async loadModuleObjects(module: string): Promise<string[]> {
    const cached = this.moduleObjects.get(module);
    if (cached) return cached;

    const url = `${this.serverBase}/${module}`;
    const { text } = await smcHttpGet(url, 30_000);
    const msg = parseWatchIoResponse(text);
    const names = normalizeEntries(msg?.entries)
      .map((e) => e.name)
      .filter(Boolean);
    this.moduleObjects.set(module, names);
    return names;
  }

  private async pollActiveObjects(): Promise<void> {
    const paths = this.pollPaths.size
      ? Array.from(this.pollPaths)
      : this.activeObjectPath
        ? [this.activeObjectPath]
        : [];
    for (const path of paths) {
      try {
        const url = `${this.serverBase}/${path}`;
        const { text } = await smcHttpGet(url, 15_000);
        const msg = parseWatchIoResponse(text);
        if (!msg || msg.type !== 'variable') continue;
        const prefix = this.pathVarPrefix.get(path) ?? this.varPrefix;
        const entries = normalizeVarEntries(msg).map((e) => ({
          ...e,
          name: e.name.includes('.') || !prefix ? e.name : `${prefix}${e.name}`,
        }));
        if (entries.length) this.emit({ type: 'update', entries });
      } catch (err) {
        watchIoLog('http', `poll ${path} failed`, err);
      }
    }
  }

  private startPolling(): void {
    this.stopPolling();
    if (!this.connected) return;
    this.pollTimer = setInterval(() => void this.pollActiveObjects(), this.sampleInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export function parseSmcBranch(branch: string): { module: string; objectPath: string } {
  const slash = branch.indexOf('/');
  if (slash < 0) return { module: branch, objectPath: '' };
  return {
    module: branch.slice(0, slash),
    objectPath: branch.slice(slash + 1),
  };
}

/** Port of SmcServerView InitModuleObj — immediate child object paths under parent. */
export function getSmcChildObjectPaths(
  module: string,
  objects: string[],
  parentObjectPath: string,
): string[] {
  const prefix = parentObjectPath ? `${parentObjectPath}.` : `${module}.`;
  const children = new Map<string, string>();

  for (const obj of objects) {
    if (!obj.startsWith(prefix)) continue;
    const rest = obj.slice(prefix.length);
    if (!rest) continue;
    const dot = rest.indexOf('.');
    const seg = dot >= 0 ? rest.slice(0, dot) : rest;
    if (!seg) continue;
    const fullObject = parentObjectPath ? `${parentObjectPath}.${seg}` : `${module}.${seg}`;
    const smcPath = `${module}/${fullObject}`;
    children.set(smcPath, smcPath);
  }

  return Array.from(children.keys()).sort();
}

function normalizeVarEntries(msg: WatchIoMessage): Array<{
  name: string;
  value?: string;
  params?: Array<{ name: string; value: string }>;
}> {
  const raw = msg.entries;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      name: e.name,
      value: e.value,
      params: Array.isArray(e.params)
        ? e.params
        : e.params && typeof e.params === 'object' && 'name' in e.params
          ? [e.params as { name: string; value: string }]
          : [],
    }));
  }
  if (typeof raw === 'object' && 'name' in raw) {
    const e = raw as { name: string; value?: string; params?: unknown };
    return [
      {
        name: e.name,
        value: e.value,
        params: Array.isArray(e.params) ? e.params : [],
      },
    ];
  }
  return [];
}
