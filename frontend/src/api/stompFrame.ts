/** STOMP frame helpers for WatchIoWebServer (reference/HttpWeb/HttpWebLibrary). */

export interface StompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

export function formatStompFrame(
  command: string,
  headers: Record<string, string>,
  body = '',
): string {
  let frame = `${command}\r\n`;
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\r\n`;
  }
  frame += '\r\n';
  if (body) frame += body;
  // Do not append \\0 — WatchIoWebServer reads body to EOF and \\0 breaks JSON.parse.
  return frame;
}

function parseHeaderLines(lines: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of lines) {
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
}

function parseStompChunk(chunk: string): StompFrame | null {
  const trimmed = chunk.replace(/\0+$/, '').replace(/\r\n$/, '');
  const headerEnd = trimmed.indexOf('\r\n\r\n');
  if (headerEnd < 0) return null;

  const headerBlock = trimmed.slice(0, headerEnd);
  const lines = headerBlock.split('\r\n');
  const command = lines[0]?.trim();
  if (!command) return null;

  const headers = parseHeaderLines(lines.slice(1));
  let body = trimmed.slice(headerEnd + 4);

  const contentLength = Number.parseInt(headers['content-length'] ?? '', 10);
  if (Number.isFinite(contentLength) && contentLength >= 0) {
    body = body.slice(0, contentLength);
  } else {
    body = body.replace(/\0+$/, '').replace(/\r\n$/, '');
  }

  return { command, headers, body };
}

const FRAME_START = /^(MESSAGE|CONNECTED|ERROR|RECEIPT)\r\n/m;

/**
 * Parse STOMP frames from accumulated buffer.
 * Server responses use content-length or body-to-EOF (no trailing \\0).
 * Client sends must not use \\0 — server JSON.parse reads body to EOF.
 */
export function parseStompFrames(buffer: string): {
  frames: StompFrame[];
  rest: string;
} {
  const frames: StompFrame[] = [];
  let data = buffer;

  while (data.length > 0) {
    const nul = data.indexOf('\0');
    if (nul >= 0) {
      const chunk = data.slice(0, nul);
      data = data.slice(nul + 1);
      const frame = parseStompChunk(chunk);
      if (frame && frame.command === 'MESSAGE') frames.push(frame);
      continue;
    }

    const headerEnd = data.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;

    const headerBlock = data.slice(0, headerEnd);
    const lines = headerBlock.split('\r\n');
    const command = lines[0]?.trim();
    if (!command) {
      data = data.slice(headerEnd + 4);
      continue;
    }

    const headers = parseHeaderLines(lines.slice(1));
    const contentLength = Number.parseInt(headers['content-length'] ?? '', 10);
    const bodyStart = headerEnd + 4;

    if (Number.isFinite(contentLength) && contentLength >= 0) {
      if (data.length < bodyStart + contentLength) break;
      const body = data.slice(bodyStart, bodyStart + contentLength);
      let consumed = bodyStart + contentLength;
      if (data.slice(consumed, consumed + 2) === '\r\n') consumed += 2;
      if (data[consumed] === '\0') consumed += 1;
      data = data.slice(consumed);
      if (command === 'MESSAGE') frames.push({ command, headers, body });
      continue;
    }

    const nextStart = data.slice(bodyStart).search(FRAME_START);
    const bodyEnd = nextStart >= 0 ? bodyStart + nextStart : data.length;
    const body = data.slice(bodyStart, bodyEnd).replace(/\r\n$/, '').replace(/\0+$/, '');
    data = nextStart >= 0 ? data.slice(bodyEnd) : '';

    if (command === 'MESSAGE') frames.push({ command, headers, body });
    if (nextStart < 0) break;
  }

  return { frames, rest: data };
}

export async function decodeWebSocketData(data: string | Blob | ArrayBuffer): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  return new TextDecoder().decode(data);
}
