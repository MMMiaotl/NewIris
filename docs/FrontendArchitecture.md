# Frontend architecture (for code changes)

This document maps the NewIris React app so agents and developers know **where to edit** and **what not to cross**.

Connection and backend setup: [NewIrisConnection.md](NewIrisConnection.md). Agent quick start: [../AGENTS.md](../AGENTS.md).

## Runtime architecture

```
Browser (:5173)
  │
  ├─ AppShell ── ConnectionBar / MenuBar / drawers
  │
  ├─ useWatchIo() ── createWatchIoClient(config)
  │       │
  │       ├─ smcServer      → SmcServerClient     → GET /SmcServerN/...  (slash tree)
  │       ├─ sharedMemory   → SharedMemoryWatchIoClient → WatchIoCom ActiveX (local shm)
  │       ├─ watchIoHttp    → HttpWatchIoClient    → GET /watchio/...     (dot tree)
  │       └─ watchIoWs      → StompWatchIoClient   → STOMP ws://:8083     (dot tree)
  │
  ├─ Zustand stores ← WatchIoMessage handlers in useWatchIo
  │
  └─ VariableTree / ParameterTable / PlotPanel / ReplayControls
```

Vite proxies `/request`, `/SmcServer1`, `/SmcServer2`, `/watchio` to `localhost:8082` in dev (`vite.config.ts`). Leave `VITE_HTTP_URL` empty in dev so requests stay same-origin.

## Source layout

| Path | Responsibility |
|------|----------------|
| `api/watchIoClient.ts` | `WatchIoClient` interface — all transports implement this |
| `api/watchIoClientFactory.ts` | `createWatchIoClient()` switch on `config.transport` |
| `api/smcServerClient.ts` | SmcServer HTTP polling client (default) |
| `api/httpWatchIoClient.ts` | WatchIO over HTTP `/watchio` |
| `api/stompWatchIoClient.ts` | WatchIO over STOMP WebSocket |
| `api/sharedMemoryWatchIoClient.ts` | Windows COM shared-memory client |
| `api/watchIoComActiveX.ts` | WatchIoCom ActiveX host helpers |
| `api/smcHttp.ts` | `/request` discovery, service list helpers |
| `api/types.ts` | Shared types: `WatchIoMessage`, `ConnectionConfig`, `SessionFile`, etc. |
| `api/watchIoPaths.ts`, `watchIoServerJson.ts`, `watchIoWsDiscovery.ts` | URL builders and discovery |
| `api/stompFrame.ts` | STOMP frame encode/decode |
| `stores/connectionStore.ts` | Transport config, discovery (`runDiscovery`), connect status, layout |
| `stores/variableStore.ts` | Tree nodes, branch variables, selection, registration flags |
| `stores/plotStore.ts` | Plot series, colors, Y range (max 8 series) |
| `stores/sessionStore.ts` | Recording frames, replay state |
| `hooks/useWatchIo.ts` | **Single orchestrator** for connect/disconnect, message routing, pinned live pipeline |
| `hooks/useReplay.ts` | `useReplayPlayback` (RAF loop) + `seekReplayFrame` for scrubbing |
| `hooks/useWorkspacePersistence.ts` | Debounced sessionStorage save for workspace |
| `utils/parseWatchIoMessage.ts` | Normalize `WatchIoMessage` entries |
| `utils/parseSmcJson.ts` | SmcServer JSON response parsing |
| `utils/buildVariableTree.ts` | Merge vartree/varleaves into Ant Design tree data |
| `utils/pinnedVariables.ts` | Pinned name collection, live-loaded checks |
| `utils/watchIoLiveMonitor.ts` | `runPinnedLivePipeline`, monitor add/delete diff |
| `utils/workspacePersistence.ts` | sessionStorage workspace (selection, values, metadata) |
| `utils/watchIoDebug.ts` | Optional console + message log helpers |
| `utils/recordingFormat.ts` | `.niris` file read/write |
| `utils/parseAttributes.ts` | Variable metadata from params |
| `constants/transport.ts` | Transport labels, `defaultServerPath`, env default |
| `utils/workspaceScope.ts` | Connection instance key for workspace/plot persistence |
| `components/layout/AppShell.tsx` | Root layout; wires hooks to panels |

Components are grouped by feature under `components/{connection,tree,table,plot,control,replay,settings,debug,toolbar,layout}/`. Prefer adding UI there rather than bloating `AppShell`.

## Data flow (live mode)

1. User clicks **Request** → `connectionStore.runDiscovery()` → `/request` → `discoveredServices`.
2. User selects service → `connectionStore.config.serverPath` (e.g. `/SmcServer1`).
3. **Connect** → `useWatchIo.connect()` → factory creates client → `client.connect()`.
4. Client emits `WatchIoMessage` → `useWatchIo.handleMessage`:
   - `vartree` / module objects → `buildSmcModuleTree` or `buildDotBranchTree` → `variableStore.setTreeNodes` / merge
   - `varleaves` → `variableStore.mergeVarLeaves`; may trigger `runPinnedLivePipeline` → `add`/`delete` monitor diff
   - `varlist` → `variableStore.setSearchVarlistIndex` (search/flat-tree filter only)
   - `update` → `variableStore.applyUpdate`, `plotStore.sampleLivePlotVariables`, optional `sessionStore.appendRecordingFrame`
5. On connect / pinned change: `runPinnedLivePipeline` loads metadata via `varleaves` (or workspace cache), then `syncWatchIoMonitorDiff` (add/delete only — never `type:list` on WebSocket).
6. User edits table → `setVariableValue` → client `setVariable` + local optimistic update.
7. User registers variable for polling → `registerVariable` → client `addVariable`.

**Rule:** Components should not instantiate API clients directly. Go through `useWatchIo` or extend it.

## Store boundaries

| Store | Owns | Does not own |
|-------|------|----------------|
| `connectionStore` | `ConnectionConfig`, transport, service discovery, `appMode`, `viewMode`, drawer flags | Variable values, plot points |
| `variableStore` | Tree, table rows, `selectedBranch`, `branchVarPrefix`, multi-select for plot | Socket/HTTP client |
| `plotStore` | Series data, plot variable list, Y axis | Connection status |
| `sessionStore` | Recording/replay buffers, replay transport controls | Live client lifecycle |

Cross-store reads in hooks are OK (`useWatchIo`, `useReplayPlayback`). Avoid circular imports between stores.

## Transports — naming and trees

| Transport | Tree shape | Path example | `watchIoName` role |
|-----------|------------|--------------|-------------------|
| `smcServer` | Slash object tree under modules | `Control/Control.Filter.Surge.Coefs` | Display label; paths come from SmcServer API |
| `watchIoHttp` / `watchIoWs` | Dot-separated WatchIO paths | `C.Filter.Surge.Coefs` | Segment name in `/watchio/{name}:...` |

Do not reuse SmcServer URL builders for WatchIO clients or vice versa.

## App modes

| Mode | `connectionStore.appMode` | Behavior |
|------|---------------------------|----------|
| Live | `live` | `useWatchIo` connects when user clicks Connect |
| Offline | `offline` | No network; UI still usable for session files |
| Replay | `replay` | `useReplayPlayback` drives updates from `sessionStore.replayData` |

## Session and file formats

- **Session file** (`.niris` session export): `SessionFile` in `api/types.ts` — transport, registered vars, plot config.
- **Recording file**: `RecordingFile` — time series of variable snapshots; replay via `sessionStore` + `useReplayPlayback`.

Parsers live in `utils/recordingFormat.ts`. Keep version field `version: 1` when extending.

## UI stack conventions

- **Ant Design 6** for layout (`Splitter`, drawers, tables, forms).
- **uPlot** in `PlotPanel` — not Ant Design charts.
- Global styles: `App.css`, `index.css`; avoid CSS-in-JS libraries.
- Functional components only; state in Zustand or local `useState` for purely local UI.

## Change checklists

### New connection transport

1. Implement `WatchIoClient` in `api/`.
2. Add case in `watchIoClientFactory.ts`.
3. Add to `ConnectionTransport` and `transportOptions` in `constants/transport.ts` and `api/types.ts`.
4. Update `connectionStore` defaults if needed.
5. Add Vite proxy paths in `vite.config.ts` if new HTTP prefixes.
6. Document in `docs/NewIrisConnection.md`.
7. Add or extend `frontend/scripts/verify-*.mjs` if testable via HTTP/WS.

### New variable UI behavior

1. Prefer extending `variableStore` actions.
2. Route server I/O through `useWatchIo` callbacks passed into components (see `AppShell` props pattern).
3. Update tree builders in `utils/buildVariableTree.ts` if tree shape changes.

### Pinned parameters / refresh live freeze

If **values freeze after F5** or **description is empty**, the pinned live pipeline failed before `add` + `update`.

| Signal | Meaning |
|--------|---------|
| Message log: only `status` + `vartree` | No `varleaves`/`add` — metadata not loaded (`serverMetadataLoaded` false) |
| Empty description column | Same — varleaves never merged into store |
| Repeated `list` in log | Monitor stream reset — must use add/delete diff only |

**Recovery architecture** (see `utils/watchIoLiveMonitor.ts`):

1. Workspace `pinnedMetadata` cache → immediate monitor add when `dataType` known.
2. Else priority **branch `varleaves`** (not `varinfo` on STOMP — often no response).
3. `syncWatchIoMonitorDiff` → `add`/`delete` only; never `type:list` on WebSocket.
4. STOMP varleaves queue: serialized + 3s timeout.

Local Cursor skill: `.cursor/skills/watchio-live-monitor/SKILL.md` (not in git).

### New plot behavior

1. `plotStore` for data; `PlotPanel` / `ControlPanel` for UI.
2. Ensure `useWatchIo` still drives plot sampling for registered plot variables in live mode (`sampleLivePlotVariables`).
3. Update `useReplayPlayback` / `seekReplayFrame` if replay should mirror the behavior.

## Verification

```powershell
cd frontend
npm run lint
npm run build
node scripts/verify-smc-api.mjs    # needs :8082 + SmcServer
```

Pure parsing logic (`parseSmcJson`, `parseWatchIoMessage`, `stompFrame`) can be tested offline via existing scripts or future unit tests.

## Code style (repo convention)

- **Source**: minimal — smallest correct implementation; shared logic in `api/`, `stores/`, `hooks/`, `utils/` (see `.cursor/rules/code-style.mdc`).
- **Comments / docs**: thorough on non-obvious protocol, store boundaries, and failure modes — this file and [NewIrisConnection.md](NewIrisConnection.md) are the onboarding path.

## Related docs

- [NewIrisConnection.md](NewIrisConnection.md) — endpoints, UI connect steps
- [WatchIoBackendSetup.md](WatchIoBackendSetup.md) — process layout
- [WatchIoWebSocket.md](WatchIoWebSocket.md) — STOMP details for `watchIoWs`
