# AGENTS.md — Cursor Agent entry point

This file orients AI agents working on **NewIris**: a React SPA that monitors and edits WatchIO variables through HttpWebServer on `:8082`.

## Quick facts

| Item | Value |
|------|-------|
| UI dev server | `http://localhost:5173` (`cd frontend && npm run dev`) |
| API gateway | `http://localhost:8082` — **not** a static site; `/` returns 503 |
| Default transport | `smcServer` → `/SmcServer1` (same API as legacy SmcServerView) |
| Stack | React 19, TypeScript, Vite 8, Zustand, Ant Design 6, uPlot |
| Repo layout | `frontend/` (app), `docs/` (connection & architecture), `reference/` (local only, **not in git**) |

## Do not

- Open `http://localhost:8082/` in the browser as the app URL — use `:5173`.
- Set `VITE_HTTP_URL=http://localhost:8082` in dev on `:5173` (CORS); leave empty and use the Vite proxy.
- Mix SmcServer paths (`Control/Control.Filter...`, slash tree) with WatchIO paths (`C.Filter...`, dot tree) in one client.
- Add Chinese to source code (identifiers, comments, UI strings) unless the user explicitly requests i18n.
- Commit `.cursor/` or `reference/` — both are intentionally gitignored.

## Where to read first

| Topic | Document |
|-------|----------|
| Connection, transports, endpoints | [docs/NewIrisConnection.md](docs/NewIrisConnection.md) |
| HttpWebServer / WatchIoWebServer processes | [docs/WatchIoBackendSetup.md](docs/WatchIoBackendSetup.md) |
| STOMP / WatchIO WebSocket protocol | [docs/WatchIoWebSocket.md](docs/WatchIoWebSocket.md) |
| **Frontend code map, stores, hooks, change checklist** | [docs/FrontendArchitecture.md](docs/FrontendArchitecture.md) |
| Human-oriented project overview | [README.md](README.md) |

## Directory map (frontend)

```
frontend/src/
  api/           WatchIoClient interface + SmcServer / HTTP / STOMP implementations
  stores/        Zustand: connection, variable, plot, session
  hooks/         useWatchIo (live connection), useReplayPlayback, useWorkspacePersistence
  components/    UI by feature: connection, tree, table, plot, control, replay, settings, debug, layout, toolbar
  utils/         JSON/message parsing, tree building, workspace + live monitor, .niris format
  constants/     transport enum and env parsing
```

Entry: `main.tsx` → `App.tsx` → `components/layout/AppShell.tsx`.

## Common commands

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build
npm run preview
npm run lint
```

**Backend smoke tests** (require HttpWebServer on `:8082`):

```powershell
cd frontend
node scripts/verify-smc-api.mjs       # SmcServer path (default for NewIris)
node scripts/verify-watchio-api.mjs   # /watchio HTTP
node scripts/test-stomp-parse.mjs     # STOMP frame parsing (offline)
```

## After making changes

1. Run `npm run lint` in `frontend/`.
2. Run `npm run build` if types or imports changed.
3. If connection/API code changed and backend is available, run the relevant `scripts/verify-*.mjs`.
4. Manual UI check: Request → SmcServer1 → Connect → expand tree → read/write a parameter.

## Local Cursor rules (not in git)

`.cursor/` is gitignored. Keep these rule files locally under `.cursor/rules/`:

| File | Scope |
|------|-------|
| `language-conventions.mdc` | Chat in Chinese; code in English |
| `code-style.mdc` | Minimal code; thorough comments and `docs/` |
| `add-cursor-rules.mdc` | How to add new rules in this project |
| `frontend-react.mdc` | React / Ant Design / component patterns |
| `watchio-api.mdc` | `frontend/src/api/**` — transports and clients |
| `watchio-state.mdc` | Stores, hooks, live vs replay data flow |
| `watchio-live-monitor.mdc` | Pinned params, workspace restore, add/delete monitor diff |
| Skill `watchio-live-monitor` | **Refresh freeze / empty description** — root causes, message log patterns, fix playbook |

If rules are missing after a fresh clone, recreate them from project docs or ask the user to copy from another machine.

## Adding a feature — typical touch points

| Goal | Start here |
|------|------------|
| New transport or API backend | `api/watchIoClient.ts`, `api/watchIoClientFactory.ts`, `constants/transport.ts`, `vite.config.ts` proxy |
| Connection UI / settings | `components/connection/`, `components/settings/`, `stores/connectionStore.ts` |
| Variable tree / table | `components/tree/`, `components/table/`, `stores/variableStore.ts`, `utils/buildVariableTree.ts` |
| Charts | `components/plot/`, `stores/plotStore.ts` |
| Recording / replay / sessions | `stores/sessionStore.ts`, `hooks/useReplay.ts`, `utils/recordingFormat.ts`, `components/replay/` |
| Control panel (plot/variable) | `components/control/`, `stores/connectionStore.ts` (`plotDrawerOpen`) |
| Message handling / live monitor | `hooks/useWatchIo.ts`, `utils/watchIoLiveMonitor.ts`, `utils/pinnedVariables.ts`, `utils/workspacePersistence.ts`, client in `api/` |

See [docs/FrontendArchitecture.md](docs/FrontendArchitecture.md) for data-flow diagrams and store boundaries.

## Legacy reference (local only)

`reference/WatchIoGuide.md` and `reference/Web/SmcServerView.html` are **not in git**. Do not assume they exist in the workspace. Use `docs/NewIrisConnection.md` and verified scripts instead.
