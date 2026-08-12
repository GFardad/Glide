# Observability and Diagnostics Audit
_Generated for branch `main`_

## Executive Summary
Glide has a file-based tracing layer (`@glide/tracer`) and session event store (`session-events.jsonl`) with optional `traceId`/`spanId` correlation. However, the system lacks runtime metrics, structured error telemetry, health diagnostics, and non-blocking persistence. Most operational signals are either lost in sync I/O or locked in in-memory maps.

---

## Existing Telemetry Surface

| Layer | Mechanism | Location |
|---|---|---|
| Trace events | `TraceRuntime` → `JsonlWriter` (JSONL) | `packages/tracer/src/trace-runtime.ts:21` |
| Session events | `SessionEventWriter` (JSONL) | `packages/executor/src/session.ts:24` |
| Agent lifecycle | `SessionEventEmitter` emits `session_created/completed/failed/cancelled` | `packages/executor/src/executor.ts:188-256` |
| Headroom deltas | `headroom.apply_delta` trace log | `packages/headroom/src/runtime.ts:109-113` |
| MCP server | `logStderr()` JSON lines to stderr | `packages/mcp-server/src/server.ts:37-44` |

---

## Critical Gaps

### 1. No runtime metrics
There are no counters, gauges, or histograms for agent spawn rate, exit status distribution, tool latency, queue depth, or backpressure events.

- **File:** `packages/executor/src/executor.ts:165-260`
- **Impact:** Production incidents require log scraping instead of dashboards.
- **Fix:** Add a lightweight metrics primitive (e.g., in-memory histogram + JSONL metric snapshot) tracking `spawn_duration_ms`, `exit_code`, `stderr_bytes`, and `tool_latency_ms`.

### 2. Correlation IDs are not propagated to child processes
`traceId` and `spanId` are generated in `spawnAgent()` but never forwarded into the child process environment.

- **File:** `packages/executor/src/executor.ts:138-141` (generation)
- **File:** `packages/executor/src/executor.ts:165-170` (spawn env)
- **Impact:** Cannot join parent spans with child stdout/stderr/logs.
- **Fix:** Inject `GLIDE_TRACE_ID` / `GLIDE_SPAN_ID` into `options.env` when spawning.

### 3. Sync I/O blocks the event loop
`JsonlWriter.append()` and `SessionEventWriter.write()` use `writeFileSync` / `fsyncSync`.

- **File:** `packages/tracer/src/jsonl-writer.ts:38-53`
- **File:** `packages/executor/src/session.ts:42-55`
- **Impact:** High-throughput sessions or bursty tool calls can stall the Node event loop.
- **Fix:** Switch to async write with a bounded queue, or offload to a worker thread.

### 4. In-memory trace store is lost
`TracerRuntime.recordTrace()` stores entries in a `Map` that is never persisted.

- **File:** `packages/tracer/src/tracer.ts:28-31`, `135-145`
- **Impact:** `TracerRuntime.traceAgent()` calls `recordTrace()` but those records disappear on process exit.
- **Fix:** Either remove the in-memory store or flush it to the JSONL writer.

### 5. SessionEventEmitter defaults to disabled
`globalSessionEmitter` is enabled, but `SessionEventEmitter` defaults to `enabled: false`.

- **File:** `packages/executor/src/session.ts:210`
- **Impact:** Instances created without `enabled: true` silently drop all lifecycle events.
- **Fix:** Default to `true` in production, or fail fast with a warning when lifecycle events are dropped.

### 6. No structured error context in telemetry
Errors are logged as plain strings or JSON objects with minimal fields. `GlideError` carries a `code` and `cause` but nothing emits them.

- **File:** `packages/core/src/errors/index.ts:1-68`
- **File:** `packages/executor/src/executor.ts:188-203`
- **Impact:** Alerting on error categories is impossible without parsing messages.
- **Fix:** Include `error.code`, `error.name`, and truncated stack in session/trace events.

### 7. No health/readiness diagnostics
There is no endpoint, command, or tool to report runtime health (e.g., pending agents, queue depth, writer errors, disk full).

- **File:** `packages/mcp-server/src/server.ts`
- **File:** `packages/headroom/src/heartbeat.ts:27-76`
- **Impact:** Operators cannot distinguish "healthy but idle" from "stuck".
- **Fix:** Add a `diagnostics` or `health` tool exposing writer state, agent registry size, last tick timestamp, and rotation failures.

### 8. HeartbeatService has no self-observability
`HeartbeatService` persists heartbeat state but emits no metrics or events on missed ticks, scheduler failures, or goal load errors.

- **File:** `packages/headroom/src/heartbeat.ts:57-76`
- **Fix:** Emit `heartbeat.tick` events with duration and active-goal count; emit `heartbeat.missed_tick` when `tick()` is delayed.

### 9. MCP backpressure is logged but not surfaced
`writeMessage()` detects backpressure and logs to stderr, but the server continues without flow-control signaling.

- **File:** `packages/mcp-server/src/server.ts:46-57`
- **Fix:** Track backpressure count in a metric and consider pausing stdin reads when `stdout.write()` returns false.

### 10. No log aggregation or query API
Logs are append-only JSONL files with no index, query tool, or correlation search.

- **File:** `packages/executor/src/session.ts:57-81`
- **File:** `packages/tracer/src/trace-runtime.ts:47-49`
- **Fix:** Add a query helper that joins session and trace events by `traceId` / `sessionId`.

---

## Prioritized Fixes

| Priority | Item | File References |
|---|---|---|
| P0 | Propagate `traceId` / `spanId` into child process env | `executor.ts:138-170` |
| P0 | Add runtime metrics for spawn, exit, latency, backpressure | `executor.ts`, new `metrics.ts` |
| P0 | Emit structured error fields in session/trace events | `session.ts`, `trace-runtime.ts`, `errors/index.ts` |
| P1 | Replace sync JSONL writes with async queue | `jsonl-writer.ts`, `session.ts` |
| P1 | Add health/diagnostics tool | `mcp-server/src/tools/glide-status.ts` or new tool |
| P1 | Persist or remove in-memory `traceStore` | `tracer.ts:28-31`, `135-145` |
| P1 | Make `SessionEventEmitter` opt-out instead of opt-in | `session.ts:210` |
| P2 | Add heartbeat self-observability | `heartbeat.ts:57-76` |
| P2 | Surface backpressure as metric / flow control | `mcp-server/src/server.ts:46-57` |
| P2 | Add correlation-aware query API over JSONL | `tracer.ts`, `session.ts` |

---

## Risk Summary
Without metrics and correlation propagation, debugging production agent failures requires manual correlation across `.glide-sessions/*.jsonl` and `stderr`. The sync I/O path creates latency spikes under load. The disabled-by-default session emitter risks silent data loss in non-global contexts.
