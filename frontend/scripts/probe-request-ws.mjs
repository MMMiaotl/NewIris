/** STOMP probe: SUBSCRIBE /request on ws://localhost:8083 */

const WS_URL = process.env.WS_URL ?? 'ws://localhost:8083';

function stomp(command, headers, body = '') {
  let frame = `${command}\r\n`;
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\r\n`;
  frame += '\r\n';
  if (body) frame += body;
  frame += '\0';
  return frame;
}

const ws = new WebSocket(WS_URL);
let buf = '';
setTimeout(() => { console.log('TIMEOUT'); ws.close(); process.exit(1); }, 10000);

ws.onopen = () => {
  ws.send(stomp('SUBSCRIBE', { destination: '/request', id: 'req1' }));
  setTimeout(() => {
    ws.send(stomp('SEND', { destination: '/request', id: 'req1' }, '{}'));
  }, 300);
};

ws.onmessage = (ev) => {
  buf += ev.data;
  if (buf.includes('MESSAGE')) {
    console.log(buf.slice(0, 1200));
    ws.close();
    process.exit(0);
  }
};
