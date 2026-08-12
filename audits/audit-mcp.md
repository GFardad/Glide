# Audit: `packages/mcp-server` vs MCP Spec + Production-Grade Stdio Patterns

**Date**: 2026-08-11  
**Scope**: `packages/mcp-server/src/**/*.ts`  
**Baseline**: MCP SDK v1.x spec (`@modelcontextprotocol/sdk` v1.6.x), JSON-RPC 2.0, stdio server best practices.  
**Status**: audited; findings below with file:line references, gap descriptions, and prioritized fixes.

---

## Summary

| Severity | Count |
|---|---|
| P0 / Critical | 3 |
| P1 / High | 4 |
| P2 / Medium | 7 |
| P3 / Low | 6 |
| **Total** | **20** |

The most dangerous issues are protocol lifecycle violations (missing initialized notification, responses to notifications, unhandled rejections from timeouts) and path-write safety in file-system tools. Secondary issues are initialization ordering, shutdown draining, SDK dead-code, backpressure handling, and schema/typing correctness.

---

## P0 — Critical (fix first)

### 1. `notifications/initialized` is never sent
- **File**: `packages/mcp-server/src/server.ts:123`, `server.ts:251-253`
- **Gap**: MCP lifecycle requires the server to send `notifications/initialized` after responding to `initialize`. `sendInitialized` is a no-op that only sets a boolean; no JSON-RPC notification is written to stdout.
- **Impact**: Clients will wait indefinitely for this notification before issuing normal requests.
- **Fix**: After `initialize` response is written and drained, call `writeMessage(stdout, { jsonrpc: "2.0", method: "notifications/initialized" })`.

### 2. Responses written for notifications (unknown methods)
- **File**: `packages/mcp-server/src/server.ts:238-246`
- **Gap**: JSON-RPC 2.0 §2.2 forbids responses to notifications. The catch-all at line 238 always writes an error envelope using `record.id`, which is `undefined` for notifications.
- **Impact**: Protocol violation; some clients may disconnect or log errors.
- **Fix**: Guard with `typeof record.id !== "undefined"` before writing a response for the method-not-found fallback.

### 3. Unhandled rejection from tool timeout race
- **File**: `packages/mcp-server/src/server.ts:203-210`
- **Gap**: `Promise.race` includes a timeout promise with `setTimeout`, but the timer is never cleared. If the tool finishes before the timeout, the timer still fires, producing an unhandled rejection.
- **Impact**: Node.js will emit `unhandledRejection`, potentially crashing or destabilizing the process.
- **Fix**: Store the timeout handle in the surrounding scope and `clearTimeout` in a `finally` block or when the main handler resolves.

---

## P1 — High (fix soon)

### 4. No initialization guard before `initialize`
- **File**: `packages/mcp-server/src/server.ts:260-269`
- **Gap**: The server processes any incoming JSON-RPC line before receiving `initialize`. A well-behaved stdio MCP server should reject or buffer requests until initialized.
- **Impact**: Clients may observe unexpected behavior or error responses before the handshake completes.
- **Fix**: In `processLine`, return `-32000 Server not initialized` for any method other than `initialize` when `initialized === false`.

### 5. File-write tools lack path validation / sandboxing
- **Files / lines**:
  - `packages/mcp-server/src/tools/glide-plan.ts:66,83`
  - `packages/mcp-server/src/tools/glide-build.ts:49,70`
  - `packages/mcp-server/src/tools/glide-review.ts:51,69`
  - `packages/mcp-server/src/tools/glide-ship.ts:54,72`
  - `packages/mcp-server/src/tools/glide-test-tools.ts:49,67`
  - `packages/mcp-server/src/tools/glide-indepth.ts:30-33`
  - `packages/mcp-server/src/tools/glide-converge.ts:47,60-63`
- **Gap**: All these tools accept user-supplied directories and call `writeFileSync`/`mkdirSync` directly. Although `createPathGuard` is imported, it is not used in the artifact-writing path; therefore relative `../` escapes can write outside `campaign_dir`.
- **Impact**: Arbitrary file write if an untrusted client controls `campaign_dir`.
- **Fix**: Either use `guardWorkspace` against the resolved artifact directory, or validate `realpathSync` of `campaign_dir` before writing and ensure descendants stay inside allowed roots.

### 6. Process exits without draining stdout
- **File**: `packages/mcp-server/src/server.ts:143,149,303-311`
- **Gap**: `shutdown` and `exit` handlers terminate the process after a fixed 50 ms timeout; SIGINT/SIGTERM handlers call `process.exit(0)` immediately. None await pending stdout data.
- **Impact**: In-flight or queued tool responses can be truncated.
- **Fix**: Before `process.exit`, await `waitDrain(stdout)` (or check `stdout.writableEnded`/`writableNeedDrain`).

### 7. SDK registration is dead code / misleading
- **File**: `packages/mcp-server/src/server.ts:11-31`
- **Gap**: `createGlideServer()` constructs an `@modelcontextprotocol/sdk` `Server` and registers `ListToolsRequestSchema` and `CallToolRequestSchema` handlers, but the runtime in `main()` manually parses stdin and routes strings; SDK handlers are never invoked.
- **Impact**: Dead code; future maintainers may believe SDK-managed lifecycle is active.
- **Fix**: Choose one model: either wire `Server` into `main()` and let it consume stdin/stdout, or delete the SDK import and `createGlideServer()` to keep the manual stdio loop.

---

## P2 — Medium

### 8. Backpressure ordering is fragile
- **File**: `packages/mcp-server/src/server.ts:46-66`
- **Gap**: `writeMessage` logs backpressure and callers await `waitDrain`. If multiple async branches write concurrently, ordering is not serialized. Currently mitigated by sequential stream handling, but not guaranteed.
- **Fix**: Use a serial write queue around `stdout.write`.

### 9. Race condition in stream `data` handler
- **File**: `packages/mcp-server/src/server.ts:272-275`
- **Gap**: `processBuffer` is async and may yield at `await writeMessage`. A new `data` event could append to `buffer` before the current handler finishes, causing interleaved processing.
- **Fix**: Make `processBuffer` synchronous, or serialize with a single async queue draining on `data`.

### 10. `HostBridge.ts` fabricates IDs on parse errors
- **File**: `packages/mcp-server/src/bridge/HostBridge.ts:104-108`
- **Gap**: When building an error response for an invalid envelope/parse error, `buildErrorResponse` falls back to `this.nextId++`. JSON-RPC 2.0 §5.1 specifies parse errors must use `id: null`.
- **Fix**: Pass `null` explicitly for parse-error responses.

### 11. `HostRequest.id` excludes `null`
- **File**: `packages/mcp-server/src/bridge/types.ts:14-19`
- **Gap**: `HostRequest` types `id` as `string | number` only. JSON-RPC 2.0 permits `null`, and `server.ts` explicitly emits `id: null` for parse errors.
- **Fix**: Change to `id: string | number | null`.

### 12. Missing structured logging with metadata
- **File**: `packages/mcp-server/src/server.ts:37-44`
- **Gap**: `logStderr` emits JSON logs but without request id correlation, making debugging in production harder.
- **Fix**: Include `requestId`, `method`, and `durationMs` in log envelopes.

### 13. No graceful shutdown sequence
- **File**: `packages/mcp-server/src/server.ts:132-151`
- **Gap**: `shutdown` returns immediately; `exit` exits after 50 ms. There is no stop-accepting-new-requests or drain-inflight state.
- **Fix**: Introduce an `isShuttingDown` flag, reject new handlers, drain in-flight, then exit.

### 14. `tools/list` and `CallToolResult` return shape is not MCP-ideal
- **File**: `packages/mcp-server/src/server.ts:16-22`, `server.ts:29-31`, and all tool handlers returning `{ ok, ... }`
- **Gap**: The manual stdio server correctly maps tool outputs to `CallToolResult`, but the SDK-managed route in `createGlideServer()` would expect structured `content` arrays with `type: "text"` and does not set `isError` consistently. Several tools return `ok: false` as text content rather than structured errors.
- **Fix**: Standardize either throwing structured errors so the server catch block returns JSON-RPC error objects, or consistently return `CallToolResult` with `isError: true` when appropriate.

---

## P3 — Low

### 15. Hardcoded timeout constant
- **File**: `packages/mcp-server/src/server.ts:8`
- **Gap**: `REQUEST_TIMEOUT_MS = 120_000` cannot be tuned per deployment.
- **Fix**: Accept from env (`GLIDE_MCP_TOOL_TIMEOUT_MS`) with a sane default.

### 16. Redundant type checks in handlers
- **Files**: `glide-build.ts:32,39`, `glide-test-tools.ts:32,39`, `glide-ship.ts:33,39,44`
- **Gap**: `typeof x !== "string"` is checked twice in the same function; second branch is dead code.
- **Fix**: Remove redundant checks.

### 17. Redundant exports in `tools/index.ts`
- **File**: `packages/mcp-server/src/tools/index.ts:1-35`
- **Gap**: `export *` from each tool module and then manual named imports/exports for the same symbols. If modules gain side effects, behavior is unclear.
- **Fix**: Import explicitly and export only `tools`; remove `export *` lines.

### 18. Missing `$_meta` / `structuredContent` on tool definitions
- **File**: `packages/mcp-server/src/tools/types.ts`, all tool modules
- **Gap**: MCP SDK supports richer tool output via `$_meta` and `structuredContent`; unused here.
- **Fix**: Add optional `$_meta` if clients use it; document why it is omitted if not.

### 19. `glide-indepth.ts` writes to workspace without guard
- **File**: `packages/mcp-server/src/tools/glide-indepth.ts:30-33`
- **Gap**: Writes directly to `join(workspace, "runtime")` without `guardWorkspace`/`createPathGuard`.
- **Fix**: Apply path guard or restrict output directory to configured runtime root.

### 20. No integration tests / smoke tests for stdio lifecycle
- **Gap**: No `*.test.ts`, `*.spec.ts`, or stdio smoke harness found. The manual stdio loop has many edge cases; lack of tests increases regression risk.
- **Fix**: Add stdio smoke tests covering `initialize`, `initialized`, `tools/list`, `tools/call`, `shutdown`, `exit`, and bad-input paths.

---

## Production-Grade Stdio Server Checklist

| Check | Status | Location |
|---|---|---|
| Line-delimited JSON-RPC 2.0 framing | PASS | `server.ts:260-275` |
| Parse error `-32700` | PASS | `server.ts:79-87` |
| `id: null` on parse error | PARTIAL | `server.ts:81` correct; `HostBridge.ts:104-108` incorrect |
| No responses to notifications | FAIL | `server.ts:238-246` |
| `notifications/initialized` send | FAIL | `server.ts:123` / `251-253` |
| Request timeout with cleanup | FAIL | `server.ts:203-210` |
| Drain stdout before exit | FAIL | `server.ts:143,149,303-311` |
| Path validation for fs writes | FAIL | `glide-*.ts` tool files |
| Initialization guard | FAIL | `server.ts:260-269` |
| Tests | FAIL | no test files found |

---

## Recommended Priority Order

1. P0 Send `notifications/initialized`.
2. P0 Suppress response for unknown notification methods.
3. P0 Fix timeout race with `clearTimeout`.
4. P1 Add initialization guard rejecting uninitialized requests.
5. P1 Harden file-write paths in all artifact tools.
6. P1 Drain stdout before `process.exit`.
7. P2 Remove or integrate dead SDK handlers.
8. P2 Fix `HostBridge`/`HostRequest` ID typing for `null`.
9. P2 Add structured logging metadata.
10. P2 Remove redundant checks/exports and add stdio lifecycle tests.
