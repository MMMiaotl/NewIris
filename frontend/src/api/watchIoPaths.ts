/** URL builders for WatchIoWebServer HTTP API (reference/HttpWeb/WatchIoWebServer). */

import { buildServiceAddress } from './smcHttp';

export function buildWatchIoBase(httpHost: string, serverPath: string): string {
  const uri = serverPath.startsWith('/') ? serverPath : `/${serverPath}`;
  return buildServiceAddress(httpHost, uri);
}

export function buildWatchIoInstanceUrl(
  base: string,
  watchIoName: string,
  option: string,
  variable?: string,
  query?: string,
): string {
  let path = `${base}/${encodeURIComponent(watchIoName)}:${option}`;
  if (variable) path += `/${encodeURIComponent(variable)}`;
  if (query) path += `?${query}`;
  return path;
}

/** ws://host:8083 when HTTP gateway is on :8082 */
export function defaultWsUrl(hostAddress: string): string {
  const trimmed = hostAddress.trim();
  if (!trimmed) return 'ws://localhost:8083';
  const [host, port] = trimmed.split(':');
  const wsPort = !port || port === '8082' ? '8083' : port;
  return `ws://${host}:${wsPort}`;
}
