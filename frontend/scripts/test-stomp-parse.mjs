/**
 * Unit smoke test for stompFrame parsing (no live server).
 * Run: node scripts/test-stomp-parse.mjs
 */

function parseHeaderLines(lines) {
  const headers = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
}

function parseStompChunk(chunk) {
  const trimmed = chunk.replace(/\0+$/, '').replace(/\r\n$/, '');
  const headerEnd = trimmed.indexOf('\r\n\r\n');
  if (headerEnd < 0) return null;
  const lines = trimmed.slice(0, headerEnd).split('\r\n');
  const command = lines[0]?.trim();
  const headers = parseHeaderLines(lines.slice(1));
  let body = trimmed.slice(headerEnd + 4);
  const cl = parseInt(headers['content-length'] ?? '', 10);
  if (Number.isFinite(cl) && cl >= 0) body = body.slice(0, cl);
  else body = body.replace(/\0+$/, '').replace(/\r\n$/, '');
  return { command, body };
}

const sample =
  'MESSAGE\r\nmessage:200 Ok\r\n\r\n{"type":"vartree","entries":[{"name":"C"}]}';

const frame = parseStompChunk(sample);
if (!frame || frame.command !== 'MESSAGE') {
  console.error('FAIL parse chunk');
  process.exit(1);
}
const json = JSON.parse(frame.body);
if (json.type !== 'vartree' || json.entries[0].name !== 'C') {
  console.error('FAIL body', json);
  process.exit(1);
}
console.log('OK stomp parse', json.type, json.entries[0].name);
