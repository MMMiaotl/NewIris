/** Probe WatchIO STOMP on ws://localhost:8083 — uses content-length frame parsing. */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load compiled logic via dynamic import after build — use inline parser matching stompFrame.ts

function parseHeaderLines(lines) {
  const headers = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
}

function parseStompFrames(buffer) {
  const frames = [];
  let data = buffer;
  const FRAME_START = /^(MESSAGE|CONNECTED|ERROR|RECEIPT)\r\n/m;

  while (data.length > 0) {
    const nul = data.indexOf('\0');
    if (nul >= 0) {
      const chunk = data.slice(0, nul);
      data = data.slice(nul + 1);
      const headerEnd = chunk.indexOf('\r\n\r\n');
      if (headerEnd >= 0) {
        const lines = chunk.slice(0, headerEnd).split('\r\n');
        const cmd = lines[0]?.trim();
        const body = chunk.slice(headerEnd + 4).replace(/\r\n$/, '');
        if (cmd === 'MESSAGE') frames.push({ body });
      }
      continue;
    }

    const headerEnd = data.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;

    const lines = data.slice(0, headerEnd).split('\r\n');
    const command = lines[0]?.trim();
    const headers = parseHeaderLines(lines.slice(1));
    const bodyStart = headerEnd + 4;
    const cl = parseInt(headers['content-length'] ?? '', 10);

    if (Number.isFinite(cl) && cl >= 0) {
      if (data.length < bodyStart + cl) break;
      const body = data.slice(bodyStart, bodyStart + cl);
      data = data.slice(bodyStart + cl);
      if (command === 'MESSAGE') frames.push({ body });
      continue;
    }

    const nextStart = data.slice(bodyStart).search(FRAME_START);
    const bodyEnd = nextStart >= 0 ? bodyStart + nextStart : data.length;
    const body = data.slice(bodyStart, bodyEnd).replace(/\r\n$/, '');
    data = nextStart >= 0 ? data.slice(bodyEnd) : '';
    if (command === 'MESSAGE') frames.push({ body });
    if (nextStart < 0) break;
  }

  return { frames, rest: data };
}

function stomp(command, headers, body = '') {
  let frame = `${command}\r\n`;
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\r\n`;
  frame += '\r\n';
  if (body) frame += body;
  return frame;
}

const WS_URL = process.env.WS_URL ?? 'ws://localhost:8083';
const WATCH_IO = process.argv[2] ?? 'SmcControl1';

const ws = new WebSocket(WS_URL);
let buf = '';

const fail = (msg) => {
  console.error('FAIL:', msg);
  ws.close();
  process.exit(1);
};

setTimeout(() => fail('timeout 20s'), 20_000);

ws.onopen = () => {
  console.log('WS connected', WS_URL);
  ws.send(
    stomp('SUBSCRIBE', {
      destination: '/watchio',
      id: WATCH_IO,
      attributes: `watchioname=${WATCH_IO}`,
    }),
  );
  setTimeout(() => {
    const payload = JSON.stringify({ type: 'vartree' });
    ws.send(
      stomp(
        'SEND',
        {
          destination: '/watchio',
          id: WATCH_IO,
        },
        payload,
      ),
    );
  }, 150);
};

ws.onmessage = (ev) => {
  buf += typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
  const { frames } = parseStompFrames(buf);
  for (const f of frames) {
    if (f.body.includes('vartree')) {
      console.log('OK', f.body.slice(0, 300));
      ws.close();
      process.exit(0);
    }
  }
};

ws.onerror = () => fail('WebSocket error');
