# MCP Server Protocol Compliance Audit Report

## Summary
Audited `packages/mcp-server/src/**/*.ts` against MCP SDK v1.x spec and production-grade stdio server patterns. Found **23 compliance gaps and production-grade issues** across protocol lifecycle, JSON-RPC error codes, backpressure, timeout handling, security, and code quality.

---

## Critical Protocol Issues

### 1. Missing `notifications/initialized` send (server.ts:104-120)
**Severity**: CRITICAL
**Spec**: MCP Lifecycle
After responding to `initialize`, the server MUST send a `notifications/initialized` notification to the client. The `sendInitialized()` function at line 246-248 only sets a local boolean—it never transmits the notification. The client will hang waiting for this notification before sending normal requests.

```typescript
// server.ts:246-248
const sendInitialized = () => {
  initialized = true;  // BUG: never sends notifications/initialized
};
```

**Fix**: After writing the initialize response and awaiting drain, send:
```typescript
const initNotif = { jsonrpc: "2.0", method: "notifications/initialized" };
const wrote = writeMessage(stdout, initNotif);
if (!wrote) await waitDrain(stdout);
```

### 2. Responses sent for notifications (server.ts:53, 233-241)
**Severity**: CRITICAL
**Spec**: JSON-RPC 2.0 §2.2
Notifications (requests without `id`) must NOT receive responses. The code checks `isNotification` only for routing (line 53), but the catch-all at line 233 always writes an error response, even for unknown notifications.

```typescript
// server.ts:233-241
const wrote = writeMessage(stdout, {
  jsonrpc: "2.0",
  id: record.id,  // undefined for notifications
  error: { code: -32601, message: "Method not found" },
});
```

**Fix**: Check `typeof record.id === "undefined"` before writing response for unknown methods.

### 3. Unhandled rejection from timed-out tool (server.ts:198-206)
**Severity**: CRITICAL
**Pattern**: Production-grade timeout
`Promise.race` with a timeout creates a pending timeout promise that rejects even after the main operation completes. If the tool handler finishes before the timeout, the timeout rejection becomes unhandled.

```typescript
// server.ts:198-206
const result = await Promise.race([
  tool.handler(...),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(...)), REQUEST_TIMEOUT_MS)
  ),
]);
// After tool finishes, timeout still fires → unhandledRejection
```

**Fix**: Use a proper abort controller pattern or clear the timeout in a finally block:
```typescript
let timeoutId: NodeJS.Timeout;
try {
  const result = await Promise.race([
    tool.handler(...),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(...)), REQUEST_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timeoutId);
  return result;
} finally {
  clearTimeout(timeoutId);
}
```

### 4. Process exit without draining stdout (server.ts:138, 144, 298-306)
**Severity**: HIGH
**Pattern**: Production-grade stdio
On `shutdown` (line 138) and `exit` (line 144), the process exits after a fixed 50ms delay without checking if stdout has pending data. Signals (SIGINT/SIGTERM at lines 298-306) exit immediately with `process.exit(0)`, potentially losing in-flight responses.

**Fix**: Before exiting, await `waitDrain(stdout)` and then exit:
```typescript
if (!stdout.writableEnded) {
  await waitDrain(stdout);
}
process.exit(0);
```

---

## JSON-RPC Error Code Issues

### 5. Parse error should use `id: null` (server.ts:74-78)
**Severity**: MEDIUM
**Spec**: JSON-RPC 2.0 §5.1
Parse errors MUST use `id: null` when the request is too malformed to extract an id. The code correctly uses `id: null`, but the error object is missing the `data` field that MCP spec recommends for parse errors.

**Current**:
```typescript
error: { code: -32700, message: "Parse error" }
```
**Recommended**:
```typescript
error: { code: -32700, message: "Parse error", data: { raw: line.slice(0, 120) } }
```

### 6. HostBridge generates new id for parse errors (HostBridge.ts:104-108)
**Severity**: MEDIUM
**Spec**: JSON-RPC 2.0 §5.1
When creating an error response for a parse error (where `request` is null or has null id), `buildErrorResponse` generates a new id via `this.nextId++`. Per spec, parse errors MUST have `id: null`.

```typescript
// HostBridge.ts:104-108
const id = request && "id" in request
  ? (request as { id: string | number }).id
  : this.nextId++;  // BUG: should be null for parse errors
```

### 7. SDK handlers are dead code (server.ts:10-31)
**Severity**: HIGH
**Pattern**: Code correctness
The file imports and registers `Server` from `@modelcontextprotocol/sdk` and registers handlers (lines 11-31), but the `main()` function (lines 244-310) implements its own manual JSON-RPC parsing and routing. The SDK handlers are never invoked.

**Fix**: Either use the SDK's `server.listen()` and `server.connect()` methods, or remove the SDK import and handlers to avoid confusion.

---

## Backpressure Issues

### 8. Backpressure logged but not awaited in sequence (server.ts:41-62)
**Severity**: MEDIUM
**Pattern**: Production-grade stdio
The `writeMessage` function logs backpressure (line 49) and returns `false` when the write buffer is full. Callers await `waitDrain(stdout)`. However, there's no global ordering guarantee if multiple async handlers write concurrently. Since `processBuffer` is sequential (Node.js stream handlers don't interleave), this is partially mitigated, but the pattern is fragile.

**Fix**: Add a global write queue or use `stream.pipeline` semantics.

### 9. No backpressure handling for notifications (server.ts:122-125)
**Severity**: LOW
The `notifications/initialized` handler returns immediately without any write. This is correct since it's a notification from client to server, but if the server ever needs to send notifications, it would need backpressure handling.

---

## Concurrency & Initialization Issues

### 10. No initialization guard (server.ts:244-264)
**Severity**: HIGH
**Spec**: MCP Lifecycle
The server processes all requests immediately, even before receiving `initialize`. A well-behaved stdio server should buffer or reject requests until initialized. Currently, a client sending `tools/list` before `initialize` would get a response, but the spec-compliant behavior is to either buffer or return an error.

**Fix**: Add an `initialized` check in `processLine`:
```typescript
if (!initialized && record.method !== "initialize") {
  const wrote = writeMessage(stdout, {
    jsonrpc: "2.0",
    id: record.id ?? null,
    error: { code: -32000, message: "Server not initialized" },
  });
  if (!wrote) await waitDrain(stdout);
  return;
}
```

### 11. Race condition in data event handler (server.ts:267-270)
**Severity**: MEDIUM
**Pattern**: Node.js streams
While Node.js stream handlers are sequential, the `processBuffer` function is async and could yield control via `await`. If a new `data` event fires during an `await` (e.g., while waiting for `waitDrain`), the shared `buffer` variable could be modified by the new handler before the current one finishes.

**Fix**: Make `processBuffer` synchronous, or use a queue pattern.

---

## Security Issues

### 12. No path validation in file-writing tools (glide-build.ts, glide-ship.ts, glide-plan.ts, glide-review.ts, glide-test-tools.ts, glide-indepth.ts, glide-converge.ts)
**Severity**: HIGH
**Pattern**: Security
Tools accept `campaign_dir` and write files using `writeFileSync` and `mkdirSync` without validating the path. An attacker could supply `campaign_dir: "/etc/cron.d/malicious"` or `"../../.ssh/authorized_keys"` and write files outside the intended directory.

**Affected files**:
- glide-build.ts:6-9, 62
- glide-ship.ts:6-9, 64
- glide-plan.ts:6-9, 75
- glide-review.ts:6-9, 61
- glide-test-tools.ts:6-9, 59
- glide-indepth.ts:30-34
- glide-converge.ts:52-55

**Fix**: Validate and resolve paths:
```typescript
import { realpathSync } from "node:fs";
function validateCampaignDir(dir: string): string {
  const resolved = realpathSync(dir);
  if (!resolved.endsWith("campaign") && !resolved.includes("campaign")) {
    throw new Error("Invalid campaign directory");
  }
  return resolved;
}
```

### 13. No input sanitization in headroom tool (glide-headroom.ts:31-37)
**Severity**: MEDIUM
The `objective` parameter is passed directly to `runHeadroom` without sanitization. While this depends on `@glide/headroom` implementation, the MCP server should validate string lengths and characters.

---

## Type Safety & Code Quality Issues

### 14. Redundant type checks in tool handlers (glide-build.ts:32, 39; glide-ship.ts:33-39, 44; glide-test-tools.ts:32, 39)
**Severity**: LOW
Multiple tools check `typeof campaignDir !== "string"` twice in the same handler. The second check is dead code.

```typescript
// glide-build.ts:32, 39
if (typeof campaignDir !== "string" || !campaignDir.trim()) {
  throw new Error("campaign_dir is required");
}
// ... later ...
if (typeof campaignDir !== "string") {  // REDUNDANT
  throw new Error("campaign_dir is required");
}
```

### 15. Inconsistent error response format (glide-graph.ts:40-50, 118-128, etc.)
**Severity**: MEDIUM
Most tools return `{ ok: false, error: "..." }` on validation failures, but some return `isError: true` (glide-headroom.ts:53). The MCP spec expects structured errors via the `error` field on JSON-RPC responses, not custom `ok` fields. Validation errors should be thrown as exceptions so the server's catch block returns proper JSON-RPC errors.

### 16. tools/index.ts: Redundant exports (lines 1, 19-35)
**Severity**: LOW
The file uses `export *` from each tool module (lines 1, 3-17) and then re-imports and re-exports via named exports (lines 19-35). This is redundant and could cause issues if modules have side effects.

```typescript
export * from "./glide-goal.js";  // exports everything
import { glideGoalSetTool } from "./glide-goal.js";  // redundant
```

### 17. HostBridge.ts: `id` type mismatch (HostRequest type, line 14-19)
**Severity**: LOW
The `HostRequest` type requires `id: string | number`, but JSON-RPC 2.0 allows `id: null`. The `isHostRequestEnvelope` check at line 116-123 doesn't validate id type.

### 18. Missing `id` validation in server.ts (line 85)
**Severity**: LOW
The code casts `envelope` to `Record<string, unknown>` without validating that `id` is string/number/null. Invalid id types (boolean, object) would pass through.

---

## Production-Grade Pattern Issues

### 19. No structured logging (server.ts:37-39)
**Severity**: MEDIUM
`logStderr` prepends `[mcp]` but doesn't include timestamps, log levels, or request ids. Production stdio servers should use structured logging for debugging.

**Fix**:
```typescript
function logStderr(level: string, message: string, meta?: Record<string, unknown>): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }));
}
```

### 20. Fixed timeout not configurable (server.ts:8)
**Severity**: LOW
`REQUEST_TIMEOUT_MS = 120_000` is hardcoded. Production servers should allow configuration via environment variables or constructor options.

### 21. No graceful shutdown sequence (server.ts:138, 144)
**Severity**: MEDIUM
The `shutdown` request should trigger a graceful shutdown: stop accepting new requests, complete in-flight requests, then exit. Current implementation exits after 50ms regardless of state.

### 22. Missing `$_meta` and `structuredContent` support (server.ts:16-22)
**Severity**: LOW
Modern MCP SDK supports `$_meta` and `structuredContent` on tool definitions for richer client interactions. These are not utilized.

### 23. Duplicate tool definitions in server.ts (lines 16-22, 148-165)
**Severity**: MEDIUM
`tools/list` response is constructed identically in both the SDK handler and the manual handler. Since the SDK handler is dead code, this is dead code duplication.

---

## File-by-File Summary

| File | Issues | Severity |
|------|--------|----------|
| server.ts | 1, 2, 3, 4, 5, 7, 8, 10, 11, 19, 20, 21, 22, 23 | CRITICAL/MEDIUM |
| HostBridge.ts | 6, 17 | MEDIUM/LOW |
| tools/index.ts | 16 | LOW |
| glide-*.ts (tools) | 12, 13, 14, 15 | HIGH/LOW |

---

## Recommendations Priority

1. **P0**: Implement `notifications/initialized` send after initialize response
2. **P0**: Fix unhandled rejection in timeout race (use clearTimeout)
3. **P0**: Don't respond to notifications
4. **P1**: Add initialization guard (reject/buffer requests before initialize)
5. **P1**: Add path validation for all file-writing tools
6. **P1**: Await stdout drain before process exit
7. **P2**: Remove dead SDK handlers or switch to SDK-managed lifecycle
8. **P2**: Fix HostBridge id generation for parse errors
9. **P2**: Add structured logging with timestamps
10. **P3**: Remove redundant type checks and exports
