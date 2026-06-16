---
name: watchio-connection-debug
description: Diagnose NewIris WatchIO and SmcServer connection failures, empty trees, CORS/proxy issues, transport mismatches, and backend availability. Use when the user reports connect errors, 503, no variables, wrong paths, or asks to debug HttpWebServer, SmcServer, /watchio, or STOMP WebSocket connectivity.
---

# WatchIO Connection Debug

Systematically diagnose connection and data-flow problems in **NewIris** (React SPA on `:5173` → HttpWebServer on `:8082`).

Read first: [docs/NewIrisConnection.md](../../docs/NewIrisConnection.md). WS/STOMP details: [docs/WatchIoWebSocket.md](../../docs/WatchIoWebSocket.md). Backend processes: [docs/WatchIoBackendSetup.md](../../docs/WatchIoBackendSetup.md).

## Core rules (do not violate while debugging)

| Rule | Why |
|------|-----|
| App URL is **http://localhost:5173** | UI is the Vite dev server, not `:8082` |
| **Do not** open `http://localhost:8082/` as the app | Gateway returns 503 on `/`; expected |
| Dev: leave **`VITE_HTTP_URL` empty** | Hardcoding `:8082` causes CORS on `:5173` |
| **Never mix** SmcServer slash paths with WatchIO dot paths | Different transports, parsers, and tree builders |
| `serverPath` comes from **`/request` discovery** | Do not guess `/SmcServer1` if discovery failed |
| Components must not create clients | All I/O goes through `useWatchIo` → `createWatchIoClient()` |

## Architecture (quick)

```
Browser :5173  →  Vite proxy  →  HttpWebServer :8082
                                    ├─ /request
                                    ├─ /SmcServer1, /SmcServer2  (smcServer transport)
                                    └─ /watchio                   (watchIoHttp transport)
WatchIO WebSocket :8083  →  STOMP /watchio  (watchIoWs transport)
```

| Transport | Client | Tree paths | Discovery |
|-----------|--------|------------|-----------|
| `smcServer` | `SmcServerClient` | Slash (`Control/Control.Filter...`) | `GET /request` |
| `watchIoHttp` | `HttpWatchIoClient` | Dot (`C.Filter...`) | `GET /request` (needs `/watchio` entry) |
| `watchIoWs` | `StompWatchIoClient` | Dot | STOMP `/request` on `ws://8083` |

Default NewIris path: **`smcServer` → `/SmcServer1`**.

## Workflow

### 1. Capture the symptom

Record:

- Transport selected in UI
- Host / service / instance (`watchIoName`)
- Footer status and `statusDetail`
- Exact error (browser console, network tab, script output)
- Whether backend was recently restarted

### 2. Confirm backend is up (before blaming frontend)

Run from `frontend/` (requires HttpWebServer on `:8082`):

```powershell
npm run verify:smc
```

For `/watchio` HTTP path:

```powershell
npm run verify:watchio
# optional instance name:
node scripts/verify-watchio-api.mjs SmcControl1
```

Quick manual checks:

```text
GET http://localhost:8082/request     → type=request, SmcServer entries
GET http://localhost:8082/SmcServer1    → type=module
```

If scripts fail here, **fix backend first** — frontend changes will not help.

Offline STOMP frame parsing (no backend):

```powershell
npm run test:stomp
```

WS probe (when WatchIoWebServer on `:8083`):

```powershell
node scripts/probe-watchio-ws.mjs
```

### 3. Match symptom → likely cause

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| CORS error on `:5173` | `VITE_HTTP_URL=http://localhost:8082` set | Clear env; use Vite proxy |
| Request hangs / 503 on `:8082/` | Opened gateway root as app | Use `:5173` |
| **request** returns empty / error | HttpWebServer not running | Start backend; verify `:8082` |
| SmcServer not in list | SmcControl not running or not registered | `/request` JSON entries |
| Connect OK, tree empty | Wrong service or branch not expanded | Network: `GET /SmcServerN`, vartree/varleaves |
| Variables show wrong shape | Transport/path mismatch | Slash tree needs `smcServer`; dot needs WatchIO transport |
| `/watchio` missing from `/request` | WatchIoWebServer not registered | Normal for SmcServer-only deploy; use `smcServer` |
| watchIoWs fails, HTTP works | `:8083` down or STOMP misconfigured | [WatchIoWebSocket.md](../../docs/WatchIoWebSocket.md) |
| Write fails, read works | `nameToPostPath` / POST path wrong | `smcServerClient.ts`, variable full name vs branch prefix |
| Replay works, live does not | `appMode === 'offline'` or client disconnected | `connectionStore.appMode`, footer status |
| CAS / `C.Cas.*` not visible | CAS not registered to gateway | See CAS section in NewIrisConnection.md — not in SmcServer1 tree |

### 4. Inspect frontend code paths

Only after backend smoke tests pass (or failure is clearly client-side):

| Area | File | What to verify |
|------|------|----------------|
| Client factory | `frontend/src/api/watchIoClientFactory.ts` | Correct class for `config.transport` |
| SmcServer polling | `frontend/src/api/smcServerClient.ts` | `serverBase`, poll paths, `setVariable` POST |
| Discovery | `frontend/src/api/smcHttp.ts` | `/request` parsing, transport filter |
| Vite proxy | `frontend/vite.config.ts` | `/request`, `/SmcServer1`, `/SmcServer2`, `/watchio` |
| Message routing | `frontend/src/hooks/useWatchIo.ts` | `handleMessage` switch by `msg.type` |
| Tree merge | `frontend/src/utils/buildVariableTree.ts` | Slash vs dot builders |
| Connection UI | `frontend/src/components/connection/ConnectionBar.tsx` | Request / Connect flow |

Enable debug logging if available: `watchIoDebug.ts` / message log drawer.

### 5. Fix or report

- **Backend issue**: document what `/request` returns, which script failed, required process (HttpWebServer, SmcControl, WatchIoWebServer).
- **Frontend bug**: minimal fix following existing transport patterns; do not add a fourth parallel client architecture.
- **Config issue**: correct env, proxy, or UI settings — no code change needed.

Never claim connectivity is fixed without running the relevant verify script or showing a successful network request.

## Report format

```markdown
## Symptom
[What the user saw]

## Backend check
- `npm run verify:smc`: passed | failed — [output summary]
- `/request` entries: [SmcServer1, …]

## Root cause
[Backend down | wrong transport | CORS | client bug | …]

## Fix / next step
[Concrete action]

## Code changed (if any)
- `path`: [why]
```

## Safety

Stop and ask before changes that would:

- Hardcode secrets or production hostnames into source
- Bypass the Vite proxy in dev without user intent
- Mix SmcServer and WatchIO URL builders in one code path
- Assume `reference/` or `Web/` files exist (they are local-only, not in git)
