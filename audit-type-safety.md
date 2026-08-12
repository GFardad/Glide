# Glide Type Safety Audit

Date: 2026-08-11
Scope: `/media/Storage/home-gfardad/Projects/Glide` — all `.ts` source files
Config: strict=true, noUncheckedIndexedAccess=true, exactOptionalPropertyTypes=true

## Executive Summary

- `tsc --build` passes with no errors.
- The codebase already enforces strict TypeScript mode; the remaining risks are design-level rather than compiler-level.
- Dominant pattern: widespread use of `Record<string, unknown>` and `unknown` at JSON-RPC boundaries, plus repeated unsafe casts from parsed JSON.

---

## High-Impact Findings

### 1. `GlideToolHandler` typed entirely as `Record<string, unknown>`

**Files:**
- `packages/mcp-server/src/tools/types.ts:3-5`
- `packages/mcp-server/src/tools/glide-status.ts:14`
- `packages/mcp-server/src/tools/glide-trace.ts:20`
- `packages/mcp-server/src/tools/glide-review.ts:30`
- `packages/mcp-server/src/tools/glide-executor.ts:34`
- `packages/mcp-server/src/tools/glide-goal.ts:16,49`
- `packages/mcp-server/src/tools/glide-permissions.ts:22`
- `packages/mcp-server/src/tools/glide-gates.ts:23`
- `packages/mcp-server/src/tools/glide-build.ts:30`
- `packages/mcp-server/src/tools/glide-ship.ts:30`
- `packages/mcp-server/src/tools/glide-converge.ts:35`
- `packages/mcp-server/src/tools/glide-headroom.ts:31`
- `packages/mcp-server/src/tools/glide-indepth.ts:18`
- `packages/mcp-server/src/tools/glide-plan.ts:44`
- `packages/mcp-server/src/tools/glide-test-tools.ts:30`
- `packages/mcp-server/src/tools/glide-tracer.ts:17`
- `packages/mcp-server/src/tools/glide-graph.ts:35`

**Issue:** Every tool handler accepts `args: Record<string, unknown>`. The handler body then performs manual runtime casts like `args["workspace"] as string | undefined`. This shifts all argument validation to runtime and prevents IDE autocomplete, refactoring safety, and compile-time schema checking.

**Suggested stronger type:**
```ts
// types.ts
export interface GlideToolArgs {
  [key: string]: unknown;
}

export type GlideToolHandler<TArgs extends GlideToolArgs = GlideToolArgs> = (
  args: TArgs
) => Promise<CallToolResult> | CallToolResult;

export interface GlideTool<TArgs extends GlideToolArgs = GlideToolArgs> {
  name: string;
  description: string;
  inputSchema: { ... };
  handler: GlideToolHandler<TArgs>;
}

// per-tool example
interface GlideStatusArgs extends GlideToolArgs {
  project_path?: string;
}
handler: async (args: GlideStatusArgs): Promise<CallToolResult> => {
  const projectPath = args.project_path;
  // ...
}
```

---

### 2. `Server.setRequestHandler` callback typed as `any`

**File:** `packages/mcp-server/src/server.ts:24`

**Issue:** The SDK's `setRequestHandler` is not generic in this version, so the `request` parameter is `any`. Accessing `request.params.name` and `request.params.arguments` is therefore unchecked at compile time.

**Suggested stronger type:**
```ts
import type { CallToolRequest, ListToolsRequest } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListToolsRequestSchema, async (request: ListToolsRequest) => ({ ... }));
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => { ... });
```

---

### 3. Unsafe `as Record<string, unknown>` casts from `JSON.parse`

**Files:**
- `packages/mcp-server/src/server.ts:30,43,85,168,199`
- `packages/mcp-server/src/bridge/HostBridge.ts:52,121`
- `packages/headroom/src/goal-store.ts:81,151,157,178,184`
- `packages/executor/src/executor.ts:24`
- `packages/tracer/src/graphify.ts:99`
- `packages/plugin-api/src/durability.ts:61,67`
- `packages/headroom/src/delta.ts:81`
- `packages/permissions/src/gates.ts:79,80,109`

**Issue:** After `JSON.parse`, the result is `any`. Casting directly to `Record<string, unknown>` trusts the payload shape without runtime validation. A malformed or unexpected payload silently bypasses type checking.

**Suggested stronger pattern:**
```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const parsed = JSON.parse(line);
if (!isRecord(parsed)) {
  // handle invalid payload explicitly
}
const record = parsed;
```

---

### 4. `readJsonIfExists` return type mismatch

**File:** `packages/permissions/src/gates.ts:57-62`

**Issue:** Signature says `unknown`, but the function returns `null` when the file is missing or not a file. Callers then do `if (!spec || !plan)` which works at runtime but conflates `null`, `undefined`, and malformed JSON.

**Suggested stronger type:**
```ts
function readJsonIfExists(path: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!existsSync(path)) return { ok: false, error: "missing" };
  const stat = statSync(path);
  if (!stat.isFile()) return { ok: false, error: "not a file" };
  try {
    const raw = readFileSync(path, "utf8");
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "parse error" };
  }
}
```

---

## Medium-Impact Findings

### 5. Empty `catch` blocks swallow errors silently

**Files:**
- `packages/mcp-server/src/tools/glide-trace.ts:85-87`
- `packages/mcp-server/src/server.ts:218-230` (logs but no typed error)

**Issue:** `catch { }` or broad `catch (error)` without surfacing the error type loses failure context. In `glide-trace`, graphify failures are silently ignored, which is intentional, but the swallowed error should be logged.

**Suggested stronger type:**
```ts
} catch (error: unknown) {
  logStderr(`graphify_failed agentId=${agentId} error=${error instanceof Error ? error.message : String(error)}`);
}
```

---

### 6. `HostBridge` and `HostRequest` generic parameters default to `unknown`

**File:** `packages/mcp-server/src/bridge/types.ts:14,21,27,38,41,45`

**Issue:** The generic defaults are `unknown`, and in `HostBridge.ts:22,24` the instantiation is `HostRoute<unknown, unknown>`. This makes every host request/response untyped. While this matches JSON-RPC's dynamic nature, the bridge is internal and could use a stronger shared envelope type.

**Suggested stronger type:**
```ts
export interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}
export interface HostRequest<TParams = JsonRpcEnvelope["params"]> { ... }
```

---

### 7. `GoalStoreOptions.database` typed as `unknown`

**File:** `packages/headroom/src/goal-store.ts:7`

**Issue:** The optional `database` is `unknown`, then cast to `DatabaseLike` at line 31. This is a public API surface; accepting `unknown` lets callers pass anything.

**Suggested stronger type:**
```ts
export interface GoalStoreOptions {
  root: string;
  database?: DatabaseLike;
}
```

---

### 8. `createRequestEnvelope` returns unvalidated request shape

**File:** `packages/mcp-server/src/bridge/HostBridge.ts:89-98`

**Issue:** `createRequestEnvelope` builds a `HostRequest<unknown>` but the generic parameter stays `unknown`, and the cast at line 52 is unvalidated.

**Suggested stronger type:** Use a specific params type or at minimum `HostRequest<Record<string, unknown>>`.

---

### 9. `Gate` handler accepts broad context shape

**File:** `packages/permissions/src/gates.ts:18-21`

**Issue:** The `Gate` interface defines `handler: (ctx: { workspace: string; plan?: string; tasks?: string[] }) => GateResult`, but `readJsonIfExists` returns `unknown`, forcing casts at lines 79, 80, and 109 before use.

**Suggested stronger type:** Make `readJsonIfExists` return a typed artifact, or validate the parsed JSON against a known schema.

---

### 10. `payload` fields typed as `Record<string, unknown>`

**Files:**
- `packages/executor/src/session.ts:19,155`
- `packages/executor/src/executor.ts:24`
- `packages/plugin-api/src/session.ts:23`
- `packages/plugin-api/src/composition.ts:15,59,160`
- `packages/plugin-api/src/types.ts:20,26`
- `packages/core/src/goal.ts:19`
- `packages/mcp-server/src/tools/glide-executor.ts:39`

**Issue:** Payloads and metadata are generic maps. While JSON is inherently untyped, these are internal contract boundaries that could use specific interfaces instead of open-ended records.

---

## Low-Impact / Informational

| File | Line | Note |
|------|------|------|
| `packages/cli/src/cli.ts` | 28 | `params?: Record<string, unknown>` — CLI args are dynamic; acceptable if validated before use. |
| `packages/tracer/src/jsonl-writer.ts` | 21 | `[key: string]: unknown` index signature — appropriate for JSONL rows. |
| `packages/headroom/src/delta.ts` | 30,58 | `metadata?: Record<string, unknown>` — matches `GoalRecord` shape. |
| `packages/dashboard/src/live.ts` | 57-58 | `toDate(value: unknown): Date | undefined` — correct use of `unknown` for coercion. |
| `packages/mcp-server/src/index.ts` | 6 | `main().catch((err: unknown) => { ... })` — correct typed catch binding. |

---

## Recommendations

1. **Introduce per-tool argument interfaces** typed from each tool's `inputSchema.properties`. This is the highest-value change.
2. **Add a runtime validation layer** for parsed JSON (e.g., `zod` or simple type-guard functions) at RPC boundaries instead of `as Record<string, unknown>`.
3. **Fix `readJsonIfExists` return type** to distinguish "missing" from "present but unknown shape."
4. **Type the MCP SDK request handlers** if the SDK version supports generics; otherwise wrap them in typed adapters.
5. **Replace `database?: unknown`** with the actual `DatabaseLike` interface in `GoalStoreOptions`.

---

## Files Reviewed

- `packages/mcp-server/src/tools/*.ts` (16 tool files)
- `packages/mcp-server/src/server.ts`
- `packages/mcp-server/src/bridge/*.ts`
- `packages/headroom/src/goal-store.ts`
- `packages/permissions/src/gates.ts`
- `packages/executor/src/*.ts`
- `packages/core/src/*.ts`
- `packages/tracer/src/*.ts`
- `packages/plugin-api/src/*.ts`
- `packages/cli/src/cli.ts`
- `packages/dashboard/src/*.ts`
- `test/**/*.ts`
