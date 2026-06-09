/**
 * Smoke test: WatchIoWebServer HTTP path (/watchio).
 * Run: node scripts/verify-watchio-api.mjs [watchIoName]
 * Prerequisite: WatchIoWebServer registered on HttpWebServer :8082.
 */

const BASE = 'http://localhost:8082';
const WATCH_IO = process.argv[2] ?? 'SmcControl1';

async function get(path, timeoutMs = 20000) {
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

function branchNames(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data.values) && data.values.length) return data.values;
  if (Array.isArray(data.entries)) return data.entries.map((e) => e.name).filter(Boolean);
  return [];
}

async function main() {
  console.log(`WatchIO HTTP verify — ${WATCH_IO}`);

  const requestText = await get('/request', 5000);
  const request = JSON.parse(requestText);
  const watchio = request.entries?.find((e) =>
    String(e.value ?? '').toLowerCase().includes('/watchio'),
  );
  if (!watchio) {
    console.error('FAIL: /watchio not in /request — start WatchIoWebServer');
    process.exit(1);
  }
  console.log('OK /request has', watchio.name, '→', watchio.value);

  const enc = encodeURIComponent(WATCH_IO);
  await get(`/watchio/${enc}:open?watchioname=${enc}`, 15000);
  console.log('OK open');

  const treeText = await get(`/watchio/${enc}:vartree?fulltree=1`, 30000);
  const branches = branchNames(treeText);
  console.log('OK vartree branches:', branches.slice(0, 8).join(', '), branches.length ? `(${branches.length})` : '');

  const updateText = await get(`/watchio/${enc}:update`, 15000);
  const update = JSON.parse(updateText);
  console.log('OK update type=', update.type);

  console.log('All WatchIO HTTP checks passed.');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
