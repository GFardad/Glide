# @glide/executor — Architecture vs Prime-Agent Audit
**Audit scope:** `packages/executor/src/**/*.ts`  
**Reference docs:** `Plan/Architecture.md`, `Plan/ImplementationPlan.md`, `Plan/TechnicalSpec.md`, `Plan/ArchitectureReview-2026-08-11.md`, `Plan/ProductionReadiness-2026-08-11.md`  
**Date:** 2026-08-11

---
## 1. Global Findings (cross-file)
| Severity | File | Line(s) | Finding |
|----------|------|---------|---------|
| HIGH | `session.ts` | 138–203 | `globalSessionEmitter` is a module-level singleton built from `process.env` at import time with no init/close/reset lifecycle. This breaks multi-campaign isolation, prevents testability, and contradicts the doc rule “no global mutable singletons.” |
| HIGH | `executor.ts` | 48, 186 | `agentRegistry` is a module-scoped `Map` without lifecycle management or bounded eviction. Long-running MCP sessions leak agent records across campaigns. |
| HIGH | `executor.ts` | 9–10 | IDs use `Date.now()` + `Math.random()`; architecture explicitly lists `ulid` / `nanoid` for session/agent IDs. |
| HIGH | `runtime.ts` | 1–9, 42–67 | All file I/O is synchronous (`readFileSync`/`writeFileSync`/`mkdirSync`). There is no crash-safe write path, no fsync, no atomic replace, and no async boundary. This is not production-grade for durability. |
| MEDIUM | `executor.ts` | 88–93 | Child spawn inherits full `process.env`. Architecture says “Open-source first … avoid reinventing”; there is no explicit environment sanitization for spawned agents. |
| MEDIUM | `executor.ts` | 127–129, 141–147, 149–154, 156–161, 178–183 | Session emission uses try/catch swallowing everywhere; if logging fails, lifecycle transitions are lost silently. No fallback telemetry or metric is emitted. |
| MEDIUM | `executor.ts` | 98–113 | `stdout` and `stderr` are parsed with the same `AgentMessage` schema, so child stderr can be injected as protocol messages and never reaches an operator as structured stderr. |
| MEDIUM | `runtime.ts` | 56–64 | `ensureAgentContract` seed templates use `TBD`/placeholder content by default. There is no schema validation for the created contract files. |
| MEDIUM | `program.ts` | 143–177 | `loadTodoRegistry` uses hand-rolled markdown parsing with regex and no Zod/schema validation despite architecture listing `zod` as a core validation stack. |
| LOW | `executor.ts` | 209–234 | `awaitAgent` polls with `setTimeout(check, 50)`. This is unbounded CPU-friendly but has no timeout/abort and will never reject if the child never transitions. |

---
## 2. File-by-File Findings
### `packages/executor/src/index.ts`
- **Lines 1–8:** Re-exports compiled `.js` paths; matches current build output, no issue.

### `packages/executor/src/agent-status.ts`
- **Lines 1–9:** Status enum is correct and type-safe. No issues.

### `packages/executor/src/agent-message.ts`
- **Lines 1–6:** Message shape matches expected protocol. No issues.

### `packages/executor/src/agent-handle.ts`
- **Lines 4–23:** Handle is a clean value object. No issues.

### `packages/executor/src/executor.ts`
- **Lines 9–10:** `randomId()` uses `Date.now()` + `Math.random()` instead of `ulid`/`nanoid` specified in Architecture §6.3.
- **Lines 17–46:** `parseLines` only accepts JSON lines; if a child emits markdown/logs, they are silently dropped from protocol history.
- **Line 48:** `agentRegistry` is a global mutable singleton; no bounded cleanup or shutdown hook.
- **Lines 74–88:** `spawnAgent` does not set `uid`/`gid` or sanitize env; child inherits parent environment.
- **Lines 98–113:** `stderr` is replayed as `AgentMessage` records, conflating protocol and diagnostic output.
- **Lines 116–184:** Session emission swallows all errors; if `globalSessionEmitter` throws, agent lifecycle is incomplete but status still advances.
- **Lines 190–206:** `cancelAgent` uses SIGTERM + SIGKILL timeout; missing `windowsHide` and `detached` options for robust cross-platform cleanup.
- **Lines 208–234:** `awaitAgent` has no timeout/abort; callers have no way to bound wait.

### `packages/executor/src/session.ts`
- **Lines 27–67:** `SessionEventWriter.write/readAll` is synchronous append + full-file read; no streaming, no rotation, no compaction.
- **Lines 39–41:** `appendFileSync` has no fsync equivalent; not crash-safe on power loss.
- **Lines 43–58:** `readAll` loads the entire JSONL into memory; performance scales linearly with session history.
- **Lines 73–86:** `SessionReplayHelper` is a thin wrapper with no streaming, pagination, or backpressure.
- **Lines 97–130:** `SessionStore` uses JSONL as a key-value store; no indexing by handle/session, no concurrency control, no locking.
- **Lines 138–196:** `SessionEventEmitter` introduces an async boundary but still delegates to sync writer; mixed sync/async contract is misleading.
- **Lines 198–203:** `globalSessionEmitter` construction from `process.env` at import time is a hard global singleton.

### `packages/executor/src/runtime.ts`
- **Lines 1–9:** Synchronous `node:fs` dependency dominates the API; no async/streaming alternatives.
- **Lines 42–67:** `ensureAgentContract` creates files with placeholder content; no validation of created artifacts.
- **Lines 70–90:** `loadAgentContract` reads full files into memory and splits into arrays; not suitable for large notes.
- **Lines 92–136:** `appendNote`, `markTodoDone`, `recordRejection` all use read-modify-write without locks; concurrent writers will clobber each other.
- **Lines 138–145:** `listAgents` uses `existsSync` on `GOAL.md`; this is brittle if file names change and ignores agent directory metadata.

### `packages/executor/src/contract.ts`
- **Lines 22–26:** `hasExpectedSection` is case-insensitive substring matching; a file can contain `## Objective` in a footnote and still pass.
- **Lines 36–69:** `validateAgentContract` validates presence and section markers only; no semantic validation of content length, tokens, or schema.
- **Lines 28–34:** `generateAgentContract` calls `ensureAgentContract` then immediately `loadAgentContract`; if creation partially fails, this throws without recovery path.

### `packages/executor/src/program.ts`
- **Lines 23–133:** Tree interfaces (`ProgramEpic/Team/Agent`) and summary views are well-structured and match the “parent sees only summaries” rule. No issues here.
- **Lines 143–177:** `loadTodoRegistry` uses hand-rolled markdown parsing. The architecture mandates `zod` schema-first design; this file ignores it.
- **Lines 180–196:** `loadRoleAnalysis` uses `JSON.parse` with no Zod schema; malformed role analysis becomes `{}` silently.
- **Lines 234–241:** `slugify` is deterministic and safe. No issues.
- **Lines 243–372:** `buildProgramTree` implements Epic → Team → Agent decomposition, summary enforcement, and markdown rendering; this matches Architecture §1.2–1.4 and the plan. Minor issue: if `campaignDir` is missing, `loadTodoRegistry` and `loadRoleAnalysis` return empty defaults, producing a degenerate tree without warning.
- **Lines 379–474:** `summarizeProgram` and `renderProgramMarkdown` correctly enforce parent-only summaries.

---
## 3. Prime-Agent Pattern Compliance
Architecture §3.2 says: *“Prime-Agent: context/session durability + process spawning + session budget.”* ImplementationPlan.md phases 4–5 mark session durability as complete.

| Pattern | Requirement | Implementation | Gap |
|---------|-------------|----------------|-----|
| Session durability | Durable session state across restarts | `SessionEventWriter` JSONL only; no compaction/backup | LOW: no rotation/restore protocol; data loss on crash |
| Context preservation | Every agent has durable context files | `runtime.ts` ensures 5 files | MEDIUM: placeholder content, no schema validation |
| Parent summary isolation | Parents see summaries only | `program.ts` enforces summary views | OK |
| Process spawning | Deterministic child agent lifecycle | `executor.ts` spawn + lifecycle transitions | MEDIUM: no env sanitization, stderr conflated with stdout |
| Session budget | Token/turn budget per agent | Not implemented in executor | HIGH: missing; only message array exists |
| Agent handle identity | Stable, traceable IDs | Handles exist but IDs are non-standard | HIGH: no ulid/nanoid; no git blame linkage |
| Replay/resume | Resume by handle/session | `SessionReplayHelper` exists but read-only, no resume | MEDIUM: no checkpoint/restart protocol |

---
## 4. Production-Grade Issues Summary
1. **Non-production-grade I/O:** All executor/runtime file operations are synchronous, non-atomic, and non-crash-safe. A production executor needs async, atomic write patterns, fsync strategy, and rotation.
2. **Global mutable singletons:** `agentRegistry` and `globalSessionEmitter` prevent multi-campaign operation and make testing unreliable.
3. **Missing Prime-Agent depth:** Session durability is scaffolding-only; there is no resume/checkpoint protocol, no token budget, and no structured trace-to-code-line integration (`simple-git` not used in executor).
4. **Security/correctness gaps:** stderr is parsed as protocol messages, env is inherited blindly, JSON parsing has no schema validation, and contract validation uses substring matching.
5. **Testing:** `packages/executor/test/executor.test.ts` fails to run under vitest because it uses global `describe`/`it` without a globals config or import from `vitest`; this indicates executor tests are currently broken in CI.

---
## 5. Exact File:Line Change Recommendations
| File | Line(s) | Recommendation |
|------|---------|----------------|
| `executor.ts` | 9–10 | Replace `randomId()` with `nanoid`/`ulid` per Architecture §6.3. |
| `executor.ts` | 48, 186 | Replace `agentRegistry` with a class that supports init/shutdown/reset and bounded cleanup. |
| `executor.ts` | 88–93 | Sanitize `env` for spawned processes; drop secrets unless explicitly whitelisted. |
| `executor.ts` | 98–113 | Keep `stderr` as diagnostics only; do not parse stderr as `AgentMessage`. |
| `executor.ts` | 127–184 | Fail loudly on session emission errors; add a fallback operator-visible logger. |
| `executor.ts` | 208–234 | Add timeout/abort to `awaitAgent`; expose cancellation token. |
| `session.ts` | 138–203 | Remove `globalSessionEmitter`; inject `SessionEventEmitter` into runtime APIs. |
| `session.ts` | 39–41, 43–58 | Add async write with atomic temp-rename; add streaming read and rotation. |
| `runtime.ts` | 1–9, 42–136 | Add async variants for all file ops; add file locking or atomic replace for concurrent writers. |
| `runtime.ts` | 56–64 | Add schema validation for generated contract files; fail if placeholders remain. |
| `contract.ts` | 22–26, 36–69 | Replace substring checks with Zod schema validation of required sections and content. |
| `program.ts` | 143–177, 180–196 | Validate `todo_registry.md` and `role_analysis.json` with Zod; surface parse errors instead of silent fallback. |
