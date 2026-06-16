import type { WatchIoEntry, WatchIoMessage } from '../api/types';
import { normalizeEntryParams, parseAttributes } from './parseAttributes';
import { parseSmcJson, smcJsonToWatchIoMessage, type SmcJsonMessage } from './parseSmcJson';
import { watchIoLog } from './watchIoDebug';

export function parseWatchIoResponse(text: string): WatchIoMessage | null {
  const parsed = parseSmcJson(text);
  if (!parsed?.type) return null;
  return smcJsonToWatchIoMessage(parsed);
}

/** Normalize server JSON — uses SmcServerView ParseJsonstring rules. */
export function normalizeEntries(
  entries: WatchIoMessage['entries'],
): WatchIoEntry[] {
  if (!entries) return [];
  const normalized = normalizeEntryBlock(entries);
  return normalized.map((e) => ({
    name: e.name,
    value: e.value,
    params: e.params,
  }));
}

function normalizeEntryBlock(entries: unknown): Array<{
  name: string;
  value?: string;
  params: Array<{ name: string; value: string }>;
}> {
  if (!entries) return [];
  if (Array.isArray(entries)) {
    return entries.map((e) => ({
      name: e.name,
      value: e.value,
      params: normalizeEntryParams(e.params),
    }));
  }
  if (typeof entries === 'object' && 'name' in entries && typeof entries.name === 'string') {
    const e = entries as WatchIoEntry;
    return [
      {
        name: e.name,
        value: e.value,
        params: normalizeEntryParams(e.params),
      },
    ];
  }
  return Object.entries(entries as Record<string, string>).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : String(value),
    params: [],
  }));
}

function normalizeValues(values: WatchIoMessage['values'], parsed?: SmcJsonMessage): string[] {
  if (parsed?.values.length) return parsed.values;
  if (typeof values === 'string' && values.length > 0) return [values];
  if (Array.isArray(values)) {
    return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  return [];
}

/** vartree: `values` (AddName); varlist/varleaves: `entries` (AddEntry) — SmcServerView count rules. */
export function extractBranchNames(msg: WatchIoMessage, parsed?: SmcJsonMessage): string[] {
  const fromValues = normalizeValues(msg.values, parsed);
  if (fromValues.length) return fromValues;

  if (msg.names?.length) return msg.names.filter(Boolean);

  const fromEntries = normalizeEntries(msg.entries)
    .map((e) => e.name)
    .filter(Boolean);
  if (fromEntries.length) return fromEntries;

  watchIoLog('parse', `no branches in ${msg.type}`, {
    keys: Object.keys(msg),
    values: msg.values,
    names: msg.names,
    entries: msg.entries,
  });
  return [];
}

/** Parent branch when vartree was requested for a subtree (relative child names in values). */
export function parseVartreeParent(msg: WatchIoMessage): string | null {
  const params = msg.params;
  if (!params) return null;
  const list = Array.isArray(params) ? params : [params];
  for (const p of list) {
    if (p.name === 'attributes' && p.value.startsWith('branch=')) {
      return p.value.slice('branch='.length);
    }
  }
  const fromEntries = normalizeEntries(msg.entries);
  for (const e of fromEntries) {
    const plist = Array.isArray(e.params) ? e.params : [];
    for (const p of plist) {
      if (p.name === 'attributes' && p.value.startsWith('branch=')) {
        return p.value.slice('branch='.length);
      }
    }
  }
  return null;
}

/** varleaves meta — branch/varprefix from params.attributes (space- or semicolon-separated). */
export function parseVarleavesMeta(msg: WatchIoMessage): {
  branch: string | null;
  varprefix: string | null;
} {
  let branch: string | null = null;
  let varprefix: string | null = null;
  const params = msg.params;
  const list = params ? (Array.isArray(params) ? params : [params]) : [];
  for (const p of list) {
    if (p.name !== 'attributes' || !p.value) continue;
    const parsed = parseAttributes(p.value);
    if (parsed.branch) branch = parsed.branch;
    if (parsed.varprefix) varprefix = parsed.varprefix;
  }
  return { branch, varprefix };
}

export function isDataReady(msg: WatchIoMessage): boolean {
  if (msg.type !== 'status') return false;
  const entries = normalizeEntries(msg.entries);
  for (const e of entries) {
    if (e.name === 'status' && e.value === '1') return true;
  }
  if (msg.name === 'status' && msg.value === '1') return true;
  return msg.value === '1';
}
