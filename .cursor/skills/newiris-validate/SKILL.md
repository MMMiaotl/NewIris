---
name: newiris-validate
description: Run post-change validation for the NewIris frontend — lint, TypeScript build, transport smoke scripts, and manual UI checks. Use after implementing or fixing features, before claiming work is complete, or when the user asks to verify, test, or validate changes.
---

# NewIris Validate

Execute the correct validation commands for **NewIris** after code changes. Never report a check as passed unless it was actually run successfully.

Pair with [feature-builder](../feature-builder/SKILL.md) step 8. For connection failures during validation, switch to [watchio-connection-debug](../watchio-connection-debug/SKILL.md). For **pinned refresh freeze / empty description**, use [watchio-live-monitor](../watchio-live-monitor/SKILL.md).

Project entry: [AGENTS.md](../../AGENTS.md). Architecture: [docs/FrontendArchitecture.md](../../docs/FrontendArchitecture.md).

## Principles

1. Run **targeted** checks first, then broader ones.
2. Match commands to **what changed** (see matrix below).
3. Separate **introduced failures** from pre-existing lint noise.
4. Backend smoke scripts require HttpWebServer on `:8082` — if backend is unavailable, say so explicitly; do not skip silently.
5. There is no `npm test` suite — use scripts under `frontend/scripts/` and manual UI steps.

All commands run from `frontend/`:

```powershell
cd frontend
```

## Change-type → command matrix

| Changed area | Required | When backend available |
|--------------|----------|------------------------|
| Any TS/TSX | `npm run lint` | — |
| Types, imports, build config | `npm run build` | — |
| `api/**`, `hooks/useWatchIo.ts`, `vite.config.ts` | `npm run build` | `npm run verify:smc` and/or transport-specific verify |
| SmcServer client / slash tree | `npm run build` | `npm run verify:smc` |
| `/watchio` HTTP client | `npm run build` | `npm run verify:watchio` |
| `stompFrame.ts`, `stompWatchIoClient.ts` | `npm run build` | `npm run test:stomp`; optional `node scripts/probe-watchio-ws.mjs` |
| UI-only (`components/**`, CSS) | `npm run lint` | Manual UI checklist |
| Stores/hooks (no API) | `npm run lint`, `npm run build` | Manual UI if behaviour changed |
| `utils/parse*.ts`, offline parsers | `npm run build` | `npm run test:stomp` if STOMP-related |
| `utils/watchIoLiveMonitor.ts`, `pinnedVariables.ts`, `workspacePersistence.ts` | `npm run build` | Manual: pin params → F5 ×10; message log `varleaves` → `add` → `update` |

When unsure, run: `npm run lint` + `npm run build`.

## Commands reference

### Static analysis and build

```powershell
npm run lint
npm run build
```

- **lint**: ESLint across `frontend/`. Report new errors in touched files; note pre-existing issues separately.
- **build**: `tsc -b && vite build`. Must pass after type or import changes.

### Backend smoke tests (need `:8082`)

```powershell
npm run verify:smc
npm run verify:watchio
node scripts/verify-watchio-api.mjs CasServer   # optional watchIoName
```

Direct script equivalents:

```powershell
node scripts/verify-smc-api.mjs
node scripts/verify-watchio-api.mjs
```

### Offline tests (no backend)

```powershell
npm run test:stomp
node scripts/test-parse-attributes.mjs
```

## Manual UI checklist

After API or connection changes, verify in browser at **http://localhost:5173**:

1. **Request** → lists SmcServer (or `/watchio` for WatchIO transport)
2. Select **SmcServer1** (or correct service)
3. **Connect** → footer shows `connected`
4. Expand tree: `Control` → `Control.Filter` → … → leaf object
5. Parameter table shows variables (e.g. `Kqx1`, `Draught`)
6. Write a value → confirm update (or expected backend rejection)
7. If plot variables selected → chart receives points
8. If replay/session touched → open `.niris` / session JSON, scrub replay bar

For **watchIoWs**: confirm WS connects (`ws://8083`), vartree arrives after Connect.

For **pinned / workspace restore** (see [watchio-live-monitor](../watchio-live-monitor/SKILL.md)):

1. Pin 1–2 parameters → values tick live.
2. Hard refresh ×10 → description present, values resume.
3. Debug drawer message log: `send varleaves` → `recv varleaves` → `send add` → `recv update` (no repeated `list`).

## Workflow

### 1. Identify scope

From the diff or task description, pick rows from the matrix above.

### 2. Run commands in order

```text
1. npm run lint
2. npm run build          (if types/imports/api changed)
3. npm run verify:*       (if api/connection changed AND backend reachable)
4. npm run test:stomp     (if STOMP/parsing changed)
5. Manual UI checklist    (if user-facing or connection behaviour changed)
```

If a command fails:

1. Determine if the failure is caused by this change.
2. Fix introduced failures before finishing.
3. Report pre-existing failures separately with the exact command and error snippet.

### 3. Review the diff

Before reporting done, scan for:

- Debug `console.log` left in place
- Hardcoded `localhost:8082` bypassing proxy in dev
- Chinese in source (identifiers, comments, UI strings)
- Unrelated file changes
- Missing updates to `docs/` when connection behaviour changed

### 4. Report completion

Use this structure (concise):

```markdown
## Validation

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | passed / failed | |
| `npm run build` | passed / failed / skipped | |
| `npm run verify:smc` | passed / failed / skipped (no backend) | |
| Manual UI | done / not run | |

## Issues found
- [only if failures]

## Not verified
- [e.g. backend offline, watchIoWs without :8083]
```

## Definition of done (validation slice)

Validation is complete when:

- All **required** commands for the change type have been run or explicitly skipped with reason
- Introduced failures are fixed or reported as blockers
- Connection/API changes include backend verify **or** documented inability to run it
- User-facing changes include manual UI verification **or** documented skip

Do not substitute "should work" for executed checks.
