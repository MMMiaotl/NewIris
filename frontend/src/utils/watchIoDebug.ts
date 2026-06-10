import type { WatchIoMessage } from '../api/types';
import { useWatchIoMessageLogStore } from '../stores/watchIoMessageLogStore';
import { extractBranchNames, isDataReady, normalizeEntries } from './parseWatchIoMessage';

export function isWatchIoDebugEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_WATCHIO_DEBUG === 'true';
}

function summarizeMessage(msg: WatchIoMessage): Record<string, unknown> {
  const entries = normalizeEntries(msg.entries);
  const branches = extractBranchNames(msg);
  return {
    type: msg.type,
    keys: Object.keys(msg),
    dataReady: msg.type === 'status' ? isDataReady(msg) : undefined,
    branchCount: branches.length,
    branchSample: branches.slice(0, 8),
    entryCount: entries.length,
    entrySample: entries.slice(0, 3).map((e) => e.name),
    valueCount: Array.isArray(msg.values) ? msg.values.length : msg.values ? 1 : 0,
    valueSample: Array.isArray(msg.values) ? msg.values.slice(0, 8) : msg.values,
    params: msg.params,
  };
}

export function watchIoLog(category: string, message: string, data?: unknown): void {
  if (!isWatchIoDebugEnabled()) return;
  if (data !== undefined) {
    console.log(`[WatchIO:${category}]`, message, data);
  } else {
    console.log(`[WatchIO:${category}]`, message);
  }
}

export function watchIoLogMessage(direction: 'recv' | 'send', msg: WatchIoMessage): void {
  useWatchIoMessageLogStore.getState().append(direction, msg);
  if (!isWatchIoDebugEnabled()) return;
  const arrow = direction === 'recv' ? '<<<' : '>>>';
  console.groupCollapsed(`[WatchIO:msg] ${arrow} ${msg.type}`);
  console.log(summarizeMessage(msg));
  console.log('raw', msg);
  console.groupEnd();
}
