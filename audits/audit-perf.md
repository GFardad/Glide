# Glide Performance & Backpressure Audit

**Repo:** `/media/Storage/home-gfardad/Projects/Glide`  
**Branch:** `main`  
**Date:** 2026-08-11  
**Scope:** Critical path packages — `@glide/core`, `@glide/executor`, `@glide/tracer`, `@glide/headroom`, `@glide/permissions`, `@glide/mcp-server`, `@glide/dashboard`

## Executive Summary

The critical path is **dominated by synchronous, full-file read-modify-write cycles** with **no backpressure, no concurrency limits, and no batching**. Under realistic campaign sizes (50–200 agents, multi-megabyte JSONL traces), the event loop will stall on:

1. Unbounded file reads in `traceAgent` and `readAll`
2. Full-file rewrite on every agent mutation (`appendNote`, `markTodoDone`, `recordRejection`)
3. `fsync` on every JSONL append without rotation or async I/O
4. Busy-wait polling in `awaitAgent`
5. Unbounded child-process spawning with a global singleton registry

**Severity key:** HIGH | MEDIUM | LOW

---

## 1. Package-by-Package Findings

### 1.1 `packages/core` — I/O Foundation

#### HIGH — `atomicAppendFileSync` is O(n) per append due to full-file read

`packages/core/src/io/atomic-write.ts:48-80`

```ts
export function atomicAppendFileSync(filePath: string, content: string): void {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  // ... writes existing + content to temp file, fsyncs, renames
}
```

**Issue:** Every append reads the entire existing file into memory, writes it back plus one line, then fsyncs. For a 50 MB JSONL trace file, each append is a 50 MB read + 50 MB write. Throughput collapses linearly with file size.

**Fix:** Use append-mode write (`{ flag: "a" }`) plus periodic atomic rotation. Reserve full-file rewrite only for rotation boundaries.

#### MEDIUM — `atomicWriteFileSync` fsyncs twice per write

`packages/core/src/io/atomic-write.ts:9-41`

```ts
fsyncSync(fd);          // line 20 — temp file
// ...
const dirFd = openSync(dir, "r");
fsyncSync(dirFd);       // line 29 — directory metadata
```

**Issue:** Correct for crash safety, but synchronous double-fsync blocks the event loop for ~1–5 ms per write on ext4/XFS. At 100 writes/sec this alone consumes 10–50% of a single core.

**Fix:** Acceptable for durability-critical paths, but should not be used for high-frequency event logging.

---

### 1.2 `packages/executor` — Agent Runtime

#### HIGH — Full-file read-modify-write on every agent mutation

`packages/executor/src/runtime.ts:92-136`

```ts
export function appendNote(workspace, agentId, message): void {
  const path = join(workspace, "agents", agentId, "NOTES.md");
  writeFileSync(path, `${readFileSync(path, "utf8")}\n- [${timestamp}] ${message}\n`);
}

export function markTodoDone(workspace, agentId, todo): void {
  const current = readFileSync(path, "utf8");
  const updated = current.replace(normalized, done);
  writeFileSync(path, updated);
}

export function recordRejection(workspace, agentId, item, reason, rejectedBy): void {
  writeFileSync(path, `${readFileSync(path, "utf8")}\n- [${timestamp}] ${item} | Reason: ${reason}...\n`);
}
```

**Issue:** Every note/todo/rejection operation reads the entire file, modifies it in memory, and writes the entire file back. With 100 todos per agent and 50 agents, a single `markTodoDone` call can touch 10–50 KB of file I/O for a 100-byte change.

**Fix:** Use append-only JSONL or append-mode writes for NOTES/REJECTED. For TODO, use a separate JSONL index or line-based append with markdown regeneration on read.

#### HIGH — `loadAgentDirectory` reads 6 files synchronously per agent

`packages/executor/src/runtime.ts:79-91` and `packages/core/src/fs/agent-fs.ts:79-91`

```ts
export function loadAgentDirectory(workspace, agentId): AgentDirectory {
  const files = {
    personality: readFileSync(join(dir, "PERSONALITY.md"), "utf8"),
    goal: readFileSync(join(dir, "GOAL.md"), "utf8"),
    notes: readFileSync(join(dir, "NOTES.md"), "utf8"),
    todos: readFileSync(join(dir, "TODO.md"), "utf8"),
    rejected: readFileSync(join(dir, "REJECTED.md"), "utf8"),
    contract: readFileSync(join(dir, "contract.json"), "utf8"),
  };
}
```

**Issue:** Loading context for one agent requires 6 sequential filesystem calls. Tracing 10 agents = 60 sequential reads.

**Fix:** Cache directory listings and file stats; batch reads with `Promise.all` if async; consider a single JSONL index file for agent metadata.

#### HIGH — `validateAgentDirectory` reads and parses every required file

`packages/core/src/fs/agent-fs.ts:30-64`

```ts
for (const file of REQUIRED_AGENT_FILES) {
  const content = readFileSync(path, "utf8");
  // JSON.parse for contract.json
}
```

**Issue:** 6 files per agent, executed synchronously during validation. Becomes a noticeable stall when validating many agents.

#### MEDIUM — `listAgentDirectories` does repeated `existsSync` + `readdirSync`

`packages/core/src/fs/agent-fs.ts:107-118`

```ts
return readdirSync(teamsDir).flatMap((team) => {
  const agentsDir = join(teamsDir, team, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir).filter((entry) => {
    const full = join(agentsDir, entry);
    return existsSync(full) && REQUIRED_AGENT_FILES.every((file) => existsSync(join(full, file)));
  });
});
```

**Issue:** For N agents, this does 1 + N + 6N `existsSync` calls plus 2 `readdirSync` calls. All sequential.

**Fix:** Use a single `readdirSync` + in-memory set of required filenames to reduce syscalls.

#### HIGH — Busy-wait polling in `awaitAgent`

`packages/executor/src/executor.ts:280-318`

```ts
const check = () => {
  if (handle.status === AgentStatus.Completed || ...) {
    resolve({ handle, exitCode: handle.returnCode ?? null, ... });
  } else {
    setTimeout(check, 50);   // line 314 — polls every 50ms forever
  }
};
check();
```

**Issue:** Polls every 50ms with no backoff and no maximum wait unless `timeoutMs` is passed. For a 30-minute agent run, this fires 36,000 no-op timers. CPU-friendly but creates unnecessary timer pressure and prevents the caller from distinguishing "still running" from "stuck."

**Fix:** Use `child.waitExit()`/process `exit` event directly; only fall back to polling if needed. If polling, use exponential backoff.

#### MEDIUM — Unbounded child-process registry

`packages/executor/src/executor.ts:129-258`

```ts
private readonly agentRegistry = new Map<string, { child; killTimeoutMs }>();
// ...
this.agentRegistry.set(id, { child, killTimeoutMs: options.killTimeoutMs });
```

**Issue:** No limit on concurrent spawned agents. A single campaign can spawn hundreds of children, exhausting file descriptors or process slots. No queue, no semaphore, no backpressure signal to the caller.

**Fix:** Add a `maxConcurrency` option; use a semaphore or bounded queue. Return a `pending` handle if the limit is reached.

#### HIGH — Global mutable singleton `defaultExecutor`

`packages/executor/src/executor.ts:390-402`

```ts
const defaultExecutor = new ExecutorRuntime();
export function spawnAgent(options) { return defaultExecutor.spawnAgent(options); }
```

**Issue:** All campaigns in the same process share one registry. Cannot garbage-collect per-campaign state. Breaks multi-campaign isolation.

**Fix:** Export `ExecutorRuntime` as the public API; remove module-level singleton.

---

### 1.3 `packages/executor` — Session Events

#### HIGH — `SessionEventWriter.write` never calls `rotateIfNeeded`

`packages/executor/src/session.ts:42-55`

```ts
write(event: SessionEvent): void {
  const payload = { _seq: this.nextSequence++, ... };
  this.writer.append(payload);   // JsonlWriter handles rotation
}
```

**Wait** — `SessionEventWriter` delegates to `JsonlWriter`, which does call `rotateIfNeeded`. But:

`packages/executor/src/session.ts:100-133` defines its own `rotateIfNeeded` that is **never called**. This is dead code, but the more important issue is:

#### HIGH — `JsonlWriter.append` fsyncs on every single write

`packages/tracer/src/jsonl-writer.ts:38-53`

```ts
append(record: JsonlRecord): void {
  // ...
  this.rotateIfNeeded();
  writeFileSync(this.filePath, `${json}\n`, { flag: "a" });
  this.fsyncFile();    // opens fd, fsyncs, closes fd — every append
}
```

**Issue:** `fsyncFile` at line 86-97 opens a new file descriptor, calls `fsyncSync`, and closes it for **every single append**. This is the single largest per-operation overhead in the critical path.

**Fix:** Reuse a persistent file descriptor; fsync at interval or on rotation, not per-record.

#### MEDIUM — `readAll` loads entire JSONL into memory

`packages/tracer/src/jsonl-writer.ts:55-71` and `packages/executor/src/session.ts:57-81`

```ts
const raw = readFileSync(this.filePath, "utf8");
const lines = raw.split(/\r?\n/).filter(...);
for (const line of lines) {
  records.push(JSON.parse(line) as T);   // O(n) parse, no streaming
}
```

**Issue:** A 100 MB trace file is read entirely into a string, split into lines, and parsed line-by-line in a single synchronous block. This stalls the event loop for seconds.

**Fix:** Use `readline` module or `createReadStream` for streaming parse; support pagination by sequence number.

#### MEDIUM — Duplicate JSONL infrastructure

`packages/executor/src/session.ts` implements its own JSONL writer, rotation, and read-back. `packages/tracer/src/jsonl-writer.ts` has a separate implementation. They drift apart (different rotation logic, different fsync behavior).

**Fix:** Extract shared `JsonlWriter` to `@glide/core` and import from there in both packages.

#### MEDIUM — `SessionStore` is async facade over sync writer

`packages/executor/src/session.ts:174-197`

```ts
async upsert(handle: AgentHandle): Promise<void> {
  await this.writer.write({ ... });
}
```

**Issue:** `SessionEventWriter.write` is synchronous. The async signature gives a false impression of non-blocking I/O. Under load, every `upsert` call blocks the event loop despite `await`.

**Fix:** Make `SessionEventWriter.write` truly async using `fs.promises`.

---

### 1.4 `packages/tracer` — Agent Tracing

#### HIGH — `traceAgent` scans all agents' PERSONALITY.md files

`packages/tracer/src/tracer.ts:53-105`

```ts
traceAgent(options: { workspace, agentId, depth = 3 }): AgentTrace {
  // ...
  if (depth > 1) {
    for (const entry of readdirSync(agentsDir)) {     // line 78 — scans ALL agents
      const childPersonality = join(agentsDir, entry, "PERSONALITY.md");
      if (existsSync(childPersonality)) {
        const text = readFileSync(childPersonality, "utf8");  // reads full file
        const childParentMatch = text.match(/Parent:\s*([^\n]+)/);
        // ...
      }
    }
  }
}
```

**Issue:** To find children of one agent, the tracer reads **every agent's PERSONALITY.md** in the workspace. With 200 agents, this is 200 sequential `existsSync` + `readFileSync` calls. The `depth` parameter is also misleading — `depth > 1` means "scan all agents", not "recurse one level."

**Fix:** Maintain a parent-index file (e.g., `agents/index.json`) mapping parentId → [childIds]. Update it on agent creation. Traces become O(children) instead of O(all_agents).

#### MEDIUM — `TracerRuntime.traceStore` is an in-memory Map with no persistence bound

`packages/tracer/src/tracer.ts:27-31`

```ts
private readonly traceStore = new Map<
  string,
  { agentId; action; status; detail }[]
>();
```

**Issue:** Accumulates trace records in memory forever. No eviction, no size limit. Long-running campaigns leak memory.

**Fix:** Cap in-memory entries or flush to disk periodically.

---

### 1.5 `packages/headroom` — Goal & Snapshot Store

#### HIGH — `persistGoal` rewrites entire `goals.json` on every mutation

`packages/headroom/src/goal-store.ts:83-115`

```ts
export async function persistGoal(options, record): Promise<GoalRecord> {
  const goals = JSON.parse(readFileSync(goalsPath, "utf8"));
  // ... mutate in memory ...
  writeFileSync(goalsPath, JSON.stringify(goals, null, 2), "utf8");
}
```

**Issue:** Same pattern as executor — full read + full write for a single record update. With 10,000 goals this is a 100+ KB read/write per update.

**Fix:** Use JSONL append for history; use a JSON index file for current state, or switch to SQLite for random-access updates.

#### HIGH — `appendHistoryLine` uses bare `writeFileSync` with `{ flag: "a" }`

`packages/headroom/src/delta.ts:82-86`

```ts
export function appendHistoryLine(root: string, line: string): void {
  const path = resolveHistoryPath(root);
  writeFileSync(path, line + "\n", { flag: "a" });
}
```

**Issue:** No fsync, no rotation, no atomicity. A crash during write can truncate or corrupt the history file. The `headroom` package claims snapshot durability but doesn't fsync.

**Fix:** Use `appendFileSync` + `fsyncPath`, or adopt the shared `JsonlWriter` with rotation.

#### MEDIUM — `loadLatestSnapshot` and `loadSnapshot` read entire history into memory

`packages/headroom/src/delta.ts:88-135`

```ts
export function readHistoryLines(root: string): string[] {
  const raw = readFileSync(path, "utf8");
  return raw.split("\n").map(...).filter(...);
}

export function loadLatestSnapshot(root: string): HeadroomSnapshot | undefined {
  const lines = readHistoryLines(root);
  for (let i = lines.length - 1; i >= 0; i--) {
    // JSON.parse every line until finding valid snapshot
  }
}
```

**Issue:** Reads the entire history file for every snapshot load. `loadLatestSnapshot` parses lines from the end but still loads everything. `loadSnapshot` scans from the beginning.

**Fix:** Maintain a `latest.json` pointer file; use `readline` streaming for historical queries.

---

### 1.6 `packages/mcp-server` — Protocol Transport

#### MEDIUM — MCP server has backpressure for stdout but not stdin

`packages/mcp-server/src/server.ts:46-67`

```ts
function writeMessage(stdout, envelope): boolean {
  const wrote = stdout.write(message);
  if (!wrote) logStderr(`backpressure active for method=...`);
  return wrote;
}
function waitDrain(stdout): Promise<void> {
  return new Promise((resolve) => {
    if (typeof stdout.once === "function") {
      stdout.once("drain", () => resolve());
    } else { resolve(); }
  });
}
```

**Issue:** Stdout backpressure is handled correctly — `writeMessage` returns `false` when the internal buffer is full, and callers `await waitDrain(stdout)`. However, **stdin reads are fire-and-forget**:

`server.ts:272-275`
```ts
stdin.on("data", async (chunk: string) => {
  buffer += chunk;
  await processBuffer();    // no backpressure; if processing lags, buffer grows unbounded
});
```

**Fix:** Pause stdin stream if buffer exceeds a threshold; resume after processing drains.

#### MEDIUM — CLI spawns MCP server per command with 10-second timeout

`packages/cli/src/cli.ts:372-442`

```ts
async function callTool(name, args): Promise<JsonRpcEnvelope> {
  const child = spawn("node", [findMcpServer()], { stdio: ["pipe", "pipe", "inherit"] });
  // ...
  const timeout = setTimeout(() => {
    reject(new Error(`Timeout waiting for response to id=${expectedId}`));
  }, 10000);
}
```

**Issue:** Every CLI command spawns a new Node process, initializes the MCP server, calls the tool, and kills the process. Startup overhead is ~200-500ms per call. The 10-second timeout is hard-coded; long-running tools like `glide_headroom` or `glide_trace` will fail.

**Fix:** Reuse a long-lived MCP server process; make timeout configurable per command.

---

### 1.7 `packages/dashboard` — Campaign Listing

#### LOW — `listCampaigns` does repeated `existsSync` + `statSync` per campaign

`packages/dashboard/src/generator.ts:57-103`

```ts
function listArtifacts(root: string): DashboardArtifact[] {
  return readdirSync(artifactsDir)
    .map((name) => {
      const stats = statSync(path);   // stat per artifact file
      return { name, path, size: stats.size, modifiedAt: new Date(stats.mtimeMs) };
    })
```

**Issue:** Sequential `statSync` per artifact. With 500 artifacts across 20 campaigns, this is 500 sequential syscalls.

**Fix:** Use `opendir` + batch stat, or accept that dashboard generation is infrequent and not critical-path.

---

## 2. Cross-Cutting Issues

### 2.1 Synchronous I/O Everywhere

Almost every package uses `readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync` in the hot path. The event loop is blocked on every filesystem call. There is no use of `fs.promises`, `createReadStream`, `readline`, or worker threads.

**Impact:** Latency is dominated by disk I/O syscalls. Concurrent operations cannot overlap. A single slow disk (NFS, HDD, encrypted filesystem) stalls all Glide operations.

**Fix Priority:** HIGH — Migrate hot paths to `fs.promises` with `Promise.all` for parallel reads.

### 2.2 No Backpressure or Flow Control

There is no queue, semaphore, or backpressure mechanism anywhere in the critical path:

- Agent spawning is unbounded (`executor.ts:129`)
- File mutations are unbounded (any number of concurrent `appendNote` calls)
- JSONL appends are unbounded (`jsonl-writer.ts:38`)
- MCP stdin buffer is unbounded (`server.ts:272`)
- CLI has no retry or circuit-breaker

**Impact:** A burst of 100 concurrent tool calls will spawn 100 processes, open 100+ file descriptors, and attempt 100+ simultaneous disk writes. The process will hit EMFILE or stall the event loop.

**Fix Priority:** HIGH — Add bounded concurrency at the MCP server tool handler level and the executor runtime level.

### 2.3 fsync on Every Write

`jsonl-writer.ts:86-97`, `atomic-write.ts:20,29`, and `goal-store.ts` (implicit via `writeFileSync` on some paths) all fsync on every operation.

**Impact:** fsync on ext4 with `data=ordered` is typically 1-5 ms. At 50 appends/sec, this is 50-250 ms/sec of pure fsync overhead — 5-25% of a CPU core.

**Fix Priority:** MEDIUM — Batch fsyncs: fsync every N records or every T milliseconds. Use `O_SYNC` file descriptors for critical paths.

### 2.4 Dead / Unreachable Code

- `packages/executor/src/session.ts:100-133` `rotateIfNeeded` is defined async but never called
- `packages/executor/src/session.ts:150-153` `replayAsStream` is identical to `replay`
- `packages/tracer/src/tracer.ts:28-31` `traceStore` Map grows forever with no eviction

**Fix Priority:** LOW — Remove dead code or wire it into the active path.

---

## 3. Prioritized Fixes

| # | Severity | Package | File:Line | Issue | Recommendation |
|---|----------|---------|-----------|-------|----------------|
| 1 | HIGH | `@glide/executor` | `runtime.ts:92-136` | Full-file RMW on every note/todo/rejection | Use append-mode or JSONL for mutations; regenerate markdown on read |
| 2 | HIGH | `@glide/tracer` | `tracer.ts:74-92` | `traceAgent` scans ALL agents' PERSONALITY.md | Maintain parent-index file; make child lookup O(children) |
| 3 | HIGH | `@glide/executor` | `session.ts` + `jsonl-writer.ts` | `fsyncFile` opens/closes fd on every append | Reuse persistent fd; batch fsyncs |
| 4 | HIGH | `@glide/mcp-server` | `server.ts:272-275` | Unbounded stdin buffer growth | Pause stdin when buffer exceeds threshold |
| 5 | HIGH | `@glide/executor` | `executor.ts:129,390` | Unbounded agent registry + global singleton | Add `maxConcurrency`; remove `defaultExecutor` |
| 6 | HIGH | `@glide/executor` | `executor.ts:280-318` | Busy-wait `setTimeout(check, 50)` polling | Use process `exit` event; add exponential backoff |
| 7 | HIGH | `@glide/headroom` | `goal-store.ts:83-115` | Full `goals.json` rewrite per mutation | Switch to JSONL append + periodic compaction; or SQLite |
| 8 | MEDIUM | `@glide/core` | `atomic-write.ts:48-80` | `atomicAppendFileSync` is O(n) per append | Use append-mode + periodic rotation instead |
| 9 | MEDIUM | `@glide/tracer` + `@glide/executor` | `jsonl-writer.ts:55-71`, `session.ts:57-81` | `readAll` loads entire file + parses synchronously | Stream with `readline`; support pagination |
| 10 | MEDIUM | `@glide/mcp-server` | `cli.ts:372-442` | CLI spawns new process per command with 10s timeout | Reuse long-lived server; make timeout configurable |
| 11 | MEDIUM | `@glide/headroom` | `delta.ts:82-86` | `appendHistoryLine` has no fsync/rotation | Adopt shared `JsonlWriter` with fsync + rotation |
| 12 | MEDIUM | `@glide/executor` | `runtime.ts:79-91` | `loadAgentDirectory` reads 6 files per agent | Cache metadata; batch reads |
| 13 | MEDIUM | `@glide/core` + `@glide/executor` | `agent-fs.ts:107-118` | `listAgentDirectories` does 7N+2 syscalls | Single `readdir` + in-memory filter |
| 14 | MEDIUM | All packages | Various | Sync I/O in hot paths | Migrate to `fs.promises` + `Promise.all` for parallel ops |
| 15 | LOW | `@glide/executor` | `session.ts:100-133` | Dead `rotateIfNeeded` in `SessionEventWriter` | Delete or wire into `write` |
| 16 | LOW | `@glide/tracer` | `tracer.ts:28-31` | `traceStore` Map grows forever | Cap size or flush to disk |

---

## 4. Throughput Estimates (Current vs. Target)

| Operation | Current (est.) | Target (est.) | Bottleneck |
|-----------|---------------|---------------|------------|
| `appendNote` (1 line) | ~2 ms (read 10 KB + write 10 KB) | ~0.1 ms (append 100 B) | Full-file RMW |
| `traceAgent` (200 agents) | ~400 ms (200 reads + scans) | ~5 ms (index lookup) | O(N) personality scan |
| `readAll` (10 MB JSONL) | ~1500 ms (read + split + parse) | ~200 ms (streaming parse) | Synchronous full-file parse |
| `persistGoal` | ~3 ms (read + write 50 KB) | ~0.5 ms (JSONL append) | Full-file rewrite |
| `awaitAgent` (30 min run) | 36,000 timer firings | 0 (event-driven) | Polling |

---

## 5. Recommended Work Order

1. **Immediate (1–2 days):**
   - Replace `traceAgent` child lookup with a parent-index file
   - Add `maxConcurrency` to `ExecutorRuntime`
   - Fix `awaitAgent` to use process `exit` event instead of polling
   - Remove global `defaultExecutor` singleton

2. **Short-term (1 week):**
   - Migrate agent mutations (`appendNote`, `markTodoDone`, `recordRejection`) to append-only JSONL
   - Replace per-record `fsync` in `JsonlWriter` with batched fsync
   - Add stdin backpressure in MCP server
   - Switch CLI to long-lived MCP server process

3. **Medium-term (2–4 weeks):**
   - Migrate hot-path I/O to `fs.promises`
   - Implement streaming `readAll` with `readline`
   - Replace `goals.json` full-file rewrite with JSONL + compaction
   - Extract shared JSONL writer to `@glide/core`
