# Durability & Crash-Safety Audit

Scope: `tracer`, `executor`, `plugin-api`, `headroom`
Date: 2026-08-11

## Summary

- **tracer**: Partial crash-safety only; `JsonlWriter` calls `datasync()` but the legacy `SessionEventWriter` in `tracer.ts` does not. In-memory trace store is volatile.
- **executor**: No crash-safe writes. Contract files use read-modify-write without temp-file rename or fsync. Session events are append-only but unsynced.
- **plugin-api**: State persistence and event logs use plain `writeFileSync` / `appendFileSync` with no fsync and no temp-file atomicity.
- **headroom**: Goal DB uses SQLite `DatabaseSync` without explicit WAL/fsync tuning; all JSONL/snapshot writes are unsynced. History file has no rotation.

---

## Findings by Module

### tracer

| # | File | Line | Issue |
|---|------|------|-------|
| 1 | `packages/tracer/src/jsonl-writer.ts` | 57 | `handleRef.datasync()` present — **only crash-safe write in repo**. Good. |
| 2 | `packages/tracer/src/jsonl-writer.ts` | 96-127 | Rotation is **best-effort**: errors are swallowed (`catch {}`). If rotation fails, writes continue to an oversized file. |
| 3 | `packages/tracer/src/jsonl-writer.ts` | 39-43 | `nextSequence` is an in-memory counter. After rotation it resets to `0` (`line 123`). Rotated files can contain duplicate `_seq` values, breaking idempotent replay. |
| 4 | `packages/tracer/src/tracer.ts` | 6-9 | `TRACE_STORE` is an in-memory `Map`. All traces are lost on process crash or restart. No persistence. |
| 5 | `packages/tracer/src/tracer.ts` | 38-56 | `SessionTraceLogger` delegates to `TraceRuntime` → `JsonlWriter`. Works, but legacy `SessionEventWriter` in `executor/session.ts` and `plugin-api/session.ts` does **not** use this path. |

### executor

| # | File | Line | Issue |
|---|------|------|-------|
| 6 | `packages/executor/src/contract.ts` | 92-103 | `appendNote` is **read-modify-write**: reads full file, appends string, writes back. No temp-file rename, no fsync. Crash between read and write loses both old and new data. |
| 7 | `packages/executor/src/contract.ts` | 105-121 | `markTodoDone` same pattern: read, regex replace, write. Non-atomic. |
| 8 | `packages/executor/src/contract.ts` | 123-136 | `recordRejection` same pattern. Non-atomic. |
| 9 | `packages/executor/src/contract.ts` | 42-68 | `ensureAgentContract` writes four files sequentially (`GOAL.md`, `PERSONALITY.md`, `NOTES.md`, `TODO.md`, `REJECTED.md`). No atomicity across files; partial creation leaves agent in inconsistent state. |
| 10 | `packages/executor/src/session.ts` | 39-41 | `SessionEventWriter.write` uses `appendFileSync` without `fsync`. Event loss on power loss / OOM kill. |
| 11 | `packages/executor/src/session.ts` | 64-66 | `clear()` truncates file via `writeFileSync(..., "", "utf8")` without fsync. Empty file may not survive crash. |
| 12 | `packages/executor/src/session.ts` | 109-121 | `SessionStore.upsert` writes handle record via `writeFileSync` without fsync. |
| 13 | `packages/executor/src/executor.ts` | 1-251 | No durable logging of agent stdout/stderr beyond in-memory `messages` array. On crash, all agent output is lost. |

### plugin-api

| # | File | Line | Issue |
|---|------|------|-------|
| 14 | `packages/plugin-api/src/durability.ts` | 44 | `writeFileSync(file, state, "utf8")` for plugin state. No fsync, no temp-file + rename. Partial write = corrupt plugin state. |
| 15 | `packages/plugin-api/src/durability.ts` | 131-132 | `appendFile` for events uses async API but **no `fsync` / `fdatasync`**. |
| 16 | `packages/plugin-api/src/durability.ts` | 54-76 | `restore` reads state file and returns parsed JSON. No integrity check (no checksum, no length prefix). Truncated/corrupt file throws uncaught `JSON.parse` error. |
| 17 | `packages/plugin-api/src/session.ts` | 57-58 | `SessionEventLogWriter.write` uses `appendFileSync` without fsync. |
| 18 | `packages/plugin-api/src/session.ts` | 82-84 | `clear()` truncates via `writeFileSync("", ...)` without fsync. |
| 19 | `packages/plugin-api/src/session.ts` | 222-228 | `SessionStore.upsert` writes JSON record without fsync. |
| 20 | `packages/plugin-api/src/composition.ts` | — | No file I/O; not applicable. |
| 21 | `packages/plugin-api/src/registry.ts` | — | In-memory only; no persistence. |

### headroom

| # | File | Line | Issue |
|---|------|------|-------|
| 22 | `packages/headroom/src/goal-store.ts` | 100 | `appendFileSync` for JSONL goal append. No fsync. |
| 23 | `packages/headroom/src/goal-store.ts` | 192 | `writeFileSync` for snapshot overwrite. No temp-file rename, no fsync. |
| 24 | `packages/headroom/src/goal-store.ts` | 42-61 | SQLite `DatabaseSync` opened without `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL/EXTRA`, or busy timeout. SQLite durability defaults vary by build/OS. |
| 25 | `packages/headroom/src/delta.ts` | 82-86 | `appendHistoryLine` uses `writeFileSync(..., { flag: "a" })` without fsync. |
| 26 | `packages/headroom/src/delta.ts` | 100-104 | `writeSnapshot` appends JSON to history file without fsync. |
| 27 | `packages/headroom/src/delta.ts` | 61-62 | `DEFAULT_SNAPSHOT_DIR` / `HISTORY_FILE` have no rotation. Unbounded growth. |
| 28 | `packages/headroom/src/heartbeat.ts` | 103-105 | `persistHeartbeatState` uses `writeFileSync` without fsync. Heartbeat state loss on crash causes missed ticks. |
| 29 | `packages/headroom/src/runtime.ts` | 40 | `initialize` appends snapshot to history. If crash happens after DB write but before history append, recovery is inconsistent. |
| 30 | `packages/headroom/src/runtime.ts` | 61 | `applyDelta` appends new snapshot without syncing prior state. |
| 31 | `packages/headroom/src/headroom.ts` | 69-75 | Four artifact files written sequentially with `writeFileSync`. No fsync, no atomicity. |
| 32 | `packages/headroom/src/headroom.ts` | 67 | `runtime.applyDelta(delta)` is called **before** artifact files are written. If crash occurs between delta apply and artifact writes, snapshot exists but artifacts are stale/missing. |

---

## Cross-Cutting Gaps

1. **No temp-file + rename pattern** anywhere in `tracer`, `executor`, `plugin-api`, or `headroom` for crash-safe overwrites. `writeFileSync` is direct-to-target.
2. **No `fsync`** on any write except `tracer/src/jsonl-writer.ts:57` (`datasync`).
3. **Read-modify-write races** in `executor/src/contract.ts` (`appendNote`, `markTodoDone`, `recordRejection`) and `headroom/src/*` snapshot updates.
4. **No log rotation/compaction** in `executor/src/session.ts`, `plugin-api/src/session.ts`, `plugin-api/src/durability.ts`, `headroom/src/delta.ts`. `tracer/src/jsonl-writer.ts` has rotation but swallows errors.
5. **No idempotency keys** in append-only logs (no UUIDs, no deterministic sequence bounds across restarts).
6. **No checksums / length-prefix framing** for persisted JSON. Truncated files cause uncaught `JSON.parse` exceptions during recovery.
7. **Duplicate implementations**: `SessionEventWriter` exists in both `executor/src/session.ts` and `plugin-api/src/session.ts` with identical gaps, suggesting shared abstraction debt.

---

## Production-Grade Patterns Missing

- **WAL + `fsync` for SQLite**: `goal-store.ts` opens `DatabaseSync` without durability pragmas.
- **Write-Ahead Log (WAL) for JSONL**: Tracer comes closest with `JsonlWriter`, but other JSONL logs lack even basic `datasync`.
- **Temp-file + `renameSync`**: Canonical POSIX atomic write. Absent everywhere.
- **Structured recovery**: No replay offset persistence, no checksum validation, no truncation detection.
- **Rotation with backpressure**: Tracer rotates silently; others don't rotate at all.

---

## Recommendations (Priority Order)

| Priority | Action | Location |
|----------|--------|----------|
| P0 | Add `fsync` / `fdatasync` to all `writeFileSync` / `appendFileSync` paths that must survive crashes. | All modules |
| P0 | Replace direct `writeFileSync` overwrites with temp-file + `renameSync` for agent contracts, plugin state, session records, snapshots. | executor, plugin-api, headroom |
| P1 | Make executor read-modify-write operations atomic (write to `.tmp`, rename). | `executor/src/contract.ts` |
| P1 | Add SQLite WAL + `PRAGMA synchronous=NORMAL` to `goal-store.ts`. | `headroom/src/goal-store.ts` |
| P1 | Add bounded rotation + error reporting to `headroom/src/delta.ts` history file. | headroom |
| P2 | Add integrity metadata (length prefix or SHA-256) to persisted JSON to detect truncation. | plugin-api, executor, headroom |
| P2 | Unify duplicate `SessionEventWriter` into a shared durable implementation with fsync. | executor + plugin-api |
| P3 | Persist `TRACE_STORE` or replace in-memory tracing with the `JsonlWriter` path everywhere. | tracer |
