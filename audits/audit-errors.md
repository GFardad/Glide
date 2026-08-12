# Error Handling Robustness Audit

Scope: `packages/**/*.ts` (source only). Date: 2026-08-11.  
Focus: unhandled error paths, silent failures, missing context/cause chains, and process-lifecycle safety.

---

## 1. Silent JSON parse swallowing loses diagnosability

- `packages/executor/src/executor.ts:41-61`
- `packages/executor/src/session.ts:64-78`
- `packages/tracer/src/jsonl-writer.ts:64-67`

**Finding:** Malformed JSON lines are skipped with an empty `catch`, no logging, no count, no bad-line sample.  
**Impact:** Corrupt trace/session files silently drop data; debugging becomes guesswork.  
**Fix:** Log malformed-line count + first N offending bytes to stderr/trace; in session replay, surface parse warnings in `SessionEventWriter.readAll()`.

---

## 2. Best-effort session logging swallows all errors, including programming errors

- `packages/executor/src/executor.ts:198-255, 226-244, 249-255`
- `packages/executor/src/executor.ts:328-334`

**Finding:** `sessionEmitter.*` and `removeIpcPath()` use empty `catch {}` blocks.  
**Impact:** Real bugs in session persistence/emission (serialization bugs, permission errors, disk-full) are hidden.  
**Fix:** Catch only expected I/O/emit errors; log unexpected ones. Example: `catch (err) { if (isExpected(err)) ... else logStderr(...) }`.

---

## 3. `createIpcPath` writes empty file without validating path safety

- `packages/executor/src/executor.ts:322-326`

**Finding:** `writeFileSync(path, "")` on user-controlled `baseDir/handleId` with no path guard.  
**Impact:** Path traversal / symlink attack surface on IPC file creation.  
**Fix:** Reuse `resolveAndValidatePath()` from `packages/core/src/security/path-guard.ts` and enforce allowed roots.

---

## 4. `SessionEventWriter` unsafely casts parsed JSON fields

- `packages/executor/src/session.ts:66-75`

**Finding:** `String(record._ts ?? record.timestamp ?? ...)` coerces non-string values silently; payload type is `Record<string, unknown>`.  
**Impact:** Corrupt events produce misleading timestamps/handles rather than errors.  
**Fix:** Validate required fields with a schema (zod) and skip/reject invalid records with a logged reason.

---

## 5. `JsonlWriter` append can lose data on directory/fsync failure

- `packages/core/src/io/atomic-write.ts:48-80`
- `packages/tracer/src/jsonl-writer.ts` delegates to append path

**Finding:** `atomicAppendFileSync` rewrites the entire existing file for each append; any fsync/rename failure throws, but callers don’t always retry.  
**Impact:** High-throughput trace/session paths can throw and drop events under load.  
**Fix:** Add bounded retry with backoff for rename/fsync errors; avoid full-file rewrite append if possible.

---

## 6. `resumeAgent` returns a Pending handle with no actual resume state

- `packages/executor/src/executor.ts:338-367`

**Finding:** `resumeAgent` loads events, finds last unfinished event, and returns a `Pending` handle without reconstructing real runtime state.  
**Impact:** Consumers may treat it as resumable and never recover prior context.  
**Fix:** Either implement true state restore or return `null`/`AgentNotFoundError` and document non-resumability.

---

## 7. `runHeadroom` does no I/O error handling for artifact writes

- `packages/headroom/src/headroom.ts:70-76`

**Finding:** Four `writeFileSync` calls with no try/catch. Any disk/permission error aborts the whole operation after partial artifacts.  
**Impact:** Partial campaign state, unclear failure mode.  
**Fix:** Wrap artifact writes in try/catch, cleanup partial artifacts, and surface `CampaignSchemaError`/`IOError` with path context.

---

## 8. `main().catch` in CLI and MCP server conflates fatal/logging paths

- `packages/cli/src/cli.ts:727-730`
- `packages/mcp-server/src/index.ts:5-10`
- `packages/mcp-server/src/server.ts:317-321`

**Finding:** Top-level catch prints `err` then `process.exit(1)`, but MCP server also has `SIGINT/SIGTERM` handlers calling `process.exit(0)` without flushing.  
**Impact:** In-flight tool calls / trace writes can be lost on shutdown; CLI exits with stack trace instead of structured error.  
**Fix:** Use a centralized shutdown hook that flushes writers, then exits with mapped code; CLI should emit structured JSON error object.

---

## 9. Tool handlers often return degraded results instead of surfacing errors

- `packages/mcp-server/src/tools/glide-status.ts:37-40`
- `packages/mcp-server/src/tools/glide-graph.ts:317-320`
- `packages/mcp-server/src/tools/glide-tracer.ts:36-39`

**Finding:** Errors are caught and converted to `available: false` / `ok: false` envelopes without preserving stack/cause.  
**Impact:** Operators see “graphify unavailable” but not why; correlating failures across tools is hard.  
**Fix:** Include `error.code`, `error.message`, and optional `error.cause?.message` in response envelope.

---

## 10. `PathGuard.checkSymlinkPath` hides symlink resolution failures

- `packages/core/src/security/path-guard.ts:46-63`

**Finding:** Non-`PathGuardError` exceptions from `statSync`/`realpathSync` are ignored with a comment “ignore ENOENT”.  
**Impact:** Permission errors or transient FS issues during symlink checks are silently ignored.  
**Fix:** Re-throw unless `err.code === 'ENOENT'`; log others.

---

## 11. `plugin-api` registry resource-limit check swallows non-plugin errors

- `packages/plugin-api/src/registry.ts:84-98`

**Finding:** `process.memoryUsage()` call is inside try/catch; if it throws, all resource-limit checks are skipped.  
**Impact:** A plugin can exceed memory limits without detection if Node internals throw.  
**Fix:** Catch only expected measurement errors and fall back to denying the operation or disabling limits with a logged warning.

---

## 12. Missing input validation in MCP server `processLine`

- `packages/mcp-server/src/server.ts:90-105`

**Finding:** `record.id` is used without validating type; `record.params` cast to `Record<string, unknown>` without schema check before `params?.name`.  
**Impact:** Invalid JSON-RPC envelopes can cause type confusion rather than `Invalid Request` errors.  
**Fix:** Validate envelope shape with zod/type guards before dispatching.

---

## 13. `detectDrift` returns `true` for empty objective, masking artifact generation failures

- `packages/headroom/src/headroom.ts:156-161`

**Finding:** Empty objective => drift=true. Caller may interpret drift as a normal condition and continue.  
**Impact:** Silent acceptance of invalid headroom runs.  
**Fix:** Validate objective at entry and throw `HeadroomInputError` if empty.

---

## Prioritized Fixes

| Priority | Item | Reason |
|---|---|---|
| P0 | #3 IPC path traversal | Security boundary |
| P0 | #8 shutdown/data loss | Data integrity / correctness |
| P1 | #1 silent JSON parse loss | Observability |
| P1 | #7 artifact write failure | Partial state / correctness |
| P1 | #2 session logging swallow | Hidden bugs |
| P2 | #4 unsafe JSON casts | Data integrity |
| P2 | #5 append/fsync resilience | Throughput reliability |
| P2 | #9 degraded tool errors | Operability |
| P3 | #10 symlink error swallowing | Security hardening |
| P3 | #11 resource-limit skip | Plugin isolation |
| P3 | #12 input validation gap | Robustness |
| P3 | #13 empty objective drift | Correctness |

---

## Recommendations

1. Adopt a small shared error formatter (`packages/core/src/errors/index.ts`) and use `cause` chaining everywhere.
2. Replace empty `catch {}` with either `catchAndLog()` helper or explicit expected-error handling.
3. Add integration tests that inject malformed JSONL, permission errors, and shutdown signals to verify behavior.
