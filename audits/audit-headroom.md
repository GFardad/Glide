# @glide/headroom — Architecture vs Production-Grade Audit
**Audit scope:** `packages/headroom/src/**/*.ts`  
**Reference docs:** `Plan/Architecture.md`, `Plan/ProductionReadiness-2026-08-11.md`, `Plan/ArchitectureVsCode.md`, `Plan/FULL_PRODUCTION_READINESS_AUDIT_2026-08-11.md`, `audit/durability-crash-safety-audit.md`  
**Date:** 2026-08-11

---

## 1. Global Findings (cross-file)

| Severity | File | Line(s) | Finding |
|----------|------|---------|---------|
| HIGH | `headroom.ts` | 69–75 | Four artifact files written sequentially with `writeFileSync`. No fsync, no atomic temp-rename. The delta is applied before artifacts are written (line 68 vs 70–76), so a crash between those points produces a snapshot with stale/missing artifacts. |
| HIGH | `delta.ts` | 82–86, 100–104 | `appendHistoryLine` and `writeSnapshot` use `writeFileSync` with `{ flag: "a" }` but no `fsync`. JSONL history has no rotation, no sequence markers, and no corruption recovery. Unbounded growth will eventually hit filesystem limits. |
| HIGH | `goal-store.ts` | 42–61, 83–114, 160–179 | `createFileDatabase` declares a SQLite-like interface but is never backed by actual SQLite; it uses JSON file I/O instead. The declared `DatabaseSync` types (`sqlite.d.ts`) are fake stubs. All reads use `JSON.parse` without Zod schema validation despite `zod` being a declared dependency and architecture mandating schema-first design. |
| HIGH | `goal-store.ts` | 14–19, 111 | `resetGoalStoreCache` is a no-op, and the module imports `appendFileSync` but uses it only in `appendGoalJsonl`. More critically, `persistGoal`, `updateGoalStatus`, `loadGoal`, etc. all use read-modify-write on `goals.json` with no file locking, so concurrent writers will clobber each other. |
| HIGH | `runtime.ts` | 45–68, 91–114 | `init` calls `appendHistoryLine` after loading/creating campaign but before building a snapshot; `applyDelta` calls `loadLatestSnapshot` then `appendHistoryLine` without syncing or atomic replace. If a crash occurs between DB write and history append, recovery is inconsistent. `rollback` appends the target snapshot to history instead of rewriting to a known-good state. |
| MEDIUM | `roles.ts` | 16–19, 171–179 | `RoleAnalysis` is typed as `Record<string, { ... }>` with no Zod schema. `runRoleAnalysis` writes `role_analysis.json` with no validation; if the output is ever consumed by another package, there is no contract enforcement. The blocking list is a static lowercase substring match against a 14-item array — this is not production-grade policy enforcement. |
| MEDIUM | `headroom.ts` | 156–161 | `detectDrift` does naive case-insensitive substring inclusion. An objective like "add auth" will not trigger drift if the architecture mentions "auth", even if the actual artifact content has nothing to do with the objective. This produces false negatives and false positives. |
| MEDIUM | `heartbeat.ts` | 111–118, 163–168 | `loadHeartbeatState` uses `JSON.parse(readFileSync(...))` with no schema validation; a corrupted heartbeat file silently becomes `undefined`, causing the service to restart from scratch. `persistHeartbeatState` uses `writeFileSync` without fsync, so heartbeat state loss on crash causes missed ticks. |
| MEDIUM | `converge.ts` | 29–66, 80–125 | `loadPlanItems` extracts headings and checklist items from `Plan/*.md` with regex. `scanCodebase` collects source files with a recursive `readdirSync`. `assessConvergence` does keyword overlap matching — this is not semantic convergence assessment and will produce both false positives and false negatives. |
| MEDIUM | `goal-store.ts` | 1, 14, 33, 83, 222 | `appendFileSync` is imported at line 1 but unused in most paths except `appendGoalJsonl` (line 222). `appendGoalJsonl` appends to `goals.jsonl` without fsync. The module imports `writeFileSync`, `readFileSync`, `existsSync`, `mkdirSync` — all synchronous — with no async alternatives. |
| MEDIUM | `delta.ts` | 78–80 | `snapshotId` uses `Date.now().toString(36)` + `Math.random().toString(36).slice(2, 8)`. Architecture §6.3 explicitly lists `ulid` / `nanoid` for ID generation. The ID is not globally unique and has low entropy for collision resistance. |
| MEDIUM | `runtime.ts` | 36–43 | Constructor accepts `string | HeadroomRuntimeOptions`. If a string is passed, `tracer` is `undefined` and `start()` does nothing useful. The `initialize` and `init` methods are redundant aliases. The lifecycle methods (`start`/`stop`/`dispose`) are sync but the underlying I/O is also sync — there is no async boundary. |
| LOW | `headroom.ts` | 8–30 | `HeadroomInput` and `HeadroomResult` are well-typed but `HeadroomResult.roleSignals` uses `Record<string, string[]>` with no Zod schema. The `campaign` object in the result duplicates fields from `HeadroomRuntimeState` rather than referencing a shared type from `@glide/core`. |
| LOW | `mcp-server/src/tools/glide-headroom.ts` | 31–86 | The tool handler does runtime type checks with `typeof` instead of using Zod schema validation at the MCP boundary. The `isError` flag is set manually; the SDK already supports structured error responses. |

---

## 2. File-by-File Findings

### `packages/headroom/src/headroom.ts`
- **Lines 40–42:** `runtime.start()` is called before `runtime.init()`. `start()` sets `initialized = true` but does not validate the campaign directory or check for existing state. If `init` fails after `start`, the runtime is left in a half-initialized state.
- **Lines 48–52:** `detectDrift` compares the raw objective string against concatenated artifact text. It does not weight sections, does not check individual artifact files, and returns `true` for any empty objective even if artifacts are present. This conflates "no objective given" with "drift detected".
- **Lines 54–68:** `HeadroomDelta` is constructed with a hardcoded `kind: "update"` and `previousGoal: state.campaign.goal` even when the campaign is being created fresh (i.e., `previousGoal` equals `goal`). The delta model assumes reversible operations but the headroom function only ever emits `update`.
- **Lines 69–76:** Artifact writes are sequential `writeFileSync` calls. There is no retry, no fsync, and no transactional guarantee. If the process is killed between writes, some artifacts exist and others do not.

### `packages/headroom/src/runtime.ts`
- **Lines 45–68:** `init` loads an existing campaign or creates a new one, then immediately appends a history line. There is no check for whether the campaign was already initialized in a previous run, so duplicate initialization appends duplicate history entries.
- **Lines 91–114:** `applyDelta` loads the latest snapshot, applies operations, creates a new snapshot, and appends it to history. There is no verification that the prior snapshot's state matches the current file system state. `loadLatestSnapshot` reads the entire history file into memory and parses every line — performance degrades linearly with history size.
- **Lines 116–129:** `rollback` appends the target snapshot to the history file rather than truncating or rewriting to a consistent state. This means rollback is append-only and the history file grows indefinitely. There is also no check that the snapshot being rolled back to is actually earlier than the current state.
- **Lines 135–178:** Private helpers `toState`, `buildSnapshot`, and `emptySnapshot` are correct in shape but `toState` casts `campaign.createdAt` / `campaign.updatedAt` through `toIso`, which silently converts `undefined` to the current timestamp. This masks data integrity issues.

### `packages/headroom/src/delta.ts`
- **Lines 78–86:** `snapshotId` uses `Date.now()` + `Math.random()` as noted above. `appendHistoryLine` opens the file with `{ flag: "a" }` and writes without fsync. If the OS buffers the write and power is lost, the append is lost.
- **Lines 88–98:** `readHistoryLines` reads the entire file into memory, splits by newline, trims, and filters. For a large history file, this is a memory allocation spike. There is no streaming, no chunked read, and no max-line limit.
- **Lines 100–105:** `writeSnapshot` appends JSON to the same history file used by `appendHistoryLine`. This means snapshots and history lines share a single file with no delimiter or format distinction — a snapshot written by `writeSnapshot` will be parsed as a history line by `readHistoryLines` and vice versa.
- **Lines 107–135:** `loadLatestSnapshot` and `loadSnapshot` both iterate the full file and parse every line with `JSON.parse`. There is no indexing, no binary search, and no offset cache. Malformed lines are silently skipped, which can hide data corruption.

### `packages/headroom/src/goal-store.ts`
- **Lines 14–64:** `createFileDatabase` returns an object that mimics `DatabaseSync` but is not a real SQLite database. It reads/writes `goals.json` with `JSON.parse`/`writeFileSync`. The `exec` method only ensures the file exists; `prepare().run()` always returns `{ changes: 1 }` regardless of actual row count. This is a fake ORM layer that gives a false sense of database semantics.
- **Lines 83–114:** `persistGoal` reads the entire `goals.json` file, modifies an array element in memory, and rewrites the whole file. There is no file lock, no atomic rename, and no fsync. If two calls happen concurrently, one will overwrite the other's changes.
- **Lines 117–137, 139–158, 160–181, 183–205:** All `load*` and `updateGoalStatus` functions repeat the same read-modify-write pattern with `JSON.parse` on untrusted file content. `metadata` is double-parsed (`JSON.parse(row.metadata as string)`), which will throw at runtime if `metadata` is not a valid JSON string.
- **Lines 222–244:** `appendGoalJsonl` appends to `goals.jsonl` without fsync. `readGoalJsonl` reads the entire file and parses every line with `JSON.parse` — no error recovery for malformed lines.
- **Lines 246–259:** `nanoid` is implemented inline (lines 250–259) instead of using the `nanoid` package listed in `Architecture.md` §6.3 as a core dependency. The `crypto.getRandomValues` approach is good, but the duplication violates the "open-source first, don't reinvent" principle.

### `packages/headroom/src/heartbeat.ts`
- **Lines 37–43:** `start()` calls `tick()` immediately, then sets up `setInterval`. If `tick()` throws, the interval is never set and the service is left in a broken state with no recovery.
- **Lines 57–76:** `tick()` loads active goals from `heartbeat-state.json`, calls `onTick`, then persists state. The persistence happens after the callback, so if `onTick` crashes, state is not updated and the iteration count is lost.
- **Lines 111–118:** `loadHeartbeatState` returns `JSON.parse(readFileSync(...))` with no type guard. If the file contains invalid JSON, the parser throws and the caller gets no error — the service just crashes.
- **Lines 133–161:** `matchScheduledGoals` and `loadDueGoals` both call `loadAllGoals` which reads the entire goals file. The `parseDurationToMs` function only supports simple durations (`1h`, `30m`), not ISO 8601 durations (`PT1H`) as used in the tests (lines 32, 89). This is a latent bug: the test uses `PT1H` but `parseDurationToMs` will return the fallback instead of parsing it.
- **Lines 163–168:** `persistHeartbeatState` writes without fsync. If the process crashes after a tick but before state is persisted, the next restart will re-execute the same tick, potentially causing duplicate side effects.

### `packages/headroom/src/roles.ts`
- **Lines 16–19, 21–81:** `isBlocking` and `keywordSignals` use static regex/token matching. The blocking list is hardcoded and cannot be configured per-campaign or per-role. `keywordSignals` splits on non-alphanumeric characters and does bidirectional substring matching, which produces false positives (e.g., "arch" matches "architecture").
- **Lines 83–169:** All `build*` functions return static arrays keyed by role. There is no actual model inference, no LLM call, and no dynamic analysis. The `runRoleAnalysis` function is a deterministic keyword matcher dressed up as AI role analysis. This is a significant gap from the architecture plan, which describes Headroom as "10–15 Glide agents with different personalities" (Architecture §1.2).
- **Lines 197–199:** `runRoleAnalysis` writes `role_analysis.json` with `writeFileSync` in the middle of the analysis loop. If the function is called concurrently from multiple processes, the file will be corrupted.

### `packages/headroom/src/converge.ts`
- **Lines 29–66:** `loadPlanItems` reads all `.md` files in a directory and extracts h1–h3 headings plus checklist items. This is not a structured plan format; it relies on markdown formatting conventions. If plan files are renamed or restructured, convergence assessment silently breaks.
- **Lines 73–125:** `scanCodebase` recursively collects `.ts` files and regex-matches export statements. It ignores `.js` output, ignores non-TS source files, and does not distinguish between public and private exports. The exported symbols list is unreliable for convergence checks.
- **Lines 145–210:** `assessConvergence` does keyword overlap matching between plan items and codebase inventory. A plan item like "role-based analysis" will match "headroom/src/roles.ts" only if "roles" appears in the inventory — it will miss the semantic connection and flag the item as missing.

### `packages/headroom/src/sqlite.d.ts`
- **Lines 1–14:** Declares `node:sqlite` module augmentation for `DatabaseSync` and `StatementSync`. This is a hand-written type stub that drifts from any actual SQLite implementation. The `prepare()` method returns a `StatementSync` but the interface does not include `bind()` or `columns()`, which real SQLite statements have. The declared module is never imported at runtime.

---

## 3. Architecture Plan Compliance

| Pattern | Requirement | Implementation | Gap |
|---------|-------------|----------------|-----|
| TypeScript strict mode | Strict types, no `any`, schema-first | Strict mode on; but heavy use of `Record<string, unknown>` and `JSON.parse` without Zod | MEDIUM: architecture mandates zod for all external data boundaries |
| Open-source first | Use existing libraries, don't reinvent | `zod` declared but unused; `nanoid` reimplemented inline | MEDIUM: violates "avoid reinventing the wheel" |
| Schema-first design | Zod validation for all parsed data | Zero Zod usage in headroom package | HIGH: headroom has 8+ `JSON.parse` sites with no validation |
| Crash-safe I/O | Atomic writes, fsync, rotation | One `datasync()` path in tracer; headroom has zero | HIGH: no crash-safe writes anywhere in headroom |
| Public API per package | Each package exposes a clear public surface | `index.ts` re-exports all internals including `heartbeat`, `goal-store`, `sqlite.d.ts` | MEDIUM: unstable internals are part of the public API |
| No global mutable singletons | Package-scoped lifecycle | `HeadroomRuntime` is class-based (good), but `snapshotId()` and `nanoid()` are module-level functions with no lifecycle | LOW: no singletons, but ID generation is global |
| Testing | 80% coverage, no code without tests | Tests exist for runtime, headroom, delta, goal-store, heartbeat, sqlite, mcp-headroom; `converge.ts` and `roles.ts` have no tests | MEDIUM: two source files untested |
| Token budget / session budget | Per-agent token limits | Not implemented in headroom | HIGH: architecture §3.4 mentions token budgets; headroom has no concept of tokens |
| Role-based analysis | 10–15 agents with personalities | `roles.ts` is a keyword matcher with static arrays | HIGH: not actual multi-agent analysis |

---

## 4. Prime-Agent Pattern Compliance

Architecture §3.2 says: *"Prime-Agent: context/session durability + process spawning + session budget."* ImplementationPlan.md phases 4–5 mark session durability as complete.

| Pattern | Requirement | Implementation | Gap |
|---------|-------------|----------------|-----|
| Session durability | Durable session state across restarts | JSONL history file with snapshots | MEDIUM: no compaction, no rotation, no integrity metadata |
| Context preservation | Every agent has durable context files | `runtime.ts` ensures campaign + snapshot files | MEDIUM: no schema validation, no fsync |
| Parent summary isolation | Parents see summaries only | Not applicable to headroom layer | OK |
| Process spawning | Deterministic child agent lifecycle | Not implemented in headroom | N/A |
| Session budget | Token/turn budget per agent | Not implemented | HIGH: missing |
| Agent handle identity | Stable, traceable IDs | `snapshotId` uses low-entropy `Date.now()+Math.random()` | MEDIUM: no ulid/nanoid |
| Replay/resume | Resume by handle/session | `rollback` exists but appends to history; no checkpoint/restart protocol | MEDIUM: append-only rollback grows history indefinitely |

---

## 5. Production-Grade Issues Summary

1. **No crash-safe writes:** Every file write in headroom uses `writeFileSync`/`appendFileSync` without fsync, atomic rename, or temp-file patterns. Data loss on crash is guaranteed, not unlikely.
2. **Fake SQLite abstraction:** `goal-store.ts` declares SQLite interfaces but implements JSON file I/O. This gives a false sense of durability and query semantics.
3. **No schema validation:** `zod` is a declared dependency but unused. All `JSON.parse` sites accept arbitrary shapes, making runtime corruption silently propagate.
4. **Naive drift detection:** `detectDrift` is case-insensitive substring matching. It will miss semantic drift and produce false positives on common words.
5. **Not actual multi-agent analysis:** `roles.ts` is a static keyword matcher, not the "10–15 agents with personalities" described in Architecture §1.2.
6. **Unbounded history growth:** `delta.ts` history file has no rotation, no max size, and no compaction. `loadLatestSnapshot` reads the entire file every time.
7. **Concurrent write races:** `goal-store.ts` read-modify-write patterns have no file locking. Concurrent `persistGoal` or `updateGoalStatus` calls will corrupt `goals.json`.
8. **Heartbeat crash behavior:** `persistHeartbeatState` lacks fsync; `loadHeartbeatState` lacks error recovery. A crash during a tick causes state loss and duplicate side effects on restart.
9. **ID generation non-compliance:** `snapshotId` uses `Date.now()+Math.random()` instead of `ulid`/`nanoid` specified in Architecture §6.3.
10. **API surface leaks internals:** `index.ts` re-exports `goal-store`, `heartbeat`, `sqlite.d.ts`, and `converge` — these are implementation details, not stable public API.
11. **Test gaps:** `converge.ts` and `roles.ts` have zero test coverage despite being core headroom logic. The coverage-gap analysis marks all headroom files as "missing" coverage targets.

---

## 6. Exact File:Line Change Recommendations

| File | Line(s) | Recommendation |
|------|---------|----------------|
| `headroom.ts` | 68–76 | Write artifacts first, then apply delta; or use temp-file + `renameSync` for each artifact with `fsync`. |
| `delta.ts` | 78–86, 100–104 | Add `fsync` after each append; implement rotation when history exceeds size threshold; add sequence markers for corruption recovery. |
| `delta.ts` | 88–98, 107–135 | Implement streaming read for `readHistoryLines`; add offset index for `loadLatestSnapshot`/`loadSnapshot` to avoid parsing entire file. |
| `goal-store.ts` | 14–64 | Remove fake `DatabaseLike`/`StatementLike` interfaces; either use real `better-sqlite3` or accept JSON file semantics with honest naming. |
| `goal-store.ts` | 83–205 | Add Zod schema validation for all `JSON.parse` output; implement file locking or atomic rename for concurrent writers. |
| `heartbeat.ts` | 111–118, 163–168 | Add Zod schema for heartbeat state; use `fsync` after `writeFileSync`; add try/catch with fallback recovery. |
| `heartbeat.ts` | 171–192 | Fix `parseDurationToMs` to support ISO 8601 durations (`PT1H`, `PT30M`) as used in tests and metadata. |
| `roles.ts` | 16–19, 171–179 | Add Zod schema for `RoleAnalysis`; validate output before writing `role_analysis.json`. |
| `roles.ts` | 181–202 | Add role-analysis tests; if actual LLM inference is intended, wire it in; otherwise document that this is a heuristic stub. |
| `converge.ts` | 29–66, 145–210 | Add dedicated tests for `loadPlanItems` and `assessConvergence`; document the keyword-matching limitation. |
| `runtime.ts` | 45–68, 91–114 | Add state verification after `init`; implement compaction for `applyDelta`/`rollback` rather than append-only history. |
| `index.ts` | 1–7 | Restrict public exports to `headroom.ts`, `delta.ts`, `runtime.ts`, and types. Move `goal-store`, `heartbeat`, `converge`, `sqlite.d.ts` to internal-only. |
| `headroom.ts` | 8–30 | Add Zod schema for `HeadroomInput` and `HeadroomResult`; source shared types from `@glide/core` instead of redefining `campaign` shape. |
| `mcp-server/src/tools/glide-headroom.ts` | 31–86 | Replace `typeof` checks with Zod validation at the MCP tool boundary. |
