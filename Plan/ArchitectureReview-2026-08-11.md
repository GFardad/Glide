# Glide Architecture Review — Production-Pattern Audit

Severity key: **HIGH** | **MEDIUM** | **LOW**

---

## 1) Plan items marked complete but only stubbed

| Severity | Item | Evidence |
|----------|------|----------|
| HIGH | Hermes wiring (in progress) | `Plan/ImplementationPlan.md` states Phases 0–6 are complete, but the remaining-work section admits Hermes wiring is incomplete: `mcpServers.glide` config and `scripts/verify-hermes-config.cjs` are still "next" items. |
| MEDIUM | CLI wrapper (`scripts/glide.mjs`) | `Plan/ImplementationPlan.md` lists CLI as remaining work, yet `package.json` contains `"glide": "node packages/cli/dist/cli.js"` and `packages/cli/src/cli.ts` exists, indicating a CLI was implemented but docs weren't updated to reflect this. |
| MEDIUM | `glide_graph` validation/smoke coverage | `Plan/ImplementationPlan.md` lists `glide_graph` smoke coverage as next work. `packages/tracer/src/graphify.ts` contains `GraphifyClient` with tests, but the MCP tool surface coverage is incomplete relative to stated targets. |
| LOW | `testPresenceGate` reads directory as file | `packages/permissions/src/gates.ts` uses `readFileSync(testDir, "utf8")` on a directory path. The gate passes if directory contents are non-empty, but the implementation is semantically incorrect and likely untested. |

---

## 2) Architectural violations

### 2.1 Global mutable singletons in core runtime paths
- **Severity:** HIGH
- **Files:** `packages/tracer/src/tracer.ts`, `packages/executor/src/session.ts`
- **Finding:** Both `SessionTraceLogger` and `TRACE_STORE` use module-level singletons with hidden global state. There is no interface boundary for swapping implementations in tests or production, and no lifecycle management (init/close/reset). This contradicts the doc-mandated "modularity: each package owns its domain and only public APIs cross packages" principle.
- **Impact:** Memory leaks in long-running MCP sessions; impossible to run two independent campaigns in the same process.

### 2.2 Cross-package `node:fs`/`node:path` coupling instead of public APIs
- **Severity:** MEDIUM
- **Files:** `packages/tracer/src/tracer.ts`, `packages/executor/src/session.ts`, `packages/headroom/src/converge.ts`, `packages/permissions/src/gates.ts`
- **Finding:** Multiple packages directly call `readFileSync`/`writeFileSync`/`readdirSync` on workspace paths. The docs explicitly say packages must only use each other's public APIs, but filesystem access is hard-coded per package.
- **Impact:** Impossible to swap storage backends (e.g., SQLite, cloud) without modifying every package.

### 2.3 `execSync` for quality gates
- **Severity:** MEDIUM
- **File:** `packages/permissions/src/gates.ts`
- **Finding:** Gates spawn `tsc`, `npm run lint`, `npm run build` via `execSync` with hard-coded commands, ignoring the monorepo's `pnpm` workspace tooling and `.env` config. This breaks in environments without npm, or when `pnpm` is the canonical runner.
- **Impact:** CI/non-standard environments fail silently or give false negatives.

### 2.4 Plugin composition doesn't validate plugin contract
- **Severity:** MEDIUM
- **File:** `packages/plugin-api/src/composition.ts`
- **Finding:** `CompositionRegistry.composeBundle` blindly spreads `instance.descriptor` and `mergedDefaults` into a new `PluginDescriptor`. There is no runtime schema validation (Zod is listed in the tech stack but unused here), so a malformed plugin can corrupt the composed bundle without early detection.
- **Impact:** Bad plugin manifests cause runtime failures instead of deterministic validation errors.

### 2.5 In-memory trace store with no persistence contract
- **Severity:** MEDIUM
- **File:** `packages/tracer/src/tracer.ts`
- **Finding:** `TRACE_STORE` is a `Map` that records traces but is never written to disk and has no read API. The doc requirement for `glide_trace` is "trace completo de código a agente padre hasta Headroom," but traces are ephemeral and unreachable after process restart.
- **Impact:** Trace feature is non-functional across restarts, contradicting the "session durability" requirement.

### 2.6 `glide_trace` not wired to `git blame` / `simple-git`
- **Severity:** MEDIUM
- **File:** `packages/tracer/src/tracer.ts`, `packages/tracer/package.json`
- **Finding:** Architecture explicitly lists `simple-git` for `git blame` integration, and `package.json` lists it as a dependency, but `tracer.ts` never imports or uses `simple-git`. `traceAgent` reads markdown files only.
- **Impact:** The documented trace-to-code-line feature is missing.

### 2.7 Session events and trace logs duplicate structure without consolidation
- **Severity:** LOW
- **Files:** `packages/executor/src/session.ts`, `packages/tracer/src/tracer.ts`
- **Finding:** Both implement near-identical `JSONLines` writers/readers with separate file defaults (`session-events.jsonl` vs `trace-events.jsonl`) and separate singletons. No shared abstraction exists.
- **Impact:** Increased maintenance burden; inconsistent rotation/retention policies.

---

## 3) Missing production concerns

### 3.1 Observability
- **Severity:** HIGH
- **Finding:** Logging is unstructured JSONL append-only files. There is no:
  - log rotation or max-size eviction
  - log levels or structured metadata (request IDs, campaign IDs, agent IDs in every record)
  - metrics/telemetry export
  - health-check endpoints
  - correlation between `session-events.jsonl` and `trace-events.jsonl`
- **Impact:** Operators cannot monitor, alert, or debug production runs.

### 3.2 Recovery / durability
- **Severity:** HIGH
- **Finding:**
  - `TRACE_STORE` is purely in-memory.
  - `SessionEventEmitter` and `SessionTraceLogger` append-only files have no compaction, backup, or corruption recovery beyond "skip malformed lines."
  - No checkpoint/restart protocol for agent sessions.
  - `globalSessionEmitter` is constructed at import time from env vars with no reconfiguration path.
- **Impact:** Data loss on crash; no way to resume long-running campaigns.

### 3.3 Security
- **Severity:** HIGH
- **Finding:**
  - `gates.ts` uses `execSync` with user-controlled workspace paths but no sanitization; a malicious `package.json` script or workspace path could inject commands.
  - No input validation on `GraphifyClient.read()` JSON payload — `JSON.parse` of untrusted `graph.json` can trigger prototype pollution or memory exhaustion via deeply nested objects.
  - `CompositionRegistry.composeBundle` trusts plugin-provided `defaults` without schema enforcement; a plugin can inject arbitrary keys into every composed plugin.
  - File writes in `constitution.ts` and `SessionEventWriter` use `writeFileSync`/`appendFileSync` without atomic writes or fsync, risking corruption on power loss.
- **Impact:** Arbitrary code execution, data corruption, privilege escalation via plugin manifests.

### 3.4 Performance
- **Severity:** MEDIUM
- **Finding:**
  - `GraphifyClient.query` scans all links for every queued node (`O(nodes * links)`), which will choke on large graphs.
  - `readAll()` in both event writer and trace logger loads entire JSONL files into memory with no streaming pagination.
  - `traceAgent` reads every sibling agent's `PERSONALITY.md` to build a children list (`O(agents)` per call).
  - No batching or async I/O anywhere; all file operations are synchronous and block the event loop.
- **Impact:** MCP tool latency grows linearly with campaign size; event-loop starvation under load.

### 3.5 Testing gaps vs. doc-stated quality gates
- **Severity:** MEDIUM
- **Finding:** Docs claim 97.33% statement coverage and 163 tests/27 files, but several production-critical paths have no test coverage:
  - `gates.ts` `testPresenceGate` reads a directory as a file (likely untested or test is passing vacuously).
  - `session.ts` concurrent writes to the same JSONL file are not tested; there is no file locking.
  - `constitution.ts` amendment status transitions are tested only for happy paths; concurrent amendment proposals are not considered.
- **Impact:** False confidence in quality gates.

---

## 4) Inconsistencies between docs and code

| Doc | Code | Issue |
|------|------|-------|
| `Architecture.md` says OpenCode/Hermes plugins connect as MCP plugins | `packages/plugin-api/src/loader.ts` defines `IPluginLoader` interface, but there is no implementation for OpenCode or Hermes Agent; only the abstraction exists | Phase 5 "complete" claim is misleading |
| `ImplementationPlan.md` lists remaining CLI work | `package.json` already has `"glide"` script and `packages/cli/src/cli.ts` exists | Docs out of sync with reality |
| `ImplementationPlan.md` says Hermes wiring is "in progress" with next steps | `skills/glide-cto/SKILL.md` and `docs/hermes-mcp.md` describe the full Hermes wiring procedure as if ready | State inconsistency: some docs say in-progress, others imply complete |
| `README.md` claims `GraphifyClient` exposes `prImpact` with "real file-diff integration" | `graphify.ts` contains a deterministic mock (`pickFilesForPr`) with a TODO comment to replace with `git diff` | Feature is stubbed |
| `README.md` lists `packages/mcp-server` in repo structure | `pnpm-workspace.yaml` and actual packages do not include `packages/mcp-server`; `package.json` scripts reference `packages/cli/dist/cli.js` and `packages/mcp-server/dist/index.js` | Repo structure doc is stale |
| `Architecture.md` says parent sees only child summaries | `tracer.ts` `indepthAgent` returns full `NOTES.md` and `TODO.md` content verbatim | Privacy/summarization requirement violated |
| `Architecture.md` requires no `delegate_task` usage | `skills/glide-cto/SKILL.md` is documented as not using `delegate_task`, but no code enforces this contract | Policy is unenforced |

---

## Summary of highest-risk issues

1. **Global mutable state** in tracer/executor breaks multi-campaign isolation and durability guarantees.
2. **Security:** `execSync` + unsanitized workspace paths, unvalidated JSON parsing, and unchecked plugin defaults create injection/corruption vectors.
3. **Observability + recovery:** No log rotation, no structured telemetry, no checkpointing — the system cannot operate reliably in production.
4. **Stubbed features claimed complete:** `git blame` integration, real PR impact analysis, and OpenCode/Hermes plugin loaders are abstractions only.
5. **Doc/code drift:** Repo structure, CLI status, and Hermes wiring status are inconsistent across README, ImplementationPlan, and actual source.
