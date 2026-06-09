# WatchIoWebServer WebSocket Protocol

Source: [WatchIoWebServer/README.md](../WatchIoWebServer/README.md) and server implementation.

## Connection

Two transports are supported (see `Web/SmcServerView.js` for the working HTTP pattern):

| Mode | Endpoint | Used by |
|------|----------|---------|
| **HTTP (default)** | `http://localhost:8082` | `Web/` reference clients via HttpWebServer |
| **WebSocket** | `ws://localhost:8083` | WatchIoWebServer STOMP |

### HTTP (recommended — matches Web/ examples)

1. `GET http://localhost:8082/request` — discover services (optional)
2. `GET http://localhost:8082/watchio/{watchIoName}:open?watchioname={name}` — open session
3. `GET ...:vartree`, `...:varlist`, `...:varleaves/{branch}` — browse variables
4. `GET ...:update` — poll values (interval ms, default 500)
5. `POST ...:set` + `POST ...:command` — write values

### WebSocket (STOMP)

| Setting | Default |
|---------|---------|
| WebSocket URL | `ws://localhost:8083` |
| STOMP destination | `/watchio` |
| WatchIO instance id | `CasServer` (SUBSCRIBE `id` header) |

## STOMP Frame Format

Client commands: `SUBSCRIBE`, `UNSUBSCRIBE`, `SEND`  
Server responses: `MESSAGE`

```
COMMAND\r\n
header:value\r\n
\r\n
<body>
```

Headers use lowercase names. Message body is JSON.

### Critical rules (NewIris verified)

WatchIoWebServer is **not** strict STOMP 1.x. These rules matter in practice:

| Rule | Outbound (client → server) | Inbound (server → client) |
|------|----------------------------|---------------------------|
| **No `\0` terminator** | **Required.** Server reads body from `\r\n\r\n` to **WebSocket message EOF**. A trailing `\0` is included in the body and **`JSON.parse` fails silently** — no ERROR, no MESSAGE. | Server responses do not use `\0`; parser may strip stray `\0` if present. |
| **`content-length`** | **Do not send** on outbound `SEND` (one WS text frame = one STOMP frame). | Server may set `content-length` on large `MESSAGE` bodies; client must honor it when parsing. |
| **WebSocket boundary** | Entire STOMP frame is one `ws.send(...)` text message. | Accumulate chunks; split on `\r\n\r\n` + `content-length` or EOF. |

Implementation: `frontend/src/api/stompFrame.ts`, `stompWatchIoClient.ts`.

## Client Lifecycle

### 1. Subscribe (open WatchIO session)

```
SUBSCRIBE
destination:/watchio
id:CasServer
attributes:watchioname=CasServer

```

The `id` header is the watchio session name. Attributes configure client mode (default: WatchIoView client).

### 2. Send commands (JSON body)

```
SEND
destination:/watchio
id:CasServer
requesturl:/watchio/CasServer:vartree

{"type":"vartree"}
```

`requesturl` is optional when `type` is set in the JSON body.

### 3. Server push (auto update on timer)

```
MESSAGE
subscription:CasServer

{"type":"update","entries":[{"name":"C.Cas.Main.gp.TimeHorizon","value":"480"}]}
```

WebSocket client mode uses `updateontimer` — server pushes `update` messages every `cycletime` (default 500ms) for registered variables.

## JSON Message Types

| type | Purpose | Client / Server |
|------|---------|-----------------|
| `vartree` | List tree branches | Client request → Server `vartree` response |
| `varleaves` | List variables under branch | Client request |
| `varlist` | Full variable list (with filters) | Client request |
| `varinfo` | Single variable metadata | Client request |
| `add` | Register variable for monitoring | Client request |
| `delete` | Remove from monitor list | Client request |
| `list` | Replace monitor list (implicit listbegin+listend) | Client request |
| `clear` | Clear monitor list | Client request |
| `update` | Pull values (client) or push values (server) | Both |
| `command` | Send set values to WatchIO | Client request |
| `set` | Queue value change | Client request |
| `get` | Read single value | Client request |
| `status` | Connection / appmode status | Both |
| `open` / `close` | Session control | Client |

### Request examples

**Tree (top-level branches):**
```json
{"type":"vartree"}
```

**Tree under branch:**
```json
{"type":"vartree","entries":[{"name":"C.Cas.Main"}]}
```

**Leaves with metadata:**
```json
{"type":"varleaves","entries":[{"name":"C.Cas.Main","params":{"name":"attributes","value":"addtype=1 adddescription=1 addvalue=1"}}]}
```

**Register variable for polling:**
```json
{"type":"add","entries":[{"name":"C.Cas.Main.gp.TimeHorizon","params":{"name":"attributes","value":"type=int mode=set"}}]}
```

**Set value:**
```json
{"type":"set","entries":[{"name":"C.Cas.Main.lp.UseIhastar","value":"1"}]}
```
Then:
```json
{"type":"command"}
```

### Response shape

```json
{
  "type": "varleaves",
  "entries": [
    {"name": "gp.TimeHorizon", "value": "480", "params": {"name": "attributes", "value": "type=int description=\"\""}}
  ]
}
```

## SOAP → WebSocket Mapping

| Legacy SOAP (rtWatchIo) | WatchIoWebServer WebSocket |
|-------------------------|----------------------------|
| `listVariables` | `varlist` or `vartree` + `varleaves` |
| `registerVariables` | `add` / `list` |
| `unregisterVariables` | `delete` |
| `keepAlive` + `update` | Server auto-pushes `update` on timer after `add` |
| `setVariables` | `set` + `command` |

## E2E Verification Checklist

Prerequisites: `WatchIoWebServer.exe` on `:8083`, local WatchIO segment available.

| Step | Action | Expected |
|------|--------|----------|
| 1 | WebSocket connect to `ws://localhost:8083` | Connection open |
| 2 | SUBSCRIBE `id=CasServer` | No error |
| 3 | SEND `{"type":"vartree"}` | `vartree` entries with branches |
| 4 | SEND `varleaves` for `C.Cas.Main` | Variable names + types |
| 5 | SEND `add` for one variable | Ack via subsequent `update` |
| 6 | Wait for MESSAGE `type=update` | Value present |
| 7 | SEND `set` + `command` | Value changes in next `update` |
| 8 | SEND `delete` | Variable removed from updates |

CLI fallback (SOAP): `python sources/readWatchIoSoap.py http://127.0.0.1:2202/watchIo CasServer <variable>`

## Service discovery (HTTP vs WebSocket)

Two separate registries exist on the gateway:

| Registry | How to query | Lists |
|----------|--------------|-------|
| **HTTP** | `GET http://localhost:8082/request` | Services with `http=1` (e.g. SmcServer1, SmcServer2) |
| **WebSocket** | STOMP on `ws://localhost:8083`, `destination:/request`, body `{}` | Services with `websocket=1` only (e.g. WatchIoWebServer → `/watchio`) |

When WatchIoWebServer runs with **`websocket=1` only** (no `http=1`), HTTP `/request` returns **empty** for WatchIO — this is expected. NewIris **watchIoWs** transport uses WS `/request` discovery (`watchIoWsDiscovery.ts`).

**Race fix:** After the first valid `/request` MESSAGE, cancel any delayed SEND timer before closing the probe socket (avoids `WebSocket is already in CLOSING or CLOSED state`).

## JSON `params` shape

`params` must be a **single object**, not an array:

```json
{ "name": "attributes", "value": "branch=C.Filter" }
```

Wrong: `"params": [{ ... }]`. Wrong shape can cause **silent no-response** on WebSocket.

See `frontend/src/api/watchIoServerJson.ts`.

## Silent failures (`dataok`, empty vartree)

If the WatchIO segment is not ready, `GetVarTree` returns early when `dataok == false` and sends **no MESSAGE** (same silent behavior as bad JSON).

Symptoms: `connected` + `SEND {"type":"vartree"}` but no `STOMP MESSAGE`.

Mitigations in NewIris:

1. Retry vartree after ~2.5s; send `{type:"status"}` first and check `dataok` in the response.
2. Confirm WatchIoWebServer log shows `connect watchio SmcControl1` (or your `watchioname`) without TCP errors.

## Debugging (browser console)

Enable WatchIO debug logs (`watchIoDebug.ts`). Useful patterns:

| Log | Meaning |
|-----|---------|
| `[WatchIO:discover] WS /request parsed` | WS service discovery OK |
| `[WatchIO:status] connected` | STOMP SUBSCRIBE OK |
| `[WatchIO:ws] raw chunk { bytes }` | Data received on WebSocket |
| `[WatchIO:ws] STOMP N MESSAGE frame(s)` | Inbound STOMP parsed |
| `[WatchIO:msg] <<< vartree` | Variable tree JSON handled |

Scripts:

```powershell
cd frontend
node scripts/test-stomp-parse.mjs    # STOMP parser unit check
node scripts/probe-watchio-ws.mjs    # WS vartree smoke (needs :8083 + segment)
node scripts/verify-watchio-api.mjs  # HTTP /watchio (needs http=1 registration)
```

## Troubleshooting summary (lessons from NewIris integration)

### 1. Architecture — do not mix APIs

| Path | Backend | Variable naming | Use when |
|------|---------|-----------------|----------|
| `/SmcServer1` | SmcServer on HttpWebServer | Slash object tree (`Control/Control.Filter...`) | Same as SmcServerView; Kqx1 on SmcControl1 |
| `/watchio` | WatchIoWebServer | Dot paths (`C.Filter...`, `C.Cas...`) | Native WatchIO; CasServer, full vartree |
| `GET :8082/request` | HTTP registry | — | SmcServer discovery only if HTTP-registered |
| STOMP `ws://8083` `/request` | WS registry | — | Discover `/watchio` when WS-only |

**Not the same:** `UniConnectCas*` (UniConnect comm) ≠ CAS WatchIO segment `CasServer`. `/SmcControl1` is not a URL prefix.

### 2. HTTP `/request` empty for WatchIO

**Problem:** `GET /request` shows `entryCount: 0` or no `/watchio` while WatchIoWebServer is running.

**Cause:** WatchIoWebServer registered only on WebSocket (`websocket=1`, no `http=1`).

**Fix:** Use transport **watchIoWs**; discover via STOMP `/request` on `ws://8083`.

### 3. Connected but no vartree (STOMP `\0` bug)

**Problem:** Console shows `connected` and `SEND {type:'vartree'}`, never `STOMP MESSAGE`.

**Cause:** Outbound STOMP frame ended with `\0`; server treats it as part of JSON body → parse fails → request dropped with no error frame.

**Fix:** Do not append `\0` in `formatStompFrame`; do not set outbound `content-length` on `SEND`.

### 4. WS discovery race

**Problem:** `WebSocket is already in CLOSING or CLOSED state` during `/request` probe.

**Fix:** Clear pending SEND timer as soon as `/request` MESSAGE is parsed.

### 5. Inbound STOMP parsing

**Problem:** Data arrives but UI never updates.

**Fix:** Parse with `content-length` when present; decode `ArrayBuffer`/`Blob` to string; `trim()` body before `JSON.parse`. See `stompFrame.ts` `parseStompFrames`.

### 6. HTTP `/watchio/*` hangs or 503

**Problem:** `GET /watchio/...` spins or 503.

**Cause:** No HTTP registration for `/watchio`, or segment not responding.

**Fix:** Use **watchIoWs** for WS-only deployments; enable `http=1` on WatchIoWebServer only if you need HTTP `/watchio`.

### 7. Recommended transports in NewIris

```
Transport: smcServer
  Discover: GET /request → SmcServer1
  API:      /SmcServer1/Control/...
  Best for: SmcControl1, slash tree, Kqx1

Transport: watchIoWs  (verified)
  Discover: ws://8083 STOMP /request → /watchio
  API:      SUBSCRIBE /watchio id=SmcControl1; SEND {"type":"vartree"}
  Best for: Dot-path vartree, CasServer when registered

Transport: watchIoHttp
  Requires: WatchIoWebServer http=1 on gateway
  API:      GET /watchio/{name}:open, :vartree, ...
```

See also [NewIrisConnection.md](NewIrisConnection.md) for SmcServer UI steps and [WatchIoBackendSetup.md](WatchIoBackendSetup.md) for process layout.
