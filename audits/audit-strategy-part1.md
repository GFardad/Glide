# Glide Production-Readiness Audit — Strategy Part 1
**Packages:** `packages/cli`, `packages/core`, `packages/dashboard`, `packages/tracer`, `packages/mcp-server`
**Date:** 2026-08-13
**Sources:** `audits/audit-cli.md`, `audit/audit-core.md`, `audit/audit-dashboard.md`, `audit/audit-tracer.md`, `audits/audit-mcp.md`, `audits/audit-security.md`, `audits/audit-dura.md`, `audits/audit-types.md`, `audits/audit-perf.md`, `audits/audit-errors.md`

---

## 1. Executive Summary

These five packages are **not production-grade as a combined surface**. Functional gaps are well-documented in existing audits, but the cross-package risk is the real blocker:

- `cli` + `mcp-server` form the **ingress plane** (user input → filesystem / processes). They carry the highest concentration of protocol, security, and durability defects.
- `core` provides **security primitives and atomic I/O**, yet its own loaders/writers bypass those primitives.
- `dashboard` renders **unescaped user-derived data into HTML/JS**.
- `tracer` bypasses `core`, ships dead dependencies, and lacks git integration required by the architecture.

The fixes below are ordered by blast radius: protocol/security first, then durability, then performance/type safety.

---

## 2. Cross-Cutting Findings

| # | Theme | Severity | Evidence |
|---|-------|----------|----------|
| C1 | `cli` spawns a fresh MCP server per invocation; no persistent transport, no reconnect, no streaming. | HIGH | `packages/cli/src/cli.ts:427-442` |
| C2 | `mcp-server` manual stdio server violates MCP lifecycle: no `notifications/initialized`, responses to notifications, unhandled timeout race. | HIGH | `packages/mcp-server/src/server.ts:123, 203-210, 238-246, 251-253` |
| C3 | `core` security primitives (`PathGuard`, `atomicWriteFileSync`) exist but are **not used** by core loaders/writers or by executor/MCP artifact tools. | HIGH | `packages/core/src/campaign/index.ts:1-4, 25-34`; `packages/core/src/constitution.ts:97-115, 122-128` |
| C4 | `dashboard` embeds unescaped campaign JSON into HTML and inline `<script>` blocks. | HIGH | `packages/dashboard/src/generator.ts:211-228`; `packages/dashboard/src/live.ts:359-381` |
| C5 | `tracer` bypasses `@glide/core`, reads filesystem directly, and ships dead deps (`simple-git`, `zod`, `@glide/core`). | HIGH | `packages/tracer/src/tracer.ts:1-2`; `packages/tracer/package.json:13-15` |

---

## 3. Package Findings

### 3.1 `packages/cli`
- **Per-invocation spawn lifecycle** (`packages/cli/src/cli.ts:427-442`): Every tool call spawns `node packages/mcp-server/dist/index.js`, sends `initialize`, one `tools/call`, then `SIGTERM`. This is the dominant latency and fragility source.
- **Hand-rolled JSON-RPC** (`packages/cli/src/cli.ts:350-424`): No reconnect, no backpressure handling (`packages/cli/src/cli.ts:414-416`), drops post-settlement notifications.
- **Custom argv parser** (`packages/cli/src/cli.ts:283-311`): No unknown-option rejection, no typed flags, no required enforcement.
- **Hard-coded server path resolution** (`packages/cli/src/cli.ts:314-326`): Brittle for global installs.
- **Stderr bleed** (`packages/cli/src/cli.ts:429`): Child stderr inherited, mixing tool diagnostics with CLI output.

### 3.2 `packages/core`
- **Non-atomic writers** (`packages/core/src/campaign/index.ts:25-34`): Four sequential `writeFileSync` calls during `createCampaign`. No temp-file rename, no fsync.
- **Raw JSON.parse without Zod** (`packages/core/src/campaign/index.ts:43-51`; `packages/core/src/constitution.ts:107-115`): `Date` fields typed as `Date` but deserialized as `string`.
- **ID generation drift** (`packages/core/src/campaign/index.ts:60-62`; `packages/core/src/constitution.ts:229-248`): Uses `Date.now()` + `Math.random()` despite `ids.ts` exporting `nanoid` generators.
- **Barrel re-exports with `.js` extensions** (`packages/core/src/index.ts:1-12`): Non-standard in TS source tree.
- **`GlideError` ignores `cause`** (`packages/core/src/errors/index.ts:1-10`): Modern `Error.cause` not forwarded.
- **`agent-fs` writes placeholders without validation** (`packages/core/src/fs/agent-fs.ts:125-152`): `GOAL.md` defaults to `TBD`; no runtime check prevents agents from running with unset goals.
- **Path guard exists but isn’t applied** by runtime/contract modules that touch the filesystem.

### 3.3 `packages/dashboard`
- **XSS via unescaped HTML embedding** (`packages/dashboard/src/generator.ts:211-228`): Campaign `goal` and fields injected via template literal.
- **Partial JSON-in-script escaping** (`packages/dashboard/src/live.ts:359-381`): Only `<` escaped; quotes/backslashes can breakout of inline `<script>` context.
- **Unvalidated `JSON.parse`** (`packages/dashboard/src/generator.ts:41-54`): No schema validation; malformed campaign JSON crashes rendering.
- **Silent error suppression** (`packages/dashboard/src/live.ts:135-152`): Empty `catch` blocks hide malformed sessions from operators.
- **Meta-refresh busy-polling** (`packages/dashboard/src/live.ts:373`): Full page reload every 5s; no pause/resume or `prefers-reduced-motion` respect.
- **No CSP / no ARIA landmarks / unverified contrast** (`packages/dashboard/src/generator.ts:114-127, 212-228`; `packages/dashboard/src/live.ts:200-213, 369`).

### 3.4 `packages/tracer`
- **Direct filesystem access bypassing core** (`packages/tracer/src/tracer.ts:1-2, 53-105`): Reads `GOAL.md`, `NOTES.md`, `TODO.md`, `PERSONALITY.md` via sync/async FS calls with no path guard.
- **Dead dependencies** (`packages/tracer/package.json:13-15`): `@glide/core`, `simple-git`, `zod` declared but unused.
- **No git integration** (`packages/tracer/src/tracer.ts:53-105`): Architecture §2.2 requires git blame mapping; `simple-git` is not wired.
- **In-memory volatile trace store** (`packages/tracer/src/tracer.ts:6-9`): `TRACE_STORE` lost on crash; no persistence.
- **Internal modules leaked via barrel** (`packages/tracer/src/index.ts:1-4`): `jsonl-writer`, `trace-runtime` re-exported to consumers.
- **`GraphifyClient` disconnected from `TracerRuntime`** (`packages/tracer/src/graphify.ts:41-275`): Knowledge-graph data never emitted as trace events.

### 3.5 `packages/mcp-server`
- **Protocol lifecycle violations** (`packages/mcp-server/src/server.ts:123, 251-253`): `notifications/initialized` never sent; `sendInitialized` is a no-op.
- **Responses written for notifications** (`packages/mcp-server/src/server.ts:238-246`): JSON-RPC 2.0 forbids this; `id` is `undefined` for notifications.
- **Unhandled timeout race** (`packages/mcp-server/src/server.ts:203-210`): `setTimeout` never cleared if tool finishes early.
- **File-write tools lack sandboxing** (`packages/mcp-server/src/tools/glide-plan.ts:66,83`; `glide-build.ts:49,70`; `glide-review.ts:51,69`; `glide-ship.ts:54,72`; `glide-test-tools.ts:49,67`; `glide-converge.ts:47,60-63`): `createPathGuard` imported but not applied to artifact writes.
- **Process exits without draining stdout** (`packages/mcp-server/src/server.ts:143,149,303-311`): SIGINT/SIGTERM call `process.exit(0)` immediately.
- **Dead SDK registration code** (`packages/mcp-server/src/server.ts:11-31`): `createGlideServer()` registers SDK handlers, but `main()` uses manual stdio loop.
- **`HostBridge` fabricates IDs on parse errors** (`packages/mcp-server/src/bridge/HostBridge.ts:104-108`): Should use `id: null` per JSON-RPC 2.0.
- **`HostRequest.id` excludes `null`** (`packages/mcp-server/src/bridge/types.ts:14-19`): Type does not match JSON-RPC 2.0 or server behavior.

---

## 4. Prioritized Action Plan

### P0 — Fix Before Production Exposure

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 1 | **Replace `cli` per-call spawn with persistent transport**: use `@modelcontextprotocol/sdk` `StdioClientTransport` or a persistent single-session spawn lifecycle. | cli + mcp-server | Large |
| 2 | **Fix MCP server lifecycle**: send `notifications/initialized`, suppress responses to notifications, clear timeout race, drain stdout before exit. | mcp-server | Medium |
| 3 | **Harden core writers**: replace `writeFileSync` with `atomicWriteFileSync` in `campaign/index.ts`, `constitution.ts`; import `generateCampaignId` / `generateAmendmentId` from `ids.ts`. | core | Medium |
| 4 | **Add Zod validation to core loaders**: replace raw `JSON.parse(...) as X` with schema `.parse()` in `campaign/index.ts`, `constitution.ts`, `campaign-fs.ts`. | core | Medium |
| 5 | **Apply path guards to all runtime filesystem boundaries**: executor runtime, MCP artifact tools, `glide-indepth`, `glide-converge`, `createIpcPath`. | core + executor + mcp-server | Medium |
| 6 | **Fix dashboard XSS**: escape HTML entities in `generator.ts:211-228`; serialize live data with `JSON.stringify` in `live.ts:359-381`. | dashboard | Small |

### P1 — Production Hardening

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 7 | **Centralize command registry in CLI**: single source of truth for commands, flags, help text, dispatch. | cli | Medium |
| 8 | **Strict argv parsing**: typed flags, required enforcement, unknown-option rejection. | cli | Medium |
| 9 | **Wire tracer into core and zod**: import `@glide/core` types, add input validation, remove dead deps. | tracer | Medium |
| 10 | **Implement git-blame integration**: wire `simple-git` into `traceAgent` per Architecture §2.2. | tracer | Medium |
| 11 | **Replace sync I/O in executor hot paths**: `appendNote`, `markTodoDone`, `recordRejection`, `loadAgentDirectory` use async or append-only JSONL. | executor | Large |
| 12 | **Unify trace/log roots**: standardize on `.glide-sessions`; document in tracer README. | tracer + core | Small |
| 13 | **Add async atomic I/O variants**: `atomicWriteFile`, `atomicAppendFile` in `core/src/io/atomic-write.ts`. | core | Medium |
| 14 | **Add missing Plan interfaces**: `AgentContext`, `ToolName`, `ToolCall`, `TodoItem`, `MeetingRoomOutput` in `core/src/types/index.ts`; re-export from barrel. | core | Medium |
| 15 | **Restrict tracer barrel exports**: do not re-export `jsonl-writer`, `trace-runtime`. | tracer | Small |
| 16 | **Replace `Record<string, unknown>` metadata** with typed `GoalMetadataSchema` in `core/src/schemas/index.ts` and `goal.ts`. | core | Small |
| 17 | **Forward `Error.cause` in `GlideError`** and add `InvalidCampaignError` / `InvalidConstitutionError`. | core | Small |
| 18 | **Add WCAG/CSP baseline to dashboard**: contrast audit, ARIA landmarks, skip links, CSP or external assets. | dashboard | Medium |

### P2 — Performance & Backpressure

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 19 | **Eliminate full-file read-modify-write for high-frequency paths**: use append-only JSONL + periodic rotation for notes/todos/rejected/goals. | executor + headroom + core | Large |
| 20 | **Add bounded rotation + error reporting** to `headroom/src/delta.ts` history file and `tracer/src/jsonl-writer.ts`. | headroom + tracer | Medium |
| 21 | **Add max concurrency to executor**: bounded queue or semaphore for spawned agents. | executor | Medium |
| 22 | **Remove module-level `defaultExecutor` singleton**: export `ExecutorRuntime` as public API. | executor | Small |
| 23 | **Cache/batch agent directory reads**: `listAgentDirectories` and `loadAgentDirectory` batch `readdirSync` / `readFileSync`. | core + executor | Medium |
| 24 | **Replace busy-wait polling in `awaitAgent`** with process `exit` event or exponential backoff. | executor | Small |
| 25 | **Stream large JSONL reads**: replace `readAll` full-file load with line-by-line async iterator in tracer/executor/plugin-api. | tracer + executor + plugin-api | Medium |

### P3 — Type Safety & Polish

| # | Action | Owner | Effort |
|---|--------|-------|--------|
| 26 | **Strongly type MCP tool handlers**: replace `Record<string, unknown>` args with generic `GlideTool<TArgs>` and Zod-validated input schemas. | mcp-server | Medium |
| 27 | **Replace unsafe `JSON.parse(...) as X` casts** across all five packages with Zod schemas or runtime type guards at deserialization boundaries. | all | Large |
| 28 | **Fix `HostRequest.id` type** to `string | number | null`; update `HostBridge` parse-error responses to `id: null`. | mcp-server | Small |
| 29 | **Brand ID types**: `AgentId`, `SessionId`, `CampaignId` as `readonly` branded interfaces in `core/src/types/index.ts`. | core | Small |
| 30 | **Drop `.js` extensions from barrel re-exports** in `core/src/index.ts`. | core | Trivial |
| 31 | **Add stdio lifecycle tests** for `initialize`, `initialized`, `tools/list`, `tools/call`, shutdown, bad-input paths. | mcp-server | Medium |
| 32 | **Add transport-failure tests** to CLI: malformed envelopes, spawn errors, timeout, unknown flags. | cli | Medium |
| 33 | **Expand test coverage** in `core` for `campaign/`, `constitution`, `fs/`, `io/`, `security/`. | core | Large |
| 34 | **Add XSS / malformed-input regression tests** in `dashboard`. | dashboard | Medium |

---

## 5. Quick-Win Checklist (Low Effort, High Value)

1. Use `generateCampaignId()` / `generateAmendmentId()` from `ids.ts` in `campaign/index.ts` and `constitution.ts`.
2. Send `notifications/initialized` in `mcp-server/src/server.ts`.
3. Suppress responses for notification methods in `mcp-server/src/server.ts:238-246`.
4. Clear timeout in `Promise.race` finalizer in `mcp-server/src/server.ts:203-210`.
5. Escape HTML in `dashboard/src/generator.ts:211-228`.
6. Fix JSON-in-script escaping in `dashboard/src/live.ts:359-381`.
7. Apply `createPathGuard` to `glide-indepth` output dir and artifact tools.
8. Restrict `tracer/src/index.ts` exports to public API only.
9. Forward `cause` in `GlideError` constructor.
10. Drop `.js` extensions from `core/src/index.ts` barrel.

---

## 6. Recommended Execution Order

1. **Week 1:** P0 protocol/security fixes (mcp-server lifecycle + dashboard XSS + core atomic writes/Zod).
2. **Week 2:** P0 path-guard enforcement across executor + mcp-server tools.
3. **Week 3:** P1 CLI transport rewrite, tracer core-wiring, executor async I/O.
4. **Week 4:** P2 performance batching/rotation + P3 type-safety generics + tests.

---

*This document is a synthesis of existing per-package audits into an integrated, prioritized action plan. No source files were modified.*
