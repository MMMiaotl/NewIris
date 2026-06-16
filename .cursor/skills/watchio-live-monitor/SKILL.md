---
name: watchio-live-monitor
description: Diagnose and fix NewIris pinned parameters or plot freezing after refresh — empty description, no live updates, metadata queue stuck. Use when refresh breaks live values, workspace restore fails, varleaves/add never sent, or when editing useWatchIo, watchIoLiveMonitor, pinnedVariables, workspacePersistence.
---

# WatchIO Live Monitor (pinned / refresh)

Use when **Parameters or Plot stop updating after F5**, especially with **empty description** or **session-cached values that never go live**.

Guardrails: `.cursor/rules/watchio-live-monitor.mdc`. Architecture: [docs/FrontendArchitecture.md](../../docs/FrontendArchitecture.md).

## Symptom checklist

| User sees | Store signal |
|-----------|--------------|
| Value frozen after refresh | `sessionCacheOnly: true` never cleared |
| **Description empty** | `serverMetadataLoaded !== true` |
| Plot flat, table may show cache | monitor never `add`ed, or no `update` stream |
| Intermittent (~50% on F5) | race: metadata queue stuck or `list` reset stream |

## Message log signatures (WatchIO Message Log drawer)

Open **Debug → WatchIO messages**. Log records **send** and **recv** (not `update` spam).

### Healthy refresh sequence

```text
recv status
recv vartree
send varleaves          ← pinned branch (priority)
recv varleaves          ← description/type arrive
send add                ← per pinned variable
recv update             ← values tick
```

### Failure A — metadata never loaded (most common)

```text
recv status
recv vartree
(no send varleaves, or send varleaves with no recv varleaves)
(no send add)
```

**Meaning:** pinned metadata pipeline never completed → `serverMetadataLoaded` stays false → `syncWatchIoMonitorDiff` skips `add`.

**Historical root cause:** client sent **`varinfo`** for pinned recovery; **SmcControl STOMP often never replies**. STOMP metadata queue had **no timeout** → `metadataInFlight` deadlocked → all later `varleaves` blocked.

**Fix (current):** `runPinnedLivePipeline` uses **branch `varleaves` only** (same path as manual tree expand). STOMP queue: **3s timeout**, **priority** unshift for pinned branches.

### Failure B — monitor stream reset

```text
send list (repeated)
recv update stops
```

**Meaning:** `type:list` or `add`+`list` mix reset server monitor.

**Fix:** **`syncWatchIoMonitorDiff` only** — `add`/`delete`, never `setMonitorList` / `type:list` on WebSocket.

### Failure C — live resumes after 1–2s only

```text
send varleaves … recv varleaves … send add … (long gap) … recv update
```

**Meaning:** waiting for varleaves before monitor add.

**Fix:** workspace **`pinnedMetadata`** cache (`dataType`, description) → `serverMetadataLoaded: true` on hydrate → immediate `add`; background varleaves refresh.

## Root cause → fix map

| Root cause | Why it breaks | Correct approach |
|------------|---------------|------------------|
| `varinfo` for pinned recovery | No STOMP response; queue deadlock | Branch **`fetchVarLeaves(branch, true, priority)`** |
| No metadata queue timeout | One lost request blocks forever | `METADATA_REQUEST_TIMEOUT_MS` in `stompWatchIoClient.ts` |
| `type:list` / `setMonitorList` | Resets server update subscription | `syncWatchIoMonitorDiff` → add/delete only |
| `applyUpdate` before metadata | Clears `sessionCacheOnly` too early | Gate on `serverMetadataLoaded` |
| Parallel monitor effects | Duplicate add/list races | **Single** `runPinnedLivePipeline` in `useWatchIo` |
| Tree `varleaves` before pinned | Queue starvation | Defer `selectedBranch` fetch until `missingPinnedVariableNames()` empty |
| `pendingBranches` never cleared | No retry after lost response | Clear on `recv varleaves`; interval retry in pipeline effect |

## Architecture (do not regress)

```
hydrateWorkspaceOnce()
  └── seedPinnedVariableCache(values, pinnedMetadata)  → may set serverMetadataLoaded

connect() → runPinnedLivePipeline()
  ├── missing metadata?
  │     └── fetchVarLeaves(branch, true, priority=true)  [STOMP queue]
  ├── metadata ready (varleaves or workspace cache)
  │     └── syncWatchIoMonitorDiff → add/delete + requestUpdate burst
  └── refreshPinnedMetadataInBackground (low priority varleaves)

handleMessage varleaves → mergeVarLeaves → clearPinnedBranchPending → runLivePipeline
handleMessage update → applyUpdate (respect serverMetadataLoaded gate)
```

**Key files**

| File | Role |
|------|------|
| `utils/watchIoLiveMonitor.ts` | `runPinnedLivePipeline`, `syncWatchIoMonitorDiff` |
| `hooks/useWatchIo.ts` | Message routing, pipeline effect, requestUpdate polling |
| `utils/pinnedVariables.ts` | `missingPinnedVariableNames`, `isPinnedVariableLiveLoaded` |
| `utils/workspacePersistence.ts` | `pinnedValues`, `pinnedMetadata` in sessionStorage |
| `stores/variableStore.ts` | `serverMetadataLoaded`, `seedPinnedVariableCache` |
| `api/stompWatchIoClient.ts` | Serialized varleaves queue + timeout |

## Diagnosis workflow

1. Reproduce: pin 1–2 params → hard refresh ×5.
2. Open message log — match **Failure A / B / C** above.
3. In React/Zustand: check pinned row `serverMetadataLoaded`, `sessionCacheOnly`.
4. Confirm transport (`watchIoWs` vs `watchIoHttp` vs `smcServer`) — Smc uses separate `refreshSmcPinnedVariables`.
5. Apply fix from table; **do not** add per-variable patches.

## Anti-patterns (never reintroduce)

```text
❌ fetchVarInfo for workspace restore on STOMP
❌ setMonitorList / type:list on WebSocket steady state
❌ add + list in same recovery path
❌ Second useEffect syncing monitor outside runPinnedLivePipeline
❌ isPinnedVariableLiveLoaded = !sessionCacheOnly (wrong — use serverMetadataLoaded)
❌ mergeVarList for varlist search (use setSearchVarlistIndex)
```

## Verification

Run [newiris-validate](../newiris-validate/SKILL.md) after changes.

Manual (required for this area):

1. Select param → live ticks.
2. Hard refresh ×10 → **description present**, values resume (≤~200ms if metadata cached).
3. Message log: `send varleaves` → `recv varleaves` → `send add` → steady `recv update`; **no** repeated `list`.

## Report format

```markdown
## Symptom
[frozen after refresh / empty description / …]

## Message log pattern
[Failure A | B | C | healthy]

## Root cause
[varinfo deadlock | list reset | no metadata cache | …]

## Fix
[files changed + why]

## Verified
[refresh ×10, log sequence]
```
