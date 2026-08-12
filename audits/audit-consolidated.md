# Glide Audit Consolidated Action Plan
**Date:** 2026-08-13  
**Repo:** `/media/Storage/home-gfardad/Projects/Glide`  
**Branch:** `main`  
**Sources:** `audit-core.md`, `audit-types.md`, `audit-security.md`, `audit-arch-full.md`, `audit-mcp.md`, `audit-perf.md`, `audit-dashboard.md`, `audit-tracer.md`, `audit-headroom.md`, `audit-cli.md`, `audit-obs.md`, `audit-plugin.md`, `audit-errors.md`, `audit-docs.md`, `audit-dura.md`, `audit-executor.md`, `executor-architecture-primeagent-audit.md`, `audit-plugin-sec.md`, `plugin-system-security-audit.md`, `audit-packages-cli-2026-08-11.md`, `audit-coverage.md`

---

## Executive Summary
The Glide monorepo has strong scaffolding (9 packages, MCP stdio server, schema-first core, security guards) but violates its own architecture plan in three critical dimensions: **security boundaries**, **data integrity/durability**, and **production-grade I/O patterns**. The highest-risk issues are not missing features but *existing unsafe patterns* that will cause data loss, security incidents, or protocol failures under real load.

**Bottom line:** Fix P0 security and durability blockers first, then P1 types/tests/missing tools, then P2 observability/perf, then P3 polish/docs.

---

## P0 — Critical Blockers
*Must fix before any production exposure or release.*

| # | Action | Owner | Effort | Verification | Source Audits |
|---|--------|-------|--------|--------------|---------------|
| 1 | **Enforce `createPathGuard` in all runtime filesystem functions.** Add path traversal guards to `executor/src/runtime.ts`, `core/src/fs/agent-fs.ts`, `core/src/contract.ts`, `mcp-server/src/tools/glide-indepth.ts`, `mcp-server/src/tools/glide-converge.ts`, `mcp-server/src/tools/glide-build.ts`, `glide-plan.ts`, `glide-review.ts`, `glide-ship.ts`, `glide-test-tools.ts`. | `@glide/executor`, `@glide/core`, `@glide/mcp-server` | Medium | `grep -R "resolveAndValidatePath\|createPathGuard" packages/executor/src packages/core/src/fs packages/mcp-server/src/tools` should show guard usage before every `readFileSync`/`writeFileSync` on caller-controlled paths. | `audit-security`, `audit-mcp`, `audit-plugin`, `plugin-system-security-audit` |
| 2 | **Replace `execSync` with `spawn` + argv array validation in `permissions/src/gates.ts` and `core/src/security/command-guard.ts`.** Never invoke a shell; validate each argv element against the allowlist. | `@glide/permissions`, `@glide/core` | Medium | `grep -R "execSync" packages/permissions/src packages/core/src/security` returns zero hits. | `audit-security`, `audit-arch-full`, `audit-plugin-sec` |
| 3 | **Fix default-allow auth hole in `permissions/src/runtime.ts`.** Reject unknown actions; require explicit allowlist or capability token before any filesystem/process/network action. | `@glide/permissions` | Small | `grep -A5 "default:" packages/permissions/src/runtime.ts` shows no broad allow fallback. | `audit-security`, `audit-arch-full` |
| 4 | **Send `notifications/initialized` in MCP server and suppress responses to notifications.** Fix timeout race with `clearTimeout`. | `@glide/mcp-server` | Small | `grep "notifications/initialized" packages/mcp-server/src/server.ts` finds a real `writeMessage` call, not a no-op. | `audit-mcp` |
| 5 | **Drain stdout before `process.exit` in MCP server and CLI.** Add `await waitDrain(stdout)` in shutdown/exit handlers. | `@glide/mcp-server`, `@glide/cli` | Small | `grep -R "process.exit" packages/mcp-server/src packages/cli/src` shows no immediate exit without drain. | `audit-mcp`, `audit-cli` |
| 6 | **Replace raw `JSON.parse` + `as` casts with Zod schemas + `z.coerce.date()` in all core loaders:** `campaign/index.ts`, `constitution.ts`, `fs/campaign-fs.ts`. Add `InvalidCampaignError` / `InvalidConstitutionError`. | `@glide/core` | Medium | `grep -R "JSON.parse" packages/core/src/campaign packages/core/src/constitution.ts packages/core/src/fs/campaign-fs.ts` returns zero unguarded casts. | `audit-core`, `audit-types` |
| 7 | **Use `atomicWriteFileSync` + `fsync` for all core writers:** `campaign/index.ts`, `constitution.ts`, `fs/agent-fs.ts`, `headroom/src/headroom.ts`, `headroom/src/delta.ts`, `executor/src/contract.ts`, `plugin-api/src/durability.ts`, `plugin-api/src/session.ts`. | `@glide/core`, `@glide/headroom`, `@glide/executor`, `@glide/plugin-api` | Large | `grep -R "writeFileSync" packages/core/src/campaign packages/core/src/constitution.ts packages/core/src/fs/agent-fs.ts packages/headroom/src packages/executor/src/contract.ts packages/plugin-api/src` returns zero direct overwrites without temp-file + rename. | `audit-core`, `audit-dura`, `audit-headroom`, `audit-executor` |
| 8 | **Remove global mutable singletons:** `defaultExecutor` in `executor/src/executor.ts` and `globalSessionEmitter` in `executor/src/session.ts`. Export `ExecutorRuntime` and `SessionEventEmitter` for explicit construction. | `@glide/executor` | Medium | `grep -R "defaultExecutor\|globalSessionEmitter" packages/executor/src` returns zero hits. | `audit-executor`, `executor-architecture-primeagent-audit` |
| 9 | **Enforce plugin manifest permissions at runtime.** Gate filesystem/network/shell/env in `plugin-api/src/registry.ts` and `loader.ts`. Reject unpermitted operations before `import()` or I/O. | `@glide/plugin-api` | Medium | `grep -R "manifest.permissions" packages/plugin-api/src` shows enforcement checks before I/O. | `audit-plugin`, `audit-plugin-sec`, `plugin-system-security-audit` |
| 10 | **Sandbox plugin entrypoints.** Validate `entrypoint.module` against an allowlist root; reject `..` and absolute paths. Run loaders in `worker_threads` or separate processes. | `@glide/plugin-api`, `plugins/example-plugin` | Medium | `grep -R "import(modulePath)" plugins/example-plugin/src` shows path validation before dynamic import. | `audit-plugin`, `plugin-system-security-audit` |
| 11 | **Replace `Date.now()+Math.random()` IDs with `nanoid`/`crypto.randomUUID` everywhere:** `core/src/campaign/index.ts`, `core/src/constitution.ts`, `executor/src/executor.ts`, `headroom/src/delta.ts`. | `@glide/core`, `@glide/executor`, `@glide/headroom` | Small | `grep -R "Date.now()" packages/core/src/campaign packages/core/src/constitution.ts packages/executor/src/executor.ts packages/headroom/src/delta.ts` returns zero ID-generation hits. | `audit-core`, `audit-security`, `audit-headroom`, `audit-executor` |
| 12 | **Add `fsync`/`fdatasync` to all `appendFileSync`/`writeFileSync` paths that must survive crashes** in tracer, executor, plugin-api, headroom. Adopt temp-file + `renameSync` for overwrites. | `@glide/tracer`, `@glide/executor`, `@glide/plugin-api`, `@glide/headroom` | Large | `grep -R "writeFileSync\|appendFileSync" packages/tracer/src packages/executor/src packages/plugin-api/src packages/headroom/src` shows only temp-file + rename + fsync patterns. | `audit-dura`, `audit-perf`, `audit-headroom`, `audit-executor` |

---

## P1 — High-Value Fixes
*Required for production hardening; close major safety and correctness gaps.*

| # | Action | Owner | Effort | Verification | Source Audits |
|---|--------|-------|--------|--------------|---------------|
| 13 | **Add missing Plan-specified types to `core/src/types/index.ts`:** `AgentContext` (path fields + `tokenBudget` + `allowedMcp`), `ToolName`, `ToolCall`, `MeetingRoomOutput`, `TodoItem`. Brand `AgentId`/`SessionId`/`CampaignId` as `readonly` interfaces. Re-export from `core/src/index.ts`. | `@glide/core` | Medium | `grep "export interface AgentContext" packages/core/src/types/index.ts` finds the interface; `grep "readonly id" packages/core/src/types/index.ts` finds branded IDs. | `audit-core`, `audit-types`, `audit-arch-full` |
| 14 | **Implement missing governance MCP tools:** `glide_context`, `glide_permission_request`, `glide_permission_approve`, `glide_rejected_log`. Wire them into `tools/index.ts`. | `@glide/mcp-server` | Large | `ls packages/mcp-server/src/tools/glide-{context,permission-request,permission-approve,rejected-log}.ts` shows all four files. | `audit-arch-full`, `audit-mcp` |
| 15 | **Add `accessLevel` enforcement to MCP tool registry.** Gate `cto` vs `agent` tools in `mcp-server/src/tools/index.ts` and handlers. | `@glide/mcp-server` | Medium | `grep "accessLevel" packages/mcp-server/src/tools/index.ts` shows enforcement before handler dispatch. | `audit-arch-full`, `audit-security` |
| 16 | **Replace `Record<string, unknown>` metadata with typed `GoalMetadataSchema`** in `headroom/src/goal-store.ts` and `core/src/schemas/index.ts`. | `@glide/headroom`, `@glide/core` | Small | `grep "z.record(z.unknown())" packages/headroom/src/goal-store.ts packages/core/src/schemas/index.ts` returns zero hits. | `audit-core`, `audit-headroom` |
| 17 | **Forward `Error.cause` in `GlideError`.** Remove dead `PermissionDeniedError` or wire it into permission checks. Add `InvalidCampaignError`, `InvalidConstitutionError`. | `@glide/core` | Small | `grep "super(message, { cause })" packages/core/src/errors/index.ts` finds the pattern. | `audit-core`, `audit-errors` |
| 18 | **Remove dead dependencies or wire them up:** `simple-git` and `zod` in `tracer/package.json`; `zod` in `executor/package.json`. | `@glide/tracer`, `@glide/executor` | Small | `grep -l "simple-git\|zod" packages/tracer/package.json packages/executor/package.json` shows either removed or imported in source. | `audit-tracer`, `audit-executor` |
| 19 | **Replace stub build/test/review/ship tools with real logic or remove stubs.** At minimum, stop writing placeholder `TBD` markdown. | `@glide/mcp-server` | Large | `grep -R "TBD" packages/mcp-server/src/tools/glide-{build,test-tools,review,ship}.ts` returns zero hits. | `audit-arch-full` |
| 20 | **Replace naive drift detection with semantic check** in `headroom/src/headroom.ts`. | `@glide/headroom` | Medium | `grep "includes\|detectDrift" packages/headroom/src/headroom.ts` shows semantic comparison, not substring. | `audit-headroom` |
| 21 | **Add per-tool argument interfaces** derived from `inputSchema` in `mcp-server/src/tools/types.ts` and all 16 tool files. | `@glide/mcp-server` | Large | `grep "Record<string, unknown>" packages/mcp-server/src/tools/*.ts` returns zero handler-argument hits. | `audit-types` |
| 22 | **Add `traceId`/`spanId` propagation into child process env** in `executor/src/executor.ts`. | `@glide/executor` | Small | `grep "GLIDE_TRACE_ID" packages/executor/src/executor.ts` finds env injection at spawn. | `audit-obs` |
| 23 | **Add runtime metrics primitive** for spawn duration, exit code, tool latency, backpressure count. | `@glide/executor`, `@glide/mcp-server` | Medium | New file `packages/executor/src/metrics.ts` exports counters used in `spawnAgent` and tool handlers. | `audit-obs`, `audit-perf` |
| 24 | **Replace `readJsonIfExists` return type** to distinguish missing / not-file / parse-error / success states in `permissions/src/gates.ts`. | `@glide/permissions` | Small | Signature uses `{ ok: true; value: unknown } | { ok: false; error: "missing" | "not_file" | "parse" }`. | `audit-types` |
| 25 | **Fix `testPresenceGate` directory-read bug** in `permissions/src/gates.ts:143` (`readFileSync` on directory → `readdirSync`). | `@glide/permissions` | Trivial | `grep "readFileSync.*testDir" packages/permissions/src/gates.ts` returns zero hits. | `audit-arch-full`, `audit-security` |
| 26 | **Add SQLite WAL + `PRAGMA synchronous=NORMAL`** in `headroom/src/goal-store.ts`. | `@glide/headroom` | Small | `grep "PRAGMA" packages/headroom/src/goal-store.ts` finds WAL and synchronous settings. | `audit-headroom`, `audit-dura` |
| 27 | **Escape JSON in dashboard HTML** to prevent XSS in `dashboard/src/generator.ts` and `dashboard/src/live.ts`. | `@glide/dashboard` | Small | `grep -R "campaignsJson\|dataJson" packages/dashboard/src` shows `JSON.stringify` + escaping before interpolation. | `audit-dashboard` |
| 28 | **Write core test suite** targeting 80% coverage for `campaign/index.ts`, `constitution.ts`, `fs/agent-fs.ts`, `fs/campaign-fs.ts`, `io/atomic-write.ts`, `security/*`. | `@glide/core` | Large | `pnpm test -- --coverage` shows `packages/core` overall ≥ 80%. | `audit-core`, `audit-coverage` |
| 29 | **Add stdio lifecycle smoke tests** for MCP server: initialize, initialized, tools/list, tools/call, shutdown, bad-input paths. | `@glide/mcp-server` | Medium | New `packages/mcp-server/test/stdio-smoke.test.ts` exists and passes. | `audit-mcp` |
| 30 | **Add XSS and malformed-input regression tests** for dashboard. | `@glide/dashboard` | Medium | `test/dashboard.test.ts` includes `<script>` payload and corrupted JSON cases. | `audit-dashboard` |

---

## P2 — Medium
*Polish, observability, performance, and consistency improvements.*

| # | Action | Owner | Effort | Verification | Source Audits |
|---|--------|-------|--------|--------------|---------------|
| 31 | **Add async I/O variants** (`atomicWriteFile`, `atomicAppendFile`) in `core/src/io/atomic-write.ts` for non-blocking paths. | `@glide/core` | Medium | `grep "export async function atomicWriteFile" packages/core/src/io/atomic-write.ts` finds async exports. | `audit-core` |
| 32 | **Validate markdown section structure** in `core/src/fs/agent-fs.ts` `validateAgentDirectory` using `AgentFileContractSchema.expectedSection`. | `@glide/core` | Small | `validateAgentDirectory` throws on missing `## Objective` / `## Budget` sections. | `audit-core` |
| 33 | **Add runtime validation that `GOAL.md` does not contain `TBD` placeholder** before agent is considered valid. | `@glide/core`, `@glide/executor` | Small | `grep "TBD" packages/core/src/fs/agent-fs.ts packages/executor/src/runtime.ts` returns zero hits in templates; validator rejects `TBD`. | `audit-core`, `audit-executor` |
| 34 | **Extract shared `JsonlWriter` to `@glide/core`** and use it from `tracer` and `executor` to eliminate duplication. | `@glide/core`, `@glide/tracer`, `@glide/executor` | Medium | `packages/executor/src/session.ts` and `packages/tracer/src/jsonl-writer.ts` import from `@glide/core/io/jsonl-writer`. | `audit-perf`, `audit-executor` |
| 35 | **Add stdin backpressure in MCP server.** Pause stdin reads when buffer exceeds threshold; resume after drain. | `@glide/mcp-server` | Medium | `server.ts` calls `stdin.pause()` / `stdin.resume()` based on `buffer.length`. | `audit-perf`, `audit-mcp` |
| 36 | **Switch CLI to long-lived MCP server process** (or use SDK `StdioClientTransport`). Make timeout configurable per command. | `@glide/cli` | Medium | `packages/cli/src/cli.ts` reuses a single spawned server across calls; timeout reads from `--timeout` / env. | `audit-cli`, `audit-perf` |
| 37 | **Replace `traceAgent` O(N) agent scan with parent-index file.** Update index on agent creation; make child lookup O(children). | `@glide/tracer` | Medium | `packages/tracer/src/tracer.ts` reads `agents/index.json` instead of scanning all `PERSONALITY.md` files. | `audit-perf`, `audit-tracer` |
| 38 | **Add bounded concurrency to `ExecutorRuntime`.** Add `maxConcurrency` option; return `pending` handle when limit reached. Remove `defaultExecutor` singleton. | `@glide/executor` | Medium | `executor.ts` exposes `ExecutorRuntime` constructor with `maxConcurrency`; no module-level singleton. | `audit-perf`, `audit-executor` |
| 39 | **Fix `awaitAgent` to use process `exit` event** instead of `setTimeout(check, 50)` polling. | `@glide/executor` | Small | `grep "setTimeout(check" packages/executor/src/executor.ts` returns zero hits. | `audit-perf`, `audit-executor` |
| 40 | **Migrate agent mutations (`appendNote`, `markTodoDone`, `recordRejection`) to append-only JSONL** in `executor/src/runtime.ts`. Regenerate markdown on read. | `@glide/executor` | Medium | `runtime.ts` writes to `NOTES.jsonl`, `TODO.jsonl`, `REJECTED.jsonl`; markdown files are render-only. | `audit-perf` |
| 41 | **Add `git blame` integration to `glide_trace`** via `simple-git`. Map agent files to code lines. | `@glide/tracer` | Medium | `grep "simple-git" packages/tracer/src/tracer.ts` shows import and usage. | `audit-tracer`, `audit-arch-full` |
| 42 | **Align `glide_indepth` output format to JSON per plan** (or update plan/docs to match markdown reality). | `@glide/tracer`, `@glide/mcp-server` | Small | `docs/api.md` and implementation agree on output format/path. | `audit-tracer`, `audit-arch-full`, `audit-docs` |
| 43 | **Add structured logging abstraction** (JSON logs, levels, request correlation) across all packages. | All packages | Large | New `packages/core/src/logging.ts` used by `server.ts`, `executor.ts`, `headroom.ts`. | `audit-obs`, `audit-arch-full` |
| 44 | **Add health/diagnostics tool** exposing writer state, agent registry size, last tick, rotation failures. | `@glide/mcp-server` | Medium | `glide-status.ts` or new `glide-diagnostics.ts` returns structured health object. | `audit-obs` |
| 45 | **Add JSONL rotation + corruption recovery** in `tracer`, `executor`, `headroom`, `plugin-api`. | `@glide/tracer`, `@glide/executor`, `@glide/headroom`, `@glide/plugin-api` | Medium | All JSONL writers use shared rotation with bounded size and checksum/length-prefix integrity. | `audit-dura`, `audit-perf` |
| 46 | **Replace global mutable singletons with package-scoped lifecycle objects** in `tracer/src/tracer.ts` (`TRACE_STORE`) and `executor/src/session.ts` (`globalSessionEmitter`). | `@glide/tracer`, `@glide/executor` | Medium | No module-level `new Map()` or `new SessionEventEmitter()` without explicit owner. | `audit-arch-full`, `audit-executor` |
| 47 | **Migrate hot-path I/O to `fs.promises` + `Promise.all`** for parallel reads in executor, tracer, headroom. | `@glide/executor`, `@glide/tracer`, `@glide/headroom` | Medium | `grep "readFileSync\|writeFileSync" packages/executor/src packages/tracer/src packages/headroom/src` shows only legacy/compat paths, not hot path. | `audit-perf` |
| 48 | **Add `glide_status` hardcoded phase fix.** Replace `phase: "1-2"` with computed status from actual package versions / campaign state. | `@glide/mcp-server` | Trivial | `glide-status.ts:19` computes `phase` from runtime inspection, not a string literal. | `audit-arch-full` |
| 49 | **Sync all docs:** tool count (14 → 17), paths, phase status, API signatures, Hermes config paths. | Docs / `@glide/mcp-server` | Medium | `grep -c "14" README.md docs/api.md` returns zero tool-count mismatches. | `audit-docs` |
| 50 | **Fix `Plan/*.md` package names** to match code (`mcp-server`, `executor`, `headroom`, `permissions`, `tracer`). | Docs | Small | `grep -R "packages/mcp/\|packages/runtime/" Plan/` returns zero hits. | `audit-docs`, `audit-arch-full` |

---

## P3 — Low
*Polish, accessibility, dead-code removal, and minor robustness improvements.*

| # | Action | Owner | Effort | Verification | Source Audits |
|---|--------|-------|--------|--------------|---------------|
| 51 | **Add `$_meta` / `structuredContent` on tool definitions** or document why omitted. | `@glide/mcp-server` | Trivial | `tools/types.ts` includes optional `$_meta` field with comment. | `audit-mcp` |
| 52 | **Remove redundant exports in `tools/index.ts`.** Import explicitly; export only `tools`. | `@glide/mcp-server` | Trivial | `grep "export \*" packages/mcp-server/src/tools/index.ts` returns zero hits. | `audit-mcp` |
| 53 | **Remove redundant type checks in tool handlers** (`glide-build.ts`, `glide-test-tools.ts`, `glide-ship.ts`). | `@glide/mcp-server` | Trivial | No duplicate `typeof x !== "string"` in same function. | `audit-mcp` |
| 54 | **Add keyboard navigation and focus indicators** to dashboard HTML. | `@glide/dashboard` | Small | `generator.ts` and `live.ts` include `tabindex`, `:focus-visible`, and Enter/Space handlers. | `audit-dashboard` |
| 55 | **Add visual regression / axe-core accessibility tests** for dashboard. | `@glide/dashboard` | Medium | New `test/dashboard-a11y.test.ts` runs `axe` on generated HTML. | `audit-dashboard` |
| 56 | **Document that dashboard is static-render-only** or migrate to async I/O if used in server context. | `@glide/dashboard` | Small | `README.md` states sync I/O contract. | `audit-dashboard` |
| 57 | **Drop `.js` extensions from barrel re-exports** in `core/src/index.ts`, `executor/src/index.ts`, `tracer/src/index.ts`. | `@glide/core`, `@glide/executor`, `@glide/tracer` | Trivial | `grep '".*\.js"' packages/*/src/index.ts` returns zero hits. | `audit-core`, `audit-tracer` |
| 58 | **Move side-effect imports to file top** in `core/src/constitution.ts`. | `@glide/core` | Trivial | First 10 lines of `constitution.ts` include all imports. | `audit-core` |
| 59 | **Remove dead code:** `SessionEventWriter.rotateIfNeeded` in `executor/src/session.ts`, `replayAsStream` identical to `replay`, `tracer/src/tracer.ts` `createTracer` deprecation. | `@glide/executor`, `@glide/tracer` | Small | No unused private methods or deprecated exports remain. | `audit-perf`, `audit-tracer`, `audit-executor` |
| 60 | **Add `prefers-reduced-motion` support** to dashboard live view auto-refresh. | `@glide/dashboard` | Small | `live.ts` checks `matchMedia('(prefers-reduced-motion: reduce)')` before `setInterval`. | `audit-dashboard` |
| 61 | **Cap `traceStore` Map size or flush to disk** in `tracer/src/tracer.ts`. | `@glide/tracer` | Small | `traceStore` has max-size eviction or periodic flush to JSONL. | `audit-perf`, `audit-tracer` |
| 62 | **Add WCAG AA contrast audit** for dashboard color pairs. | `@glide/dashboard` | Small | `generator.ts` and `live.ts` CSS variables meet 4.5:1 contrast; documented in comments or design tokens. | `audit-dashboard` |
| 63 | **Document `packages/cli` in `Plan/Architecture.md` §6.1** or fold into `mcp-server` with documented entrypoint. | Docs | Trivial | `Plan/Architecture.md` lists `packages/cli` or documents its path. | `audit-docs`, `audit-cli` |
| 64 | **Investigate orphaned `packages/mcp/` directory** (exists without `package.json`). Remove or restore. | Infra | Trivial | `ls packages/mcp/package.json` succeeds or directory is removed. | `audit-docs` |
| 65 | **Add integration tests for malformed JSONL, permission errors, and shutdown signals** across executor, tracer, plugin-api. | All packages | Medium | New `test/*-shutdown.test.ts` files inject failures and verify graceful handling. | `audit-errors`, `audit-dura` |
| 66 | **Add file locking or single-writer process** for JSONL rotation to prevent corruption under concurrent writers. | `@glide/tracer`, `@glide/executor`, `@glide/plugin-api` | Medium | JSONL writers use `flock` or a dedicated writer process. | `audit-security`, `audit-perf` |

---

## Verification Commands Reference
Run these after implementing changes to confirm regressions are fixed:

```bash
# Type checking
pnpm tsc --noEmit

# Unit tests + coverage
pnpm test

# Coverage gate (fail if any package < 80%)
pnpm test -- --coverage

# Security grep checks
grep -R "execSync" packages/permissions/src packages/core/src/security || true
grep -R "writeFileSync" packages/core/src/campaign packages/core/src/constitution.ts packages/core/src/fs/agent-fs.ts packages/headroom/src packages/executor/src/contract.ts packages/plugin-api/src | grep -v "atomicWriteFileSync" || true
grep -R "defaultExecutor\|globalSessionEmitter" packages/executor/src || true
grep -R "JSON.parse" packages/core/src/campaign packages/core/src/constitution.ts packages/core/src/fs/campaign-fs.ts | grep -v "Zod\|safeParse\|parse(" || true
grep -R "Date.now()" packages/core/src/campaign packages/core/src/constitution.ts packages/executor/src/executor.ts packages/headroom/src/delta.ts | grep -v "nanoid\|crypto.randomUUID" || true

# MCP protocol checks
grep "notifications/initialized" packages/mcp-server/src/server.ts
grep -c "clearTimeout" packages/mcp-server/src/server.ts

# Path guard checks
grep -R "resolveAndValidatePath\|createPathGuard" packages/executor/src/runtime.ts packages/mcp-server/src/tools/glide-*.ts | wc -l

# Plugin sandbox checks
grep -R "manifest.permissions" packages/plugin-api/src/loader.ts packages/plugin-api/src/registry.ts | wc -l

# Docs sync checks
grep -c "17 tools\|17 glide_" README.md docs/api.md packages/mcp-server/README.md
```

---

## Risk Summary by Priority

### P0 Risks
- **Data loss:** Non-atomic writes + missing fsync mean power loss / OOM kill corrupts campaigns, constitutions, agent contracts, session logs, and plugin state.
- **Security incident:** Path traversal + unsanitized `execSync` + arbitrary plugin `import()` = full host compromise from any untrusted input (campaign dir, agent ID, plugin manifest).
- **Protocol failure:** Missing `notifications/initialized` and responses to notifications cause client hangs/disconnects; unhandled timeout rejections crash the server.
- **Auth bypass:** Default-allow permission runtime + spoofable `subject_id`/`agent_id` mean any caller can perform any action.

### P1 Risks
- **Type confusion:** 30+ unvalidated `JSON.parse` casts and `Record<string, unknown>` tool args let malformed data propagate silently.
- **Missing features:** 4 planned MCP tools absent; 4 tools are stubs; `git blame` tracing not implemented.
- **Multi-campaign breakage:** Global singletons prevent running two campaigns in the same process; required for any real harness usage.
- **Unbounded resource usage:** No concurrency limit on agent spawning; no rotation on most JSONL logs; unbounded `traceStore` Map.

### P2 Risks
- **Observability blackout:** No metrics, no correlation propagation, no health endpoint. Production incidents require manual log scraping.
- **Performance collapse:** Full-file RMW on every mutation; O(N) agent scans; per-record fsync. At 200 agents / 50 MB traces, the event loop stalls for seconds.
- **Doc/code drift:** README, API docs, and plan docs disagree on tool count, paths, package names, and output schemas.

### P3 Risks
- **Accessibility/compliance:** Dashboard fails WCAG AA keyboard and contrast checks; XSS vectors in generated HTML.
- **Developer experience:** Hand-rolled CLI parser, missing barrel type exports, dead code, and hardcoded paths increase maintenance cost.

---

## Effort Legend
- **Trivial:** < 1 hour, single-file edit.
- **Small:** 1–4 hours, 1–3 files.
- **Medium:** 1–3 days, 3–10 files, may require new test files.
- **Large:** 3–7 days, cross-package changes, new subsystems or significant refactors.

---

## Recommended Execution Order
1. **Week 1 (P0):** Security boundaries (path guards, execSync, plugin sandbox), MCP protocol fixes, Zod loaders, atomic writes for core + headroom + executor + plugin-api, remove singletons.
2. **Week 2–3 (P1):** Missing types + Plan interfaces, missing governance tools, accessLevel enforcement, stubbed tools, ID generation, test suite expansion, dashboard XSS fixes.
3. **Week 4–5 (P2):** Observability (metrics, correlation, health tool), performance (async I/O, JSONL consolidation, backpressure), docs sync, git blame integration.
4. **Week 6+ (P3):** Dashboard a11y, polish items, dead-code removal, orphaned directory cleanup.
