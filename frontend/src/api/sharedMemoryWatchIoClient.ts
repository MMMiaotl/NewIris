/**
 * Shared Memory transport — WatchIoCom ActiveX polls local WatchIO shm (IrisWeb InitOnLoad.js).
 * Variable tree/metadata uses HttpWatchIoClient when /watchio is registered; live values use COM only.
 */

import type { VariableType, WatchIoMessage } from './types';
import type { MessageHandler, StatusHandler, WatchIoClient } from './watchIoClient';
import { HttpWatchIoClient } from './httpWatchIoClient';
import {
  applyWatchIoShMemName,
  defaultComListFormat,
  resolveWatchIoComControl,
  type WatchIoComControl,
} from './watchIoComActiveX';
import { watchIoLog } from '../utils/watchIoDebug';

interface ListEntry {
  name: string;
  index: number;
  format: string;
}

export class SharedMemoryWatchIoClient implements WatchIoClient {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private com: WatchIoComControl | null = null;
  private tree: HttpWatchIoClient;
  private watchIoName: string;
  private sampleInterval: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private list = new Map<string, ListEntry>();
  private shMemName = '';

  constructor(httpHost: string, serverPath: string, watchIoName: string, sampleInterval = 500) {
    this.watchIoName = watchIoName;
    this.sampleInterval = sampleInterval;
    this.tree = new HttpWatchIoClient(httpHost, serverPath, watchIoName, sampleInterval);
    this.tree.onMessage((msg) => {
      for (const h of this.messageHandlers) h(msg);
    });
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
    for (const h of this.messageHandlers) h(msg);
  }

  async connect(): Promise<void> {
    const com = resolveWatchIoComControl();
    if (!com) {
      throw new Error(
        'WatchIoCom ActiveX unavailable — register WatchIoCom.ocx and open Iris Next in Edge IE mode',
      );
    }
    this.com = com;
    this.emitStatus('connecting', `Shared memory ${this.watchIoName}`);
    this.shMemName = applyWatchIoShMemName(com, this.watchIoName);
    watchIoLog('com', `SetShMemName ${this.shMemName}`);

    try {
      await this.tree.connect();
    } catch (err) {
      watchIoLog(
        'com',
        'HTTP /watchio tree unavailable — ActiveX monitor still works for known variables',
        err instanceof Error ? err.message : err,
      );
    }

    this.connected = true;
    this.emitStatus('connected', `COM ${this.shMemName}`);
    this.fetchVarTree();
    this.startPoll();
  }

  disconnect(): void {
    this.stopPoll();
    this.connected = false;
    this.list.clear();
    try {
      this.com?.ClearList?.();
    } catch {
      /* optional */
    }
    this.tree.disconnect();
    this.com = null;
    this.emitStatus('disconnected');
  }

  fetchVarTree(branch?: string): void {
    this.tree.fetchVarTree(branch);
  }

  fetchVarLeaves(branch: string, withMeta?: boolean, priority?: boolean): void {
    this.tree.fetchVarLeaves(branch, withMeta, priority);
  }

  fetchVarList(filter?: string): void {
    this.tree.fetchVarList(filter);
  }

  addVariable(name: string, mode?: 'value' | 'set', dataType?: VariableType): void {
    if (!this.com || !this.connected) return;
    if (this.list.has(name)) return;

    const format = defaultComListFormat(dataType ?? 'double');
    const listMode = mode === 'value' ? 1 : 0;
    const index = this.com.AddList(name, listMode, format);
    this.list.set(name, { name, index, format });
    watchIoLog('com', `AddList ${name}`, { index, listMode, format });
    this.com.SampleList();
    this.com.FormatList();
    this.emitUpdateFor(name);
  }

  removeVariable(name: string): void {
    this.list.delete(name);
  }

  setVariable(name: string, value: string): void {
    const entry = this.list.get(name);
    if (!entry || !this.com) return;
    if (typeof this.com.SetListString === 'function') {
      this.com.SetListString(entry.index, value);
      watchIoLog('com', `SetListString ${name}=${value}`);
      this.com.SampleList();
      this.emitUpdateFor(name);
      return;
    }
    watchIoLog('com', `SetListString not supported by WatchIoCom — write skipped for ${name}`);
  }

  requestUpdate(): void {
    this.pollOnce();
  }

  private startPoll(): void {
    this.stopPoll();
    this.pollTimer = window.setInterval(() => this.pollOnce(), this.sampleInterval);
  }

  private stopPoll(): void {
    if (this.pollTimer != null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollOnce(): void {
    if (!this.com || !this.connected || !this.list.size) return;
    this.com.SampleList();
    this.com.FormatList();
    const entries = [...this.list.keys()].map((name) => ({
      name,
      value: this.com!.GetListString(this.list.get(name)!.index),
    }));
    this.emit({ type: 'update', entries });
  }

  private emitUpdateFor(name: string): void {
    const entry = this.list.get(name);
    if (!entry || !this.com) return;
    this.emit({
      type: 'update',
      entries: [{ name, value: this.com.GetListString(entry.index) }],
    });
  }
}
