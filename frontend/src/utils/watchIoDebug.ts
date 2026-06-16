import type { WatchIoMessage } from '../api/types';
import { useWatchIoMessageLogStore } from '../stores/watchIoMessageLogStore';
import { extractBranchNames, isDataReady, normalizeEntries } from './parseWatchIoMessage';

/** High-frequency message types — console only when VITE_WATCHIO_DEBUG=verbose. */
const NOISY_MESSAGE_TYPES = new Set(['update', 'varlist']);

/**
 * WatchIO console debug levels (VITE_WATCHIO_DEBUG):
 * - unset / false: off (default in dev and prod)
 * - true: connection, tree, errors (no update poll spam)
 * - verbose: everything including raw WS chunks and update traffic
 */
export function isWatchIoDebugEnabled(): boolean {
  const level = import.meta.env.VITE_WATCHIO_DEBUG;
  return level === 'true' || level === 'verbose';
}

export function isWatchIoVerboseDebugEnabled(): boolean {
  return import.meta.env.VITE_WATCHIO_DEBUG === 'verbose';
}

export function isWatchIoNoisyMessageType(type: string | undefined): boolean {
  return type !== undefined && NOISY_MESSAGE_TYPES.has(type);
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

/** Raw WS / poll traffic — only when VITE_WATCHIO_DEBUG=verbose. */
export function watchIoLogVerbose(category: string, message: string, data?: unknown): void {
  if (!isWatchIoVerboseDebugEnabled()) return;
  if (data !== undefined) {
    console.log(`[WatchIO:${category}]`, message, data);
  } else {
    console.log(`[WatchIO:${category}]`, message);
  }
}

export function watchIoLogMessage(direction: 'recv' | 'send', msg: WatchIoMessage): void {
  useWatchIoMessageLogStore.getState().append(direction, msg);
  if (!isWatchIoDebugEnabled()) return;
  if (isWatchIoNoisyMessageType(msg.type) && !isWatchIoVerboseDebugEnabled()) return;
  const arrow = direction === 'recv' ? '<<<' : '>>>';
  console.groupCollapsed(`[WatchIO:msg] ${arrow} ${msg.type}`);
  console.log(summarizeMessage(msg));
  console.log('raw', msg);
  console.groupEnd();
}

export function watchIoLogSendBody(body: Record<string, unknown>): void {
  const type = typeof body.type === 'string' ? body.type : undefined;
  if (type && !isWatchIoNoisyMessageType(type)) {
    useWatchIoMessageLogStore.getState().append('send', body as unknown as WatchIoMessage);
  }
  if (isWatchIoNoisyMessageType(type)) {
    watchIoLogVerbose('ws', 'SEND', body);
  } else {
    watchIoLog('ws', 'SEND', body);
  }
}
