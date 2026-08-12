# Production-Readiness Audit: Strategy Part 2
**Scope:** `packages/headroom`, `packages/executor`, `packages/plugin-api`, `plugins/example-plugin`, `packages/permissions`  
**Repo:** `/media/Storage/home-gfardad/Projects/Glide`  
**Date:** 2026-08-13  
**Sources:** Existing audits in `/media/Storage/home-gfardad/Projects/Glide/audits/`, direct source inspection on `main`.

---



## Executive Summary

These five packages contain the **highest-risk production gaps** in the Glide monorepo:
1. **Headroom** writes crash-unsafe, non-atomic artifacts and history with no `fsync`, no temp-file pattern, and no schema validation.
2. **Executor** relies on global mutable singletons that break multi-campaign isolation and exposes a syntactically invalid public API.
3. **Plugin-api** declares permissions, resource limits, and capability tokens, but **none are enforced** at runtime; composition merges untrusted manifests blindly.
4. **Example-plugin** is safer than its parent package (it checks path containment), but still trusts caller-supplied manifest identities and executes arbitrary `import()`.
5. **Permissions** defines a rich policy model, yet most checks are advisory and not wired into the runtime paths that actually touch filesystem, shell, or network.

Fix priority follows the order: **crash safety → isolation → enforcement → validation → cleanup**.

---



## 1. Crash Safety & Atomicity

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 1 | HIGH | headroom | `packages/headroom/src/headroom.ts:107-114` | `writeArtifact` uses bare `writeFileSync`; no temp-file + rename, no `fsync`. A kill between artifact writes leaves a half-baked campaign. | Use `atomicWriteFileSync` from `@glide/core/io` (already implemented at `packages/core/src/io/atomic-write.ts:9-41`) or add equivalent here. |
| 2 | HIGH | headroom | `packages/headroom/src/delta.ts:82-86,100-104` | `appendHistoryLine` and `writeSnapshot` append JSONL with raw `writeFileSync` and no `fsync`. | Reuse `atomicAppendFileSync` from `@glide/core/io` (`atomic-write.ts:48-80`). |
| 3 | HIGH | headroom | `packages/headroom/src/goal-store.ts:84-115` | `persistGoal`, `updateGoalStatus` are read-modify-write on `goals.json` with no file lock and no atomic rename. Concurrent writers clobber each other. | Adopt a real SQLite store or add file-level locking + atomic rename + `fsync`. |
| 4 | HIGH | headroom | `packages/headroom/src/heartbeat.ts:163-168` | `persistHeartbeatState` uses `writeFileSync` without `fsync`; crash during tick loses state and causes duplicate side effects on restart. | Wrap with `atomicWriteFileSync` + `fsyncPath`. |
| 5 | HIGH | executor | `packages/executor/src/session.ts:40-52` | `SessionEventWriter.write` delegates to `JsonlWriter.append` without `fsync` or atomic append. | Replace with `atomicAppendFileSync` or async equivalent. |
| 6 | MEDIUM | executor | `packages/executor/src/session.ts:95-101` | `clear` truncates by writing empty string; not crash-safe (partial write leaves corrupt log). | Use temp-file + rename via `atomicWriteFileSync`. |
| 7 | MEDIUM | plugin-api | `packages/plugin-api/src/session.ts:227-233` | `SessionStore.upsert` writes JSON records with raw `writeFileSync`; no atomic rename. | Use `atomicWriteFileSync`. |
| 8 | MEDIUM | plugin-api | `packages/plugin-api/src/durability.ts:43-46,107-111,124-129` | `persist`, `clear`, `readEvents`, `remove` use raw `writeFileSync`/`rmSync`/`readFileSync` with no durability guarantees. | Same atomic-write pattern; bound `readEvents` memory. |
| 9 | MEDIUM | permissions | `packages/permissions/src/permissions.ts:33-58` | `loadPolicy`, `requestPermission`, `approvePermission`, `rejectPermission` all write without atomic rename. | Use `atomicWriteFileSync` for every write. |
| 10 | LOW | core | `packages/core/src/io/atomic-write.ts:15,54` | Temp paths use `${filePath}.${process.pid}.${Date.now()}.tmp` with default umask; world-readable temp files expose secrets on shared hosts. | Create temp files with `0o600` permissions (e.g. `openSync(tempPath, "w", 0o600)`). |

**Priority action:** Replace every raw `writeFileSync`/`appendFileSync` on persisted state with the existing `atomicWriteFileSync` / `atomicAppendFileSync` helpers, then add `fsyncPath` on directory renames.

---



## 2. Atomicity & Concurrency

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 11 | HIGH | headroom | `packages/headroom/src/goal-store.ts:84-115` | `persistGoal` reads, mutates, and rewrites `goals.json` in one synchronous block with no file lock. | Add file locking (e.g. `proper-lockfile`) or switch to SQLite. |
| 12 | HIGH | headroom | `packages/headroom/src/delta.ts:107-135` | `loadLatestSnapshot` reads the **entire** history file into memory and parses every line; performance degrades linearly and a malformed line silently drops data. | Add an offset index or length-prefixed binary format; stream reads with a max-line bound. |
| 13 | MEDIUM | executor | `packages/executor/src/session.ts:100-133` | `rotateIfNeeded` is defined but **never called** from `write`. The 5 MB / 5-file rotation policy is dead code; logs grow unbounded. | Call `rotateIfNeeded` inside `write` before delegating to `JsonlWriter.append`. |
| 14 | MEDIUM | plugin-api | `packages/plugin-api/src/session.ts:62-76,159-161,199-201` | Silent `catch {}` around `JSON.parse` and `unlink` hides corruption and tampering. | Emit structured warnings or throw on malformed records. |

---



## 3. Permissions

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 15 | HIGH | plugin-api | `packages/plugin-api/src/registry.ts:17-38` | `register` ignores `descriptor.manifest?.permissions` unless `enforcePermissions` is true (defaults to `false`). | Default `enforcePermissions` to `true`; reject plugins that deny required capabilities. |
| 16 | HIGH | plugin-api | `packages/plugin-api/src/loader.ts:123-136` | `loadWithLoader` validates shape only; no permission gate before `loader.load`. | Add permission check after validation, before instantiation. |
| 17 | HIGH | permissions | `packages/permissions/src/gates.ts:88-258` | Gates are advisory and run manually (typecheck, lint, build). No runtime enforcement gates filesystem, shell, or network access. | Add runtime gates that wrap actual I/O calls and return `GateResult` before the operation proceeds. |
| 18 | MEDIUM | plugin-api | `packages/plugin-api/src/composition.ts:197-201` | `composeBundle` merges `instance.descriptor`, `reference.overrides`, and `mergedDefaults` with no permission downgrade check. | Validate merged descriptor against a strict schema; forbid downgrading `permissions` or `resourceLimits` via overrides/defaults. |
| 19 | MEDIUM | permissions | `packages/permissions/src/permissions.ts:91-107` | `checkPermission` is a pure function that never mutates state; callers can ignore its result. | Make the permission model stateful or enforce at every MCP tool boundary. |
| 20 | LOW | plugin-api | `packages/plugin-api/src/types.ts:13-14` | `PluginDescriptor.manifest` is deprecated but still present, allowing bypass of validated fields. | Remove the deprecated field or mark it fully internal in the next major version. |

---



## 4. Plugin Isolation

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 21 | HIGH | plugin-api | `packages/plugin-api/src/loader.ts:88-99,128-141` | `IPluginLoader.load` contract allows arbitrary code execution; `loadWithLoader` does not sandbox it. | Run plugin loaders in `worker_threads` or separate processes with dropped capabilities and limited env. |
| 22 | HIGH | example-plugin | `plugins/example-plugin/src/loader.ts:63` | `await import(modulePath)` runs arbitrary plugin code with full Node.js privileges. | Sandbox the loader process; validate the entrypoint module against an allowlist rooted at `pluginDir`. |
| 23 | MEDIUM | executor | `packages/executor/src/executor.ts:178-183` | `spawnAgent` passes `{ ...process.env, ...(options.env ?? {}) }`; full parent env leaks even when `options.env` is set. | Strip `process.env` by default; pass only whitelisted env vars. |
| 24 | MEDIUM | executor | `packages/executor/src/executor.ts:390-402` | `defaultExecutor` is a module-level singleton. Two campaigns in the same process share one registry and cannot be independently managed. | Export `ExecutorRuntime` only; consumers construct instances per campaign. |
| 25 | MEDIUM | executor | `packages/executor/src/session.ts:235-249` | `globalSessionEmitter` is a module-level singleton with the same isolation flaw. | Remove global instance; require explicit construction. |
| 26 | MEDIUM | plugin-api | `packages/plugin-api/src/session.ts:134-135` | `recordPath(handle)` joins `rootDir` + `handle` with no containment check; a `handle` of `../../etc` escapes. | Normalize with `path.resolve` and assert the resolved path starts with `rootDir`. |
| 27 | MEDIUM | plugin-api | `packages/plugin-api/src/durability.ts:30-31` | `filePath(pluginId)` joins `stateDir` + `pluginId`; crafted `pluginId` containing `../` escapes. | Same containment fix. |
| 28 | LOW | permissions | `packages/permissions/src/runtime.ts:35-36` | `createSubject` generates an ephemeral UUID with no signing, expiry, or delegation chain. | Use `CapabilityTokenService` from `packages/permissions/src/capability-tokens.ts` to issue signed, scoped tokens. |

---



## 5. Schema Validation & Type Safety

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 29 | HIGH | headroom | `packages/headroom/src/goal-store.ts:37-42,89-91,123-125,146,170,194,203,220,241` | Every `JSON.parse` casts to `Record<string, unknown>` or `GoalRecord` with no Zod schema validation. `zod` is declared but unused. | Add Zod schemas for `GoalRecord`, `GoalRecordSnapshot`, and all persisted shapes; validate after every parse. |
| 30 | HIGH | headroom | `packages/headroom/src/sqlite.d.ts:1-14` | Declares `node:sqlite` module augmentation as a fake stub; never imported at runtime. | Either depend on `better-sqlite3`/`node:sqlite` or remove the stub and rename the abstraction to `FileGoalStore`. |
| 31 | MEDIUM | headroom | `packages/headroom/src/heartbeat.ts:111-118` | `loadHeartbeatState` returns `JSON.parse(...)` with implicit `any`; corrupt JSON crashes the service. | Add Zod schema + try/catch with fallback recovery. |
| 32 | MEDIUM | executor | `packages/executor/src/contract.ts:69-101` | `validateAgentContract` is present but **not wired** into `ensureAgentContract`. | Call `validateAgentContract` at the end of `ensureAgentContract` and throw on invalid state. |
| 33 | MEDIUM | plugin-api | `packages/plugin-api/src/loader.ts:38-55` | `PluginDescriptorSchema` does not forbid unknown properties; extra fields slip through. | Use `.strict()` or explicit whitelist. |
| 34 | MEDIUM | permissions | `packages/permissions/src/gates.ts:66-86` | `readJsonIfExists` returns `unknown` but callers treat the result as typed objects without validation. | Validate returned JSON against expected Zod schemas before use. |
| 35 | LOW | executor | `packages/executor/src/executor.ts:280` | `awaitAgent` is missing the `async` keyword; this breaks the public API contract. | Add `async` before `awaitAgent`. |

---



## 6. Resource Limits & Budgets

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 36 | HIGH | executor | `packages/executor/src/runtime.ts:108-123` | `PERSONALITY.md` template has no `## Budget` or `## Model Tier` sections, violating Architecture §3.4. | Extend template and read back at spawn time. |
| 37 | MEDIUM | plugin-api | `packages/plugin-api/src/registry.ts:123-159` | `enforceResourceLimits` checks host `heapUsed`, not plugin memory; does not kill or throttle. | Spawn plugins in `worker_threads` with `resourceLimits` and `terminate()` on breach. |
| 38 | MEDIUM | plugin-api | `packages/plugin-api/src/durability.ts:43-46` | `persist` writes unbounded state with no size check against `resourceLimits`. | Bound state size before write; reject oversized payloads. |
| 39 | MEDIUM | executor | `packages/executor/src/executor.ts:66-83` | `SpawnAgentOptions` lacks `tokenBudget`, `roundLimit`, `modelTier`. | Add these fields and enforce them at the runtime boundary. |
| 40 | LOW | executor | `packages/executor/src/executor.ts:130` | `agentRegistry` is a flat `Map` with no cap; unlimited spawns leak memory. | Add a configurable max and reject when exceeded. |

---



## 7. Production-Grade Hygiene

| # | Severity | Package | File:Line | Finding | Fix |
|---|----------|---------|-----------|---------|-----|
| 41 | MEDIUM | executor | `packages/executor/src/index.ts:1-8` | `contract.ts` is not re-exported, hiding `validateAgentContract` from consumers. | Add `export * from "./contract.js";`. |
| 42 | MEDIUM | headroom | `packages/headroom/src/index.ts:1-7` | Re-exports `goal-store`, `heartbeat`, `converge`, `sqlite.d.ts` — internal modules leak as public API. | Restrict exports to `headroom.ts`, `delta.ts`, `runtime.ts`, and types. |
| 43 | MEDIUM | headroom | `packages/headroom/src/roles.ts:171-199` | `runRoleAnalysis` writes `role_analysis.json` with no schema validation and no concurrency guard. | Validate with Zod; add file lock or atomic write. |
| 44 | MEDIUM | headroom | `packages/headroom/src/converge.ts:29-66,145-210` | `loadPlanItems` and `assessConvergence` rely on naive regex keyword overlap. | Document limitation; add tests; consider semantic matching. |
| 45 | LOW | executor | `packages/executor/src/session.ts:118-120` | `replayAsStream` is identical to `replay`; misleading API surface. | Remove or differentiate. |
| 46 | LOW | executor | `packages/executor/src/contract.ts:24-42` | `createAgentContext` duplicates logic from `runtime.ts`. | Remove duplication; export the type from `runtime.ts`. |

---



## 8. Prioritized Action Plan

| Priority | Action | Packages | Rationale |
|----------|--------|----------|-----------|
| **P0** | Crash-safe every persisted write: adopt `atomicWriteFileSync` / `atomicAppendFileSync` + `fsyncPath` from `@glide/core/io`. | headroom, executor, plugin-api, permissions | Data loss on crash is the most user-visible failure mode. |
| **P0** | Remove global mutable singletons (`defaultExecutor`, `globalSessionEmitter`); enforce per-campaign instances. | executor | Multi-campaign isolation is an architecture requirement and currently broken. |
| **P0** | Add `async` to `awaitAgent` and fix the public API contract. | executor | Syntax error in public surface blocks consumers. |
| **P0** | Enforce manifest permissions at load/runtime: gate `register` and every MCP tool on declared capabilities. | plugin-api, permissions | Permissions are currently decorative. |
| **P0** | Sandbox plugin loading: validate `entrypoint.module` containment, run in `worker_threads` with dropped env. | plugin-api, example-plugin | Arbitrary code execution with full host privileges is unacceptable. |
| **P1** | Add Zod schemas for all `JSON.parse` boundaries: goals, snapshots, sessions, durability state, policies. | headroom, executor, plugin-api, permissions | Corrupt or tampered JSON silently propagates as typed data. |
| **P1** | Wire `validateAgentContract` into `ensureAgentContract`; export from `index.ts`. | executor | Validation exists but is dead code. |
| **P1** | Add token/session budget fields to `SpawnAgentOptions` and `PERSONALITY.md`. | executor | Architecture requirement; missing entirely. |
| **P1** | Add path containment checks to `SessionStore.recordPath` and `PrimeAgentSessionDurability.filePath`. | plugin-api | Path-traversal vulnerability in plugin/plugin-state paths. |
| **P1** | Validate composed descriptors strictly; disallow permission/resource-limit downgrade via `overrides`/`defaults`. | plugin-api | Bundle composition can poison child plugins. |
| **P1** | Fix `loadLatestSnapshot` memory blowup: add index or bounded stream; add sequence markers for corruption recovery. | headroom | Unbounded memory + silent corruption = production instability. |
| **P2** | Add file locking or atomic rename to `goal-store.ts` read-modify-write paths; consider real SQLite. | headroom | Concurrent writers corrupt `goals.json`. |
| **P2** | Replace `Date.now()+Math.random()` ID generation with `nanoid`/`crypto.randomUUID` per Architecture §6.3. | headroom, permissions | Low-entropy IDs collide and are not traceable. |
| **P2** | Call `rotateIfNeeded` inside `executor/src/session.ts:write`; bound JSONL memory in `readAll`. | executor | Logs grow unbounded and OOM on long-running systems. |
| **P2** | Harden `atomicAppendFileSync` temp files with `0o600` permissions. | core | Shared-host secret leakage via world-readable temp files. |
| **P2** | Introduce signed capability tokens for plugin/agent identity; wire into MCP tool handlers. | permissions, plugin-api | Unauthenticated UUID subjects are trivially spoofable. |
| **P3** | Restrict `packages/headroom/src/index.ts` public exports to stable modules only. | headroom | Internal modules are part of the public API surface. |
| **P3** | Add tests for `converge.ts`, `roles.ts`, `program.ts`, and contract validation wiring. | headroom, executor | Core logic untested; coverage gaps confirmed by existing gap analysis. |
| **P3** | Replace silent `catch {}` blocks with structured logging or typed `catch (error: unknown)`. | executor, plugin-api, headroom, permissions | Silent failures mask security-relevant incidents. |

---



## 9. Scoped Fixes by File (Quick Reference)

### `packages/headroom/src/headroom.ts`
- **Lines 107-114:** Replace `writeArtifact` with `atomicWriteFileSync`.
- **Lines 194-199:** Replace naive `detectDrift` substring matching with semantic assessment or document limitation.

### `packages/headroom/src/delta.ts`
- **Lines 82-86, 100-104:** Use `atomicAppendFileSync`; add `fsyncPath` on history directory after rename.
- **Lines 107-135:** Implement streaming read or offset index for `loadLatestSnapshot`/`loadSnapshot`; add sequence markers.

### `packages/headroom/src/goal-store.ts`
- **Lines 84-115, 161-182, 208-245:** Add Zod validation after every `JSON.parse`; replace read-modify-write with SQLite or locked atomic rename.

### `packages/headroom/src/heartbeat.ts`
- **Lines 111-118, 163-168:** Add Zod schema + `atomicWriteFileSync`; add error recovery on corrupt state.

### `packages/headroom/src/roles.ts`
- **Lines 171-199:** Validate `role_analysis.json` with Zod; add atomic write for concurrency safety.

### `packages/headroom/src/converge.ts`
- **Lines 29-66, 145-210:** Add tests; document that convergence is keyword-based, not semantic.

### `packages/executor/src/executor.ts`
- **Line 280:** Add `async` keyword.
- **Lines 390-402:** Remove `defaultExecutor`; export `ExecutorRuntime` only.
- **Lines 178-183:** Strip `process.env` by default.

### `packages/executor/src/session.ts`
- **Lines 40-52:** Use `atomicAppendFileSync`.
- **Lines 95-101:** Crash-safe `clear` via temp-file + rename.
- **Lines 100-133:** Call `rotateIfNeeded` in `write`.
- **Lines 235-249:** Remove `globalSessionEmitter` singleton.

### `packages/executor/src/contract.ts`
- **Lines 69-101, 126-133:** Wire `validateAgentContract` into `ensureAgentContract`; export from `index.ts`.

### `packages/plugin-api/src/registry.ts`
- **Lines 17-38:** Default `enforcePermissions` to `true`; reject on denied capabilities.

### `packages/plugin-api/src/loader.ts`
- **Lines 128-141:** Add permission gate after validation, before `loader.load`.

### `packages/plugin-api/src/composition.ts`
- **Lines 197-201:** Validate merged descriptor; forbid permission/resource-limit downgrade.

### `packages/plugin-api/src/session.ts`
- **Lines 134-135, 227-233:** Add path containment check; use `atomicWriteFileSync`.
- **Lines 62-76, 159-161, 199-201:** Replace silent `catch {}` with structured warnings.

### `packages/plugin-api/src/durability.ts`
- **Lines 30-31, 43-46, 107-111, 124-129:** Add path containment; use atomic writes; bound `readEvents` memory.

### `packages/plugin-api/src/types.ts`
- **Lines 13-14:** Deprecate/remove `manifest` field from `PluginDescriptor`.
- **Lines 38-55:** Add `.strict()` to `PluginDescriptorSchema`.

### `plugins/example-plugin/src/loader.ts`
- **Lines 63:** Sandbox `import()`; validate `modulePath` against `pluginDir` (already present at `:63-70`, but missing sandboxing).

### `packages/permissions/src/permissions.ts`
- **Lines 33-58, 61-89:** Use `atomicWriteFileSync` for all writes; validate parsed JSON with Zod.

### `packages/permissions/src/gates.ts`
- **Lines 88-258:** Add runtime enforcement gates; validate `readJsonIfExists` output with schemas.

### `packages/permissions/src/capability-tokens.ts`
- **Lines 45-155:** Wire `CapabilityTokenService` into `createSubject` and all MCP tool handlers.

### `packages/permissions/src/runtime.ts`
- **Lines 35-36:** Replace `randomUUID` subjects with signed capability tokens.

---



## 10. Compliance Matrix

| Requirement | Status | Primary Fix Location |
|-------------|--------|----------------------|
| Crash-safe writes (atomic + fsync) | **MISSING** in headroom, executor, plugin-api, permissions | `atomic-write.ts` + all write paths |
| Schema-first / Zod validation | **MISSING** in headroom, executor, plugin-api, permissions | Every `JSON.parse` boundary |
| Multi-campaign isolation | **BROKEN** in executor | `executor.ts`, `session.ts` |
| Permission enforcement at runtime | **MISSING** in plugin-api, permissions | `registry.ts`, `loader.ts`, `gates.ts` |
| Plugin sandboxing | **MISSING** in plugin-api, example-plugin | `loader.ts`, `composition.ts` |
| Capability tokens / identity | **PARTIAL** in permissions (types only) | `runtime.ts`, `capability-tokens.ts`, MCP tools |
| Resource limit enforcement | **MISSING** in plugin-api, executor | `registry.ts`, `executor.ts`, `durability.ts` |
| Path containment | **MISSING** in plugin-api | `session.ts`, `durability.ts` |
| Public API stability | **POOR** in headroom, executor | `index.ts` files |
| Test coverage for core logic | **GAP** in headroom, executor | `converge.ts`, `roles.ts`, `program.ts`, `contract.ts` |

---



## Recommended Execution Order

1. **Week 1 — Durability:** Replace all raw writes with `atomicWriteFileSync`/`atomicAppendFileSync`. Fix temp-file permissions in `atomic-write.ts`. Verify with power-loss simulation tests.
2. **Week 2 — Isolation:** Remove global singletons in executor; enforce per-campaign instances. Add path containment checks in plugin-api.
3. **Week 3 — Enforcement:** Wire permission gates into `registry.ts` and MCP tool boundaries. Make `enforcePermissions` default to `true`. Add worker-thread sandboxing for plugin loaders.
4. **Week 4 — Validation:** Add Zod schemas for all persisted JSON. Wire `validateAgentContract` into `ensureAgentContract`. Fix `PluginDescriptorSchema` to strict.
5. **Week 5 — Budgets & Tokens:** Add token/round budget fields to executor spawn options and `PERSONALITY.md`. Replace UUID subjects with signed capability tokens.
6. **Week 6 — Cleanup:** Restrict public exports, add missing tests, fix dead code (`rotateIfNeeded`, duplicate `createAgentContext`, misleading `replayAsStream`).
