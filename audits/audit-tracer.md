# @glide/tracer — Architecture & Production-Grade Audit
**Audit scope:** `packages/tracer/src/**/*.ts`, `packages/tracer/package.json`, `packages/tracer/README.md`  
**Reference docs:** `Plan/Architecture.md`, `Plan/TechnicalSpec.md`, `vitest.config.ts`, `packages/core/package.json`  
**Date:** 2026-08-11

---

## 1. Executive Summary

`@glide/tracer` implements the `glide_trace` and `glide_indepth` surfaces from Architecture §2.2, but it stops at a thin file-reader wrapper. It violates monorepo layering by bypassing `@glide/core`, declares unused dependencies, lacks git-integrated code-line tracing, has no local test harness, and mixes sync/async APIs without clear contracts. These gaps make it unsuitable for production use without targeted remediation.

**Top-line verdict:** FUNCTIONAL but NOT production-grade. Three HIGH and five MEDIUM findings require remediation before CI/release.

---

## 2. File-by-Line Findings

### `packages/tracer/package.json`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| HIGH | 13–15 | Declares `@glide/core`, `simple-git`, and `zod` as dependencies, but `src/**/*.ts` imports none of them. This violates Architecture §6.3 ("avoid Daisy chain … use existing libraries") by shipping dead dependencies and inflating install size. |
| MEDIUM | 7–10 | `test` script runs `vitest run` but the package has no local `test/` directory or vitest config. The root `vitest.config.ts` only includes `test/**/*.test.ts`, so tracer tests in `/test/` are discovered by the root runner only. Running `pnpm --filter @glide/tracer test` fails with `No test files found`. |
| MEDIUM | 8 | `build` is bare `tsc`; no `prepublishOnly`/CI gating. Other packages in the repo use identical scripts, so this is consistent but still weak. |

### `packages/tracer/src/tracer.ts`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| HIGH | 1–2 | Imports `node:fs` directly for workspace traversal. Architecture §6.1 defines `packages/core` as the home for "types, interfaces, errors, utilities" and §6.3 mandates "between packages only public API is used." Tracer bypasses core and reaches into the filesystem directly, creating a hidden coupling to on-disk agent layouts. |
| HIGH | 53–105 | `traceAgent` is entirely synchronous (`existsSync`, `readFileSync`, `readdirSync`). For workspaces with many agents, this blocks the event loop. The architecture targets Node.js 20+ and Bun compatibility; production code should use async variants or offload to worker threads. |
| HIGH | 66–70 | Reads `GOAL.md`, `NOTES.md`, `TODO.md`, and `PERSONALITY.md` with no schema validation. Architecture §5 principle 4 says "Everything in context remains"; placeholder or malformed files silently become trace payloads. |
| HIGH | 107–133 | `indepthAgent` is synchronous and performs the same blocking reads. It returns a markdown string with no streaming or backpressure for large agent contexts. |
| MEDIUM | 135–145 | `recordTrace` stores traces in an in-memory `Map` keyed by `"global"` campaign ID. There is no multi-campaign isolation, no bounded eviction, and no persistence beyond `TraceRuntime` for structured events. |
| MEDIUM | 148–154 | Exported convenience function `traceAgent` creates a new `TracerRuntime` per call but reuses default `TraceRuntimeOptions` (`.glide-sessions` root). Callers cannot scope or namespace traces. |
| MEDIUM | 160–166 | `readLines` silently swallows read errors by returning `[]` if the file does not exist. Missing files are indistinguishable from empty files, making agent state debugging ambiguous. |
| MEDIUM | 168–173 | `createTracer` is marked `@deprecated` but still exported from `index.ts` without a migration path or removal schedule. |
| LOW | 6–14 | `AgentTrace` interface lacks `sessionPath` and `rejected` fields mentioned in Architecture §2.2 `glide_indepth` spec ("includes … REJECTED aggregated"). |

### `packages/tracer/src/trace-runtime.ts`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| MEDIUM | 33–44 | `log` accepts `TraceCorrelation` but conflates it with `TraceEvent` fields via spread (`...event`). If both are provided, the correlation fields silently override event fields, producing unpredictable trace provenance. |
| MEDIUM | 37–44 | `_ts` is always set to `new Date().toISOString()`. There is no monotonic clock or causal ordering; under high throughput, event order may not match real-time sequence. |
| MEDIUM | 24–30 | Defaults to `.glide-sessions/trace-events.jsonl` but tracer's own `jsonl-writer` defaults to `.glide-logs/events.jsonl`. Two default file roots for related concerns increases operator confusion. |
| LOW | 21–31 | `maxBytes` and `maxFiles` are configurable but there is no schema validation on inputs. A caller could pass negative values and trigger unexpected behavior in `rotateIfNeeded`. |

### `packages/tracer/src/jsonl-writer.ts`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| MEDIUM | 46–48 | Record size check compares `json.length >= this.maxBytes`, but `maxBytes` defaults to 5 MB. A single trace event larger than 5 MB throws and aborts the entire write, with no retry or partial-write fallback. |
| MEDIUM | 50–53 | `rotateIfNeeded` is called synchronously before every `writeFileSync`. This means every append performs up to 4 `statSync`/`renameSync`/`unlinkSync` calls, even when rotation is not needed. This is an I/O hot path. |
| MEDIUM | 86–97 | `fsyncFile` opens the file with `openSync(..., "r")` and calls `fsyncSync`. `fsync` on a read-only fd is a no-op on Linux but undefined behavior on some filesystems. Write durability requires opening with `"r+"` or `"a"`. |
| LOW | 60–70 | `readAll` reads the entire file into memory and splits by regex. For large JSONL files this is O(n) memory; no streaming parser or backpressure is provided. |
| LOW | 55–58 | `readAll` returns `[]` if file does not exist. Callers cannot distinguish "no events yet" from "file was deleted", which matters for crash recovery. |

### `packages/tracer/src/graphify.ts`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| HIGH | 41–275 | `GraphifyClient` is fully self-contained and imported by `packages/mcp-server/src/tools/glide-tracer.ts`, but it is **not integrated** with `TracerRuntime` or `TraceRuntime`. Graphify data is never emitted as trace events, so the knowledge-graph layer is disconnected from the tracing layer. |
| MEDIUM | 71–75 | `loadGraph` rejects files larger than 100 MB but does not provide streaming or incremental loading. A large `graph.json` will load entirely into memory. |
| MEDIUM | 113–168 | `query` is O(n*m) where n = nodes and m = links, with no index or precomputed adjacency. For repos with >10k nodes, this will be slow. |
| LOW | 219–259 | `prImpact` uses a deterministic mock (`pickFilesForPr`) that does not consult git history. Architecture §2.2 explicitly lists "Git integration: git blame for finding agent_id" as a requirement. |

### `packages/tracer/src/index.ts`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| MEDIUM | 1–4 | Re-exports everything from `tracer`, `graphify`, `jsonl-writer`, and `trace-runtime`. This leaks internal modules (`jsonl-writer`, `trace-runtime`) to consumers, violating the public API boundary principle in Architecture §6.3. |

### `packages/tracer/README.md`
| Severity | Line(s) | Finding |
|----------|---------|---------|
| MEDIUM | 1–18 | README documents only `traceAgent` and `indepthAgent`. It omits `TracerRuntime`, `TraceRuntime`, `TraceCorrelation`, `GraphifyClient`, and all configurable options (`rootDir`, `fileName`, `maxBytes`, `maxFiles`). This contradicts the "public API must be documented" expectation for production packages. |

---

## 3. Architecture Plan Compliance

| Architecture Requirement | Plan Location | Implementation | Gap |
|--------------------------|---------------|----------------|-----|
| `glide_trace` — trace from code line to agent to Headroom | §2.2 `agent/` tools | `traceAgent` reads agent files; no code-line or git integration | HIGH: no git blame, no file→agent mapping |
| `glide_indepth` — JSON dump with parent/children/notes/todos/rejected/session_path | §2.2 `glide_indepth` | Returns markdown with goal/parent/children/notes/todos only | MEDIUM: missing `REJECTED.md` aggregation, missing `sessionPath` |
| Uses `simple-git` for git blame tracing | §6.3 dependencies | `simple-git` declared in package.json but never imported | HIGH: dead dependency, feature not implemented |
| Uses `zod` for schema validation | §6.3, §5 principle 4 | `zod` declared but never imported | MEDIUM: no input or output validation |
| Uses `ulid`/`nanoid` for IDs | §6.3 dependencies | Tracer generates no IDs; parent/child matching uses raw strings from files | LOW: no ID generation needed at this layer, but inconsistent with core |
| Production-grade: strict mode, type-safe, test coverage | §6.2 | `tsconfig` extends base strict mode; typecheck passes | MEDIUM: no local tests; coverage relies on root vitest |
| Modularity: only public API between packages | §6.1, §6.3 | `index.ts` re-exports internals; mcp-server imports `traceAgent` directly from `@glide/tracer` | MEDIUM: internal leakage |

---

## 4. Production-Grade Standards Audit

### 4.1 Correctness & Safety
- **Blocking I/O hot path:** `traceAgent` and `indepthAgent` call `readFileSync`/`readdirSync`/`existsSync` in the request path. For workspaces with 100+ agents, this will block the event loop for 10–100 ms per call.
- **Silent error swallowing:** `readLines` returns `[]` on missing file. `traceAgent` throws only when `GOAL.md` is missing, but missing `NOTES.md`/`TODO.md`/`PERSONALITY.md` is indistinguishable from empty content.
- **No input validation:** Despite `zod` being a declared dependency, no Zod schema validates `workspace`, `agentId`, or trace payloads. Path traversal via `../` in `agentId` will construct arbitrary filesystem paths in `join(workspace, "agents", agentId)`.
- **Non-atomic reads:** `traceAgent` reads four separate files with no transactionality. A concurrent writer could leave the trace in an inconsistent state.

### 4.2 Observability & Durability
- **Dual default paths:** `TraceRuntime` writes to `.glide-sessions/`, while `JsonlWriter` defaults to `.glide-logs/`. Operators have no single root to inspect or back up.
- **No structured logging:** Errors in `jsonl-writer` are caught and swallowed in `rotateIfNeeded` and `fsyncFile`. Operators receive no signal when rotation or fsync fails.
- **No metrics/health:** No counters for events written, rotation count, read errors, or filesystem latency. A production tracer needs at minimum write-throughput and error-rate metrics.

### 4.3 Testability
- **No local test directory:** `packages/tracer/` contains no `test/` folder. The two existing test files (`test/tracer.test.ts`, `test/coverage-tracer-runtime.test.ts`) live at the repo root and import from `dist/` and `src/` directly.
- **Package-local test command fails:** Running `pnpm --filter @glide/tracer test` exits with code 1 because vitest finds no files matching `test/**/*.test.ts` inside the package.
- **Coverage exclusion:** `vitest.config.ts` excludes `**/index.ts` from coverage, which hides the re-export surface. More critically, `packages/tracer/src/graphify.ts` is never exercised by the existing tests, so it has 0% coverage despite being part of the package's public API.

### 4.4 API Design
- **Sync/async inconsistency:** `traceAgent` and `indepthAgent` are synchronous, while `TraceRuntime.log/readAll/clear` are async. Consumers cannot predict whether a call will block.
- **Leaky abstractions:** `index.ts` exports `JsonlWriter` and `TraceRuntime`, which are implementation details. A consumer importing `@glide/tracer` can reach into the writer and bypass the runtime contract.
- **Deprecated API without removal plan:** `createTracer` is marked `@deprecated` but remains in `index.ts` exports. There is no `tsconfig` `deprecation` warning enforcement.

---

## 5. Prioritized Fixes

### HIGH
1. **Implement git-blame integration for `traceAgent`** (`packages/tracer/src/tracer.ts:53–105`). Use `simple-git` (currently dead dependency) to map agent files to code lines and build the chain Architecture §2.2 requires: `code line → agent_id → parent_ids → Headroom session`.
2. **Add path traversal and input validation** (`packages/tracer/src/tracer.ts:53–105`). Validate `workspace` and `agentId` against path traversal. Add Zod schemas for all public inputs, replacing the bare `as string` casts in `mcp-server/src/tools/glide-tracer.ts:18–20`.
3. **Convert blocking I/O to async or worker-thread boundary** (`packages/tracer/src/tracer.ts:1–2, 53–105, 107–133`). Replace `existsSync`/`readFileSync`/`readdirSync` with `fs.promises` variants, or document a clear synchronous-only contract with explicit warnings for large workspaces.
4. **Remove dead dependencies or wire them up** (`packages/tracer/package.json:13–15`). Either import and use `@glide/core`, `simple-git`, and `zod`, or remove them. Dead dependencies violate the "no Daisy chain" principle and misrepresent the package's actual surface.

### MEDIUM
5. **Unify default log roots and document them** (`packages/tracer/src/trace-runtime.ts:26–28` and `jsonl-writer.ts:32–33`). Standardize on a single root (e.g., `.glide-sessions`) and expose it in the README.
6. **Fix `fsyncFile` to use writeable fd** (`packages/tracer/src/jsonl-writer.ts:86–97`). Open with `"r+"` or `"a"` so `fsync` flushes buffered writes.
7. **Add local test harness** (`packages/tracer/test/`). Move or mirror root tests into the package, update `package.json` scripts, and add graphify coverage tests to meet the repo's 80% line/function threshold.
8. **Restrict `index.ts` exports to public API** (`packages/tracer/src/index.ts:1–4`). Do not re-export `jsonl-writer` and `trace-runtime`; keep them internal.
9. **Add `REJECTED.md` and `sessionPath` to `AgentTrace`** (`packages/tracer/src/tracer.ts:6–14`). Align with Architecture §2.2 `glide_indepth` spec.

### LOW
10. **Add streaming JSONL parser** (`packages/tracer/src/jsonl-writer.ts:55–70`). For traces exceeding memory budgets, a line-by-line async reader prevents OOM.
11. **Enforce deprecation removal** (`packages/tracer/src/tracer.ts:168–173`). Schedule `createTracer` removal in the next minor version and update `index.ts`.
12. **Expand README** (`packages/tracer/README.md`). Document `TracerRuntime` options, `GraphifyClient`, correlation IDs, and file-rotation behavior.

---

## 6. Cross-Package Integration Gaps

| Consumer | File | Line(s) | Issue |
|----------|------|---------|-------|
| `@glide/mcp-server` | `packages/mcp-server/src/tools/glide-tracer.ts` | 3, 32, 44 | Imports `traceAgent`/`indepthAgent` directly from `@glide/tracer`. The MCP tool does not validate `workspace` or `agent_id` and passes raw strings to a filesystem-bound API. |
| `@glide/executor` | `packages/executor/package.json` | 16 | Declares `@glide/tracer` as a dependency but a repo-wide search shows no imports from `@glide/tracer` in executor source. This is an unused dependency in the opposite direction. |

---

## 7. Conclusion

`@glide/tracer` has the right **shape** for the architecture but is missing the **substance** the plan demands. The two critical omissions are (1) git-integrated code-line tracing via `simple-git`, and (2) validation/layering compliance via `@glide/core` and `zod`. Fixing the HIGH items above would bring tracer to a state where it could pass a production readiness review; the MEDIUM items are required before merging to `main`.
