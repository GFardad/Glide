# @glide/executor — Architecture vs Prime-Agent Audit

**Package:** `packages/executor`  
**Repo:** /media/Storage/home-gfardad/Projects/Glide  
**Reference docs:** `Plan/Architecture.md`, `Plan/ArchitectureReview-2026-08-11.md`, `Plan/ProductionReadiness-2026-08-11.md`, `Plan/ArchitectureVsCode.md`  
**Date:** 2026-08-11

## Executive Summary

- **Overall:** The executor package implements the **scaffolding** for Layer 3/4 execution: agent spawning, file contract, and program tree. However, it **deviates materially** from Prime-Agent durability/budget requirements and introduces **global mutable singletons** that break multi-campaign isolation. Several public APIs are unimplemented or stubbed.
- **Severity key:** HIGH | MEDIUM | LOW

---



## 1. Package Metadata

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Package name | `packages/executor` | `packages/executor` | ✅ Match |
| Purpose | اجرای تیم‌ها و ایجنت‌ها | Agent execution runtime + program tree | ✅ Match |
| TypeScript strict | Required | Inherited from `tsconfig.base.json` | ✅ Assumed |
| Tests required | Required | `test/executor.test.ts`, coverage tests present | ✅ Present |
| Dependencies | Public APIs only between packages | `@glide/core`, `@glide/plugin-api`, `@glide/permissions`, `@glide/tracer`, `zod` | ✅ Matches declared deps |

`package.json:12-17` declares workspace deps and `zod`, but `zod` is **unused** in the package source.

---



## 2. File-by-Line Findings

### 2.1 `src/executor.ts` — Process Spawning & Runtime

#### HIGH — Global mutable singleton breaks multi-campaign isolation
`src/executor.ts:390-402` exports `defaultExecutor` and convenience wrappers (`spawnAgent`, `cancelAgent`, `awaitAgent`) that delegate to it.  
**Gap:** Architecture §6.4 requires package-scoped lifecycle and isolation; Prime-Agent pattern requires **per-campaign session isolation**. A global singleton means two campaigns in the same process share the same registry (`agentRegistry`) and cannot be independently managed or garbage-collected.

**Fix:** Export `ExecutorRuntime` only; remove module-level singleton. Consumers construct instances per campaign.

#### HIGH — `awaitAgent` missing `async` keyword
`src/executor.ts:280` declares:
```ts
awaitAgent(handle: AgentHandle, timeoutMs?: number): Promise<AgentResult> {
```
**Gap:** Missing `async` modifier. This is a **syntax/type error** that breaks the public API contract. It will fail TypeScript strict checks or behave unexpectedly if transpiled.

**Fix:** Add `async` before `awaitAgent`.

#### MEDIUM — No token / session budget enforcement
Architecture §3.4: *"بودجه هر ایجنت در PERSONALITY.md تعریف می‌شود"* and each session has a max dialogue round limit.  
`src/executor.ts:66-80` `SpawnAgentOptions` accepts `timeoutMs` (process lifetime) but there is **no** `tokenBudget`, `roundLimit`, or model-tier selection field.

**Fix:** Add budget fields to `SpawnAgentOptions` and enforce them at spawn/runtime boundaries.

#### MEDIUM — IPC path creation writes empty file without cleanup guarantee
`src/executor.ts:322-326` `createIpcPath` does `writeFileSync(path, "")` to create the file.  
`src/executor.ts:328-336` `removeIpcPath` unlinks it, but `ExecutorRuntime.spawnAgent` never calls `removeIpcPath` on agent completion.  
**Gap:** Leaks empty IPC files; violates durability/cleanup expectations.

**Fix:** Hook cleanup into the `close`/`error` event handlers in `ExecutorRuntime`.

#### MEDIUM — `resumeAgent` does not restore runtime state
`src/executor.ts:338-367` `resumeAgent` reconstructs an `AgentHandle` from session events but returns `null` for completed/failed sessions with no restart/replay mechanism.  
**Gap:** Prime-Agent durability requires **resume/restore**, not just read.

**Fix:** Provide a `restoreAgent` path that replays messages into the handle and resets status to `Pending` for restartable sessions.

#### LOW — `groundWithGraphify` swallows all errors
`src/executor.ts:120-123` empty catch block hides graphify failures silently.  
**Gap:** Operators cannot diagnose grounding failures.

**Fix:** Emit a warning event or log the error.

---



### 2.2 `src/session.ts` — Session Durability

#### HIGH — Global mutable singleton via `globalSessionEmitter`
`src/session.ts:285` exports `globalSessionEmitter = new SessionEventEmitter({ enabled: true })`.  
**Gap:** Same isolation issue as `executor.ts`. A global emitter cannot be reconfigured or scoped per campaign, and cannot be garbage-collected. Breaks multi-campaign durability.

**Fix:** Remove global instance; require explicit construction by the caller.

#### HIGH — JSONL writer not crash-safe
`src/session.ts:42-55` `SessionEventWriter.write` uses `JsonlWriter.append` without `fsync` or atomic write.  
`src/session.ts:87-93` `clear` truncates via `writeFileSync("", "utf8")`.  
**Gap:** Architecture §6.2 expects production-grade reliability; Prime-Agent durability requires **crash-safe session logs**. Power loss or kill -9 can corrupt the event stream.

**Fix:** Use atomic writes (temp file + rename) and fsync after append.

#### MEDIUM — Duplicate JSONL infrastructure with `tracer`
`src/session.ts` implements its own `JsonlWriter`, rotation, and read-back. `packages/tracer` also has a JSONL writer.  
**Gap:** ArchitectureVsCode.md §18 notes duplicated structure without consolidation. Two implementations drift apart.

**Fix:** Extract shared JSONL writer/rotator into `@glide/core` or a small internal utility package.

#### MEDIUM — `rotateIfNeeded` never invoked
`src/session.ts:100-133` defines `rotateIfNeeded` but `write` does not call it.  
**Gap:** The 5 MB / 5-file rotation policy is **dead code**. Logs will grow unbounded.

**Fix:** Call `await this.rotateIfNeeded()` inside `write` (or the public `write` entrypoint).

#### MEDIUM — `SessionStore` is synchronous facade over async writer
`src/session.ts:164-197` `SessionStore.upsert` is `async` but delegates to `SessionEventWriter.write`, which is synchronous.  
**Gap:** Inconsistent async/sync boundary. Under load, file writes block the event loop despite the async API.

**Fix:** Make `SessionEventWriter.write` async and use `fs.promises`.

#### LOW — `SessionReplayHelper.replayAsStream` is identical to `replay`
`src/session.ts:150-153` both methods do the same thing.  
**Gap:** Misleading API surface.

---



### 2.3 `src/program.ts` — Program Tree (Layer 2)

#### MATCH — Summary-only parent views implemented
`src/program.ts:379-410` `summarizeProgram` correctly builds `ProgramSummary` where epic sees only team summaries and teams see only agent summaries.  
**Gap:** None. This matches Architecture §1.3 / §5.4.

#### MEDIUM — Tree depends on fragile markdown artifact parsing
`src/program.ts:143-178` `loadTodoRegistry` parses `todo_registry.md` with regex `/^\s*-\s*\[([ xX])\]\s*([^:]+):\s*(.+)\s*$/`.  
**Gap:** Any deviation in markdown formatting breaks the tree silently. Architecture expects deterministic decomposition from headroom artifacts, but there is no schema validation.

**Fix:** Validate parsed structure with `zod` and fail loudly on malformed input.

#### MEDIUM — `role_analysis.json` not schema-validated
`src/program.ts:180-196` `loadRoleAnalysis` does `JSON.parse` with no schema check.  
**Gap:** A malformed role analysis returns `{}` silently, producing an empty or incomplete program tree.

**Fix:** Validate against `RoleAnalysis` type with `zod`.

#### LOW — Round-robin agent distribution ignores team capacity
`src/program.ts:278-285` distributes explicit agent names round-robin across `orderedRoles`. If there are more roles than agents, some teams get zero agents; if fewer roles than agents, some teams get multiple agents.  
**Gap:** No capacity balancing or explicit assignment contract.

---



### 2.4 `src/runtime.ts` — Agent File Contract

#### MATCH — Five required files implemented
`src/runtime.ts:8-14` `REQUIRED_AGENT_FILES` matches Architecture §1.3 / §6.1 exactly: `PERSONALITY.md`, `GOAL.md`, `NOTES.md`, `TODO.md`, `REJECTED.md`.

#### MEDIUM — No token budget metadata in contract files
Architecture §3.4: *"بودجه هر ایجنت در PERSONALITY.md تعریف می‌شود"*.  
`src/runtime.ts:108-123` `defaultFileContent` for `PERSONALITY.md` does **not** include any token budget, model tier, or round-limit fields.

**Fix:** Extend `PERSONALITY.md` template with `## Budget` and `## Model Tier` sections.

#### MEDIUM — `ensureAgentContract` does not validate non-empty content
`src/runtime.ts:42-68` only checks file existence. A zero-byte `TODO.md` or missing Objective section in `GOAL.md` passes as valid.  
`src/contract.ts:68-100` `validateAgentContract` checks for section presence, but the two modules are **not wired together** — `ensureAgentContract` never calls `validateAgentContract`.

**Fix:** Call `validateAgentContract` at the end of `ensureAgentContract` and throw/report on invalid state.

#### LOW — `loadAgentContract` returns raw strings, not parsed structure
`src/runtime.ts:70-90` returns full file contents as strings. Consumers must parse markdown themselves.  
**Gap:** Prime-Agent pattern prefers structured context.

---



### 2.5 `src/contract.ts` — Contract Validation

#### MEDIUM — Validation is present but unused
`src/contract.ts:68-100` `validateAgentContract` checks section presence.  
`src/contract.ts:125-133` `loadAgentDirectory` reads files.  
**Gap:** Neither is exported from `src/index.ts` (`src/index.ts:1-8`), and `src/runtime.ts` does not import them.

**Fix:** Re-export from `index.ts` and wire into `ensureAgentContract`.

#### LOW — `createAgentContext` duplicate of `src/runtime.ts`
`src/contract.ts:24-42` `createAgentContext` duplicates the `AgentContext` constructor logic from `src/runtime.ts`.  
**Gap:** Two ways to create the same type; risk of drift.

**Fix:** Remove duplication; export the `AgentContext` type from `runtime.ts` and use it directly.

---



### 2.6 `src/index.ts` — Public API Surface

`src/index.ts` re-exports all modules but omits `contract.ts`.  
**Gap:** `validateAgentContract`, `REQUIRED_AGENT_FILES`, `generateAgentContract`, and `loadAgentDirectory` are hidden from consumers.

**Fix:** Add `export * from "./contract.js";`.

---



### 2.7 `src/agent-handle.ts`, `src/agent-message.ts`, `src/agent-status.ts`

- These are correct minimal type definitions. No gaps.

---



### 2.8 Tests

#### MEDIUM — No tests for `program.ts`
`test/executor.test.ts` and `test/coverage-executor*.test.ts` cover spawning, IPC, and session events, but **not** `buildProgramTree`, `summarizeProgram`, or `loadTodoRegistry`.

**Fix:** Add unit tests for tree construction, summary isolation, and malformed artifact handling.

#### MEDIUM — No tests for contract validation wiring
There are no tests that verify `ensureAgentContract` produces valid contracts or that `validateAgentContract` catches incomplete files.

**Fix:** Add tests for the validate-then-create flow.

---



## 3. Prime-Agent Pattern Compliance

| Pattern | Required | Implemented | Gap |
|---------|----------|-------------|-----|
| **Process spawning** | Controlled child process lifecycle | `ExecutorRuntime.spawnAgent` | ✅ |
| **Session durability** | Persist/restore/resume sessions | `SessionStore`, `resumeAgent` scaffold | ⚠️ Scaffolding only; no checkpoint/restart protocol |
| **Parent summary only** | Parents see summaries, not details | `summarizeProgram` | ✅ |
| **Token/session budget** | Budget in PERSONALITY.md; round limits | Not in spawn options or personality template | ❌ Missing |
| **Context grounding** | Pre-spawn context injection | `groundWithGraphify` | ⚠️ Best-effort only; no failure handling |
| **Durable session logs** | Crash-safe append/rotation | JSONL writer, but no fsync/atomic writes | ❌ Unsafe |
| **Multi-campaign isolation** | Independent runtime per campaign | Global singletons | ❌ Broken |
| **Deterministic IDs** | ULID/nanoid for session/agent IDs | `crypto.randomUUID` or `Date.now`+`Math.random` | ⚠️ Diverges from Architecture §6.3 |

---



## 4. Prioritized Fixes

| # | Severity | File | Issue | Recommendation |
|---|----------|------|-------|----------------|
| 1 | HIGH | `src/executor.ts:280` | `awaitAgent` missing `async` | Add `async` keyword immediately |
| 2 | HIGH | `src/executor.ts:390` | Global `defaultExecutor` singleton | Remove singleton; export `ExecutorRuntime` only |
| 3 | HIGH | `src/session.ts:285` | Global `globalSessionEmitter` singleton | Remove global instance |
| 4 | HIGH | `src/session.ts:42` | Crash-unsafe JSONL writes | Add atomic writes + fsync |
| 5 | HIGH | `src/runtime.ts` | No token budget in contract | Add `## Budget` / `## Model Tier` sections to `PERSONALITY.md` |
| 6 | HIGH | `src/executor.ts:66` | No session budget fields | Add `tokenBudget`, `roundLimit`, `modelTier` to `SpawnAgentOptions` |
| 7 | MEDIUM | `src/index.ts` | `contract.ts` not exported | Add `export * from "./contract.js"` |
| 8 | MEDIUM | `src/runtime.ts` + `src/contract.ts` | Validation not wired into `ensureAgentContract` | Call `validateAgentContract` after creation |
| 9 | MEDIUM | `src/executor.ts:322` | IPC files leaked on agent close | Cleanup in `close`/`error` handlers |
| 10 | MEDIUM | `src/executor.ts:338` | `resumeAgent` does not restore state | Implement restartable replay |
| 11 | MEDIUM | `src/session.ts:100` | `rotateIfNeeded` never called | Call in `write` path |
| 12 | MEDIUM | `src/program.ts:143` | Fragile markdown parsing | Add `zod` schema validation |
| 13 | MEDIUM | `test/` | Missing `program.ts` and contract validation tests | Add unit tests |
| 14 | MEDIUM | `src/session.ts`, `packages/tracer` | Duplicate JSONL infrastructure | Extract shared writer to core |
| 15 | LOW | `src/session.ts:150` | `replayAsStream` identical to `replay` | Remove or differentiate |
| 16 | LOW | `package.json:17` | `zod` declared but unused | Use for artifact parsing or remove dep |
| 17 | LOW | `src/contract.ts:24` | Duplicate `createAgentContext` | Remove; import from `runtime.ts` |

---



## 5. Architecture Divergences vs Codebase Audit

| Doc Reference | Code | Issue |
|---------------|------|-------|
| `Architecture.md:209` — executor manages teams/agents | `src/executor.ts` spawns processes only; team management lives in `program.ts` | Split responsibility is okay, but `executor.ts` does not orchestrate teams |
| `Architecture.md:142` — budget in `PERSONALITY.md` | `src/runtime.ts:108` PERSONALITY template has no budget | Missing |
| `Architecture.md:143` — parent sees only summary | `src/program.ts:379` ✅ implemented | Match |
| `ArchitectureReview-2026-08-11.md:2.1` — global mutable singletons | `src/executor.ts:390`, `src/session.ts:285` | Confirmed |
| `ArchitectureReview-2026-08-11.md:2.2` — cross-package fs coupling | `src/contract.ts`, `src/runtime.ts` use direct `node:fs` | Confirmed; no public API boundary |
| `ProductionReadiness-2026-08-11.md:8` — module-level mutable singletons | Same files | Confirmed |
| `ProductionReadiness-2026-08-11.md:9` — appendFileSync not crash-safe | `src/session.ts:42` uses `JsonlWriter.append` without fsync | Confirmed |

---



## 6. Conclusion

The executor package provides a **functional but brittle foundation**. Spawning, basic session logging, and the program tree are in place, but **Prime-Agent durability is superficial** (no crash-safe logs, no real resume protocol, global singletons). **Session/token budgets are absent**, and **validation is disconnected** from contract creation.

The highest-risk issues are the **global singletons** and **unsafe JSONL writes**, which directly contradict the architecture’s multi-campaign isolation and production-grade durability requirements.

**Recommended order:**
1. Remove global singletons and enforce per-campaign instances.
2. Make JSONL writes atomic and fsync-safe.
3. Wire contract validation into `ensureAgentContract`.
4. Add token/session budget fields and enforce them at runtime.
5. Add missing tests for `program.ts` and contract validation.
6. Extract shared JSONL/rotation utilities to eliminate duplication.
