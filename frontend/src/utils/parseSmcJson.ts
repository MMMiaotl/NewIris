/**
 * Port of Web/SmcServerView.js ParseJsonstring — handles entries/values/params
 * as either a single object or an array (count = -1 vs count >= 0).
 */

import type { WatchIoMessage } from '../api/types';
import { normalizeEntryParams } from './parseAttributes';

export interface SmcJsonParam {
  name: string;
  value: string;
}

export interface SmcJsonEntry {
  name: string;
  value?: string;
  params: SmcJsonParam[];
}

export interface SmcJsonMessage {
  type?: string;
  name?: string;
  value?: string;
  entries: SmcJsonEntry[];
  values: string[];
  params: SmcJsonParam[];
}

function normalizeParamBlock(params: unknown): SmcJsonParam[] {
  if (!params) return [];
  if (Array.isArray(params)) {
    return params
      .filter((p): p is SmcJsonParam => !!p && typeof p === 'object' && 'name' in p)
      .map((p) => ({ name: String(p.name), value: String((p as SmcJsonParam).value ?? '') }));
  }
  if (typeof params === 'object' && 'name' in params) {
    const p = params as SmcJsonParam;
    return [{ name: p.name, value: p.value ?? '' }];
  }
  if (typeof params === 'object') {
    return normalizeEntryParams(params as Record<string, string>);
  }
  return [];
}

/** SmcServerView: entrycount -1 = single entries object, >=0 = array length */
function normalizeEntryBlock(entries: unknown): SmcJsonEntry[] {
  if (!entries) return [];
  if (Array.isArray(entries)) {
    return entries.map((entry) => ({
      name: String((entry as SmcJsonEntry).name ?? ''),
      value: (entry as SmcJsonEntry).value,
      params: normalizeParamBlock((entry as SmcJsonEntry).params),
    }));
  }
  if (typeof entries === 'object' && 'name' in entries) {
    const entry = entries as SmcJsonEntry;
    return [
      {
        name: entry.name,
        value: entry.value,
        params: normalizeParamBlock(entry.params),
      },
    ];
  }
  return [];
}

/** SmcServerView errorlog: values as string or string[] */
function normalizeValuesBlock(values: unknown): string[] {
  if (!values) return [];
  if (Array.isArray(values)) {
    return values.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  if (typeof values === 'string' && values.length > 0) return [values];
  return [];
}

function normalizeTopParams(params: unknown): SmcJsonParam[] {
  return normalizeParamBlock(params);
}

/** Full ParseJsonstring port + top-level name/value (WatchIO status AddNameValue). */
export function parseSmcJson(text: string): SmcJsonMessage | null {
  try {
    const raw = JSON.parse(text) as WatchIoMessage & {
      entries?: unknown;
      values?: unknown;
      params?: unknown;
    };
    return {
      type: raw.type,
      name: raw.name,
      value: raw.value,
      entries: normalizeEntryBlock(raw.entries),
      values: normalizeValuesBlock(raw.values),
      params: normalizeTopParams(raw.params),
    };
  } catch {
    return null;
  }
}

export function smcEntryParam(entry: SmcJsonEntry, paramName: string): string {
  for (const p of entry.params) {
    if (p.name === paramName) return p.value;
  }
  return '';
}

/** Convert back to WatchIoMessage shape for existing handlers. */
export function smcJsonToWatchIoMessage(parsed: SmcJsonMessage): WatchIoMessage {
  return {
    type: parsed.type ?? '',
    name: parsed.name,
    value: parsed.value,
    entries: parsed.entries.map((e) => ({
      name: e.name,
      value: e.value,
      params: e.params,
    })),
    values: parsed.values.length === 1 ? parsed.values[0] : parsed.values,
    params: parsed.params,
  };
}
