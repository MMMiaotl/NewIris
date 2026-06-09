/**
 * HTTP helpers aligned with Web/SmcServerView.js (XMLHttpRequest GET, /request discovery).
 */

import type { ConnectionTransport, DiscoveredService, WatchIoMessage } from './types';
import { watchIoLog } from '../utils/watchIoDebug';
import { parseSmcJson, smcEntryParam, type SmcJsonEntry } from '../utils/parseSmcJson';
import { defaultWsUrl } from './watchIoPaths';
import { fetchRequestServicesViaWebSocket } from './watchIoWsDiscovery';
import { parseWatchIoResponse } from '../utils/parseWatchIoMessage';

export type SmcRequestEntry = SmcJsonEntry;

/** @deprecated use parseWatchIoResponse */
export function parseSmcJsonResponse(text: string): WatchIoMessage | null {
  return parseWatchIoResponse(text);
}

export function entryParam(entry: SmcRequestEntry, paramName: string): string {
  return smcEntryParam(entry, paramName);
}

/** SmcServerView: `http://${hostaddress}/request` */
export function buildRequestUrl(httpHost: string): string {
  const base = httpHost.replace(/\/$/, '');
  return base ? `${base}/request` : '/request';
}

/**
 * SmcServerView InitApplication: serverAddress = "http://" + host + entry.value
 * Empty httpHost → relative path (Vite proxy or same-origin deploy on :8082).
 */
export function buildServiceAddress(httpHost: string, serviceUri: string): string {
  const uri = serviceUri.startsWith('/') ? serviceUri : `/${serviceUri}`;
  const base = httpHost.replace(/\/$/, '');
  return base ? `${base}${uri}` : uri;
}

export function isSmcServerService(entry: SmcRequestEntry): boolean {
  const category = entryParam(entry, 'category').toLowerCase();
  const uri = (entry.value ?? '').toLowerCase();
  const name = entry.name.toLowerCase();
  return category.includes('smcserver') || uri.includes('smcserver') || name.includes('smcserver');
}

export function isWatchIoGatewayService(entry: SmcRequestEntry): boolean {
  const uri = (entry.value ?? '').toLowerCase();
  const name = entry.name.toLowerCase();
  return uri === '/watchio' || uri.endsWith('/watchio') || name.includes('watchio');
}

function matchesTransport(entry: SmcRequestEntry, transport: ConnectionTransport): boolean {
  if (transport === 'smcServer') return isSmcServerService(entry);
  return isWatchIoGatewayService(entry);
}

/** WatchIoWebServer always registers serveruri=/watchio — usable even when absent from /request. */
export function createDefaultWatchIoService(): DiscoveredService {
  return {
    name: 'WatchIoWebServer',
    uri: '/watchio',
    category: 'WatchIO',
    description: 'Default path (Connect without /request if backend is up)',
  };
}

export function ensureWatchIoServices(services: DiscoveredService[]): DiscoveredService[] {
  if (services.some((s) => s.uri.toLowerCase().includes('watchio'))) return services;
  return [createDefaultWatchIoService()];
}

export function isWatchIoTransport(transport: ConnectionTransport): boolean {
  return transport === 'watchIoHttp' || transport === 'watchIoWs';
}

/**
 * GET like SmcServerView XMLHttpRequest — no custom headers, short timeout on errors.
 * HttpWebServer returns 503 without closing the body; avoid awaiting res.text() on !res.ok.
 */
export async function smcHttpGet(
  url: string,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    watchIoLog('http', `GET ${url}`);
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    if (!res.ok) {
      void res.body?.cancel();
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out (${timeoutMs}ms): ${url}`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** GET /request (HTTP) or STOMP /request (watchIoWs) — filter by transport. */
export async function fetchRequestServices(
  httpHost: string,
  transport: ConnectionTransport = 'smcServer',
  wsUrl?: string,
) {
  if (transport === 'watchIoWs') {
    const url = (wsUrl || defaultWsUrl(httpHost.replace(/^https?:\/\//, ''))).trim();
    try {
      const services = await fetchRequestServicesViaWebSocket(url);
      return ensureWatchIoServices(services);
    } catch (err) {
      watchIoLog(
        'discover',
        'WS /request failed — using default /watchio',
        err instanceof Error ? err.message : err,
      );
      return [createDefaultWatchIoService()];
    }
  }

  const url = buildRequestUrl(httpHost);
  const { text } = await smcHttpGet(url, 5000);
  const data = parseSmcJson(text);
  if (!data || data.type !== 'request') {
    throw new Error('Invalid /request response');
  }

  watchIoLog('discover', '/request raw JSON', {
    transport,
    length: text.length,
    entryCount: data.entries.length,
    names: data.entries.map((e) => e.name),
    uris: data.entries.map((e) => e.value),
  });

  const mapped = data.entries
    .filter((e) => e.value && matchesTransport(e, transport))
    .map((entry) => ({
      name: entry.name,
      uri: entry.value!,
      category: entryParam(entry, 'category'),
      description: entryParam(entry, 'description'),
    }));

  if (isWatchIoTransport(transport)) {
    return ensureWatchIoServices(mapped);
  }

  return mapped;
}
