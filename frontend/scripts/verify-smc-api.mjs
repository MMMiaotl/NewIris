/**
 * Smoke test: SmcServer API path used by NewIris (same as SmcServerView).
 * Run: node scripts/verify-smc-api.mjs
 */

const BASE = 'http://localhost:8082';

async function get(path, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseEntries(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data.entries)) return data.entries.map((e) => e.name).filter(Boolean);
  return [];
}

function getSmcChildObjectPaths(module, objects, parentObjectPath) {
  const prefix = parentObjectPath ? `${parentObjectPath}.` : `${module}.`;
  const children = new Map();
  for (const obj of objects) {
    if (!obj.startsWith(prefix)) continue;
    const rest = obj.slice(prefix.length);
    if (!rest) continue;
    const dot = rest.indexOf('.');
    const seg = dot >= 0 ? rest.slice(0, dot) : rest;
    if (!seg) continue;
    const fullObject = parentObjectPath ? `${parentObjectPath}.${seg}` : `${module}.${seg}`;
    children.set(`${module}/${fullObject}`, `${module}/${fullObject}`);
  }
  return [...children.keys()].sort();
}

async function main() {
  const requestText = await get('/request', 5000);
  const request = JSON.parse(requestText);
  if (request.type !== 'request') throw new Error('bad /request');
  const smc = request.entries.find((e) => e.value?.includes('SmcServer1'));
  if (!smc) throw new Error('SmcServer1 not in /request');
  console.log('OK /request →', smc.name, smc.value);

  const rootText = await get('/SmcServer1', 8000);
  const modules = parseEntries(rootText);
  if (!modules.includes('Control')) throw new Error(`Control module missing: ${modules}`);
  console.log('OK /SmcServer1 modules →', modules.join(', '));

  const controlText = await get('/SmcServer1/Control', 30000);
  const objects = parseEntries(controlText);
  const surgePath = 'Control/Control.Filter.Surge';
  const surgeChildren = getSmcChildObjectPaths('Control', objects, 'Control.Filter.Surge');
  if (!surgeChildren.some((p) => p.includes('Coefs'))) {
    throw new Error(`Coefs not under ${surgePath}: ${surgeChildren.join(', ')}`);
  }
  console.log('OK Control tree →', surgeChildren.filter((p) => p.includes('Coefs')).join(', '));

  const coefsPath = '/SmcServer1/Control/Control.Filter.Surge.Coefs:?value=1;vartype=1;description=1';
  const coefsText = await get(coefsPath, 20000);
  if (!coefsText.includes('Kqx1')) throw new Error('Kqx1 not in Coefs response');
  console.log('OK Coefs variables → Kqx1 present');

  const infoText = await get('/SmcServer1/Control/Control.Filter.Surge.Coefs:info', 8000);
  const info = JSON.parse(infoText);
  const varprefix = info.entries?.find((e) => e.name === 'varprefix')?.value ?? '';
  if (!varprefix.includes('C.Filter.Surge.Coefs')) {
    throw new Error(`unexpected varprefix: ${varprefix}`);
  }
  console.log('OK varprefix →', varprefix);

  console.log('\nAll SmcServer checks passed.');
}

main().catch((err) => {
  console.error('VERIFY FAILED:', err.message || err);
  process.exit(1);
});
