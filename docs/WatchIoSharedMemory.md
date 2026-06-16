# WatchIO Shared Memory (Windows ActiveX)

Iris Next **Shared Memory** transport reads live WatchIO values through the **WatchIoCom** ActiveX control, the same path as legacy **IrisWeb** (`InitOnLoad.js`). It talks to the local WatchIO service process shared-memory segment — **not** through STOMP or SmcServer HTTP polling.

Reference: [reference/WatchIoGuide.md](../reference/WatchIoGuide.md) (COM sample), IrisWeb `C:\IrisWeb\OCX\WatchIoCom.ocx`.

## Architecture

```
Iris Next (Edge IE mode)
  │  <object classid=75E09F4F-…>  or  ActiveXObject("WatchIoCom.WatchIoComCtrl.1")
  ▼
WatchIoCom.ocx  (COM / ActiveX)
  │  SetShMemName → local WatchIO segment (e.g. SmcControl1 / SmcControl1Full)
  ▼
Windows WatchIO service process (shared memory)
```

| Layer | Role |
|-------|------|
| **Live values** | `SharedMemoryWatchIoClient` → COM `AddList` / `SampleList` / `GetListString` |
| **Variable tree** | Optional `HttpWatchIoClient` → `GET /watchio/...` when WatchIoWebServer registered on `:8082` |
| **Writes** | COM `SetListString` when exposed by the installed OCX; otherwise read-only |

Legacy IrisWeb only **read** via COM; tree variables were hard-coded in `InitVars*.js`. Iris Next reuses HTTP `/watchio` for **discovery** when available so the variable tree still works without duplicating STOMP for values.

## Prerequisites (Windows)

1. **WatchIoCom.ocx** registered (32-bit):
   ```powershell
   %windir%\SysWOW64\regsvr32.exe C:\IrisWeb\OCX\WatchIoCom.ocx
   ```
2. Local WatchIO segment running (e.g. **SmcControl1**).
3. Browser: **Microsoft Edge IE mode** (or legacy IE). Chromium without IE mode cannot host ActiveX.
4. Optional (variable tree): **WatchIoWebServer** registered on HttpWebServer `:8082` for `/watchio` HTTP.

## COM API (from IrisWeb)

| Method | Usage |
|--------|--------|
| `SetShMemName(name)` | Attach to segment — tries `SmcControl1Full` then `SmcControl1` (InitOnLoad.js) |
| `AddList(varName, mode, format)` | Register variable; `format` e.g. `type=real scale=1.0 format=%.6g` |
| `SampleList()` | Refresh values from shared memory |
| `FormatList()` | Apply format strings |
| `GetListString(index)` | Read formatted value |
| `SetListString(index, value)` | Write (when supported by OCX) |
| `ClearList()` | Clear monitor list on disconnect (optional) |

CLSID: `{75E09F4F-B035-4BC5-B835-57ACC52C2B5E}`  
ProgID: `WatchIoCom.WatchIoComCtrl.1`

## UI steps

1. Connection type → **Shared Memory**
2. WatchIO → `SmcControl1` (or your segment name)
3. **Connect** — footer should show `COM SmcControl1` (or `…Full`)
4. Expand tree (needs `/watchio` HTTP) or use workspace-restored pinned variables
5. Pin parameters → COM `AddList` → live `update` messages

## Code map

| File | Responsibility |
|------|----------------|
| `api/watchIoComActiveX.ts` | ProgID, host binding, `SetShMemName` helpers |
| `api/sharedMemoryWatchIoClient.ts` | `WatchIoClient` — COM poll + HTTP tree delegate |
| `components/connection/WatchIoComHost.tsx` | Hidden `<object>` for ActiveX |
| `api/watchIoClientFactory.ts` | `sharedMemory` → `SharedMemoryWatchIoClient` |

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Connect error: ActiveX unavailable | IE mode, OCX registered, 32-bit `regsvr32` |
| Connected but no tree | `/watchio` not on `:8082` — start WatchIoWebServer with `http=1` or use pinned vars only |
| Values frozen | Segment name wrong — try `SmcControl1` vs `SmcControl1Full` |
| Writes ignored | OCX build may not expose `SetListString` |

## vs other transports

| Transport | Values source | Tree |
|-----------|---------------|------|
| **sharedMemory** | WatchIoCom COM / shm | HTTP `/watchio` (optional) |
| **watchIoWs** | STOMP `:8083` | STOMP |
| **watchIoHttp** | HTTP `/watchio` | HTTP |
| **smcServer** | SmcServer HTTP API | SmcServer slash tree |

See also [NewIrisConnection.md](NewIrisConnection.md).
