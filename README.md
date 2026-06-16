# NewIris

Modern browser-based WatchIO parameter monitor with Iris-style layout.

**Author:** Tianlei miao

## Architecture

| Address | Role |
|---------|------|
| **http://localhost:5173** | NewIris UI (Vite dev/preview server) |
| **http://localhost:8082** | HttpWebServer **API gateway** (`/request`, `/SmcServer1`) |

NewIris reads WatchIO variables via **`/SmcServer1`** (same as `Web/SmcServerView.html`). It does **not** depend on `/watchio` or WebSocket :8083. See [docs/NewIrisConnection.md](docs/NewIrisConnection.md).

**Important**: `:8082` is **not** a static web server. Opening `http://localhost:8082/` returns 503 and may hang — expected behavior.

## Prerequisites

1. `HttpWebServer.exe` on port **8082**
2. Local WatchIO segment running (e.g. `SmcControl1`, exposed via SmcServer)

## Run NewIris (recommended)

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in the browser (not :8082).

Connect: **request** → select **SmcServer1** → toolbar **Connect**. In Settings, leave HTTP URL **empty** (Vite proxy); set Instance to `SmcControl1`.

## Production preview

```powershell
cd frontend
npm run build
npm run preview
```

Again use **http://localhost:5173**.

## Environment variables (optional)

- `VITE_HTTP_URL` — leave empty in dev; do not set `http://localhost:8082` on :5173 (CORS)
- `VITE_HOST_ADDRESS` — default `localhost:8082`
- `VITE_WATCHIO_NAME` — default `SmcControl1` (tree root label)

## Documentation

- **[AGENTS.md](AGENTS.md)** — Cursor Agent entry (commands, constraints, change map)
- **[docs/FrontendArchitecture.md](docs/FrontendArchitecture.md)** — frontend code layout and data flow
- **[docs/NewIrisConnection.md](docs/NewIrisConnection.md)** — verified connection (SmcServer1 API, steps, endpoints)
- [docs/WatchIoBackendSetup.md](docs/WatchIoBackendSetup.md) — HttpWebServer / WatchIoWebServer process layout
- [docs/WatchIoWebSocket.md](docs/WatchIoWebSocket.md) — WatchIO WebSocket protocol (not used by NewIris today)

## Features

- Variable tree (`vartree` / `varleaves`)
- Parameter table with inline edit (`set` + `command`)
- uPlot real-time charts
- `.niris` recording / replay
- Session save/load

## Legacy reference (local `reference/` folder, not in git)

- `reference/WatchIoGuide.md` — SOAP integration
- `reference/Web/SmcServerView.html` — SmcServer API reference client
