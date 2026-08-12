# Type Safety Audit

Date: 2026-08-11
Scope: `/media/Storage/home-gfardad/Projects/Glide` — all `.ts` source files
Config: `strict=true`, `noUncheckedIndexedAccess=true`, `exactOptionalPropertyTypes=true`

## Executive Summary

- `tsc --noEmit` passes with zero errors across all packages.
- No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck` directives found in source.
- No implicit `any` usages found.
- One `as any` cast found outside TypeScript source (`scripts/generate-coverage-tests.py`).
- Dominant risk pattern: **unvalidated casts from `JSON.parse` / JSON-RPC boundaries into concrete types** (`as Record<string, unknown>`, `as SomeInterface`).
- Secondary risk: **generic `unknown` types at public API boundaries** where stronger contracts would catch misuse at compile time.

---

## High-Impact Findings

### 1. Pervasive unsafe casts from `JSON.parse`

`JSON.parse` returns `any`. The codebase frequently casts directly to typed interfaces or `Record<string, unknown>` without runtime guards.

| File | Line | Unsafe Cast | Risk |
|------|------|-------------|------|
| `packages/headroom/src/goal-store.ts` | 40 | `JSON.parse(...) as Record<string, unknown>[]` | Malformed JSON silently becomes typed rows |
| `packages/headroom/src/goal-store.ts` | 90 | `JSON.parse(...) as Record<string, unknown>[]` | Same |
| `packages/headroom/src/goal-store.ts` | 123 | `JSON.parse(...) as Record<string, unknown>[]` | Same |
| `packages/headroom/src/goal-store.ts` | 135 | `JSON.parse(row.metadata as string) as Record<string, unknown>` | Nested unvalidated cast |
| `packages/headroom/src/goal-store.ts` | 145 | `JSON.parse(...) as Record<string, unknown>[]` | Same |
| `packages/headroom/src/goal-store.ts` | 156 | `JSON.parse(row.metadata as string) as Record<string, unknown>` | Same |
| `packages/headroom/src/goal-store.ts` | 170 | `JSON.parse(...) as Record<string, unknown>[]` | Same |
| `packages/headroom/src/goal-store.ts` | 194 | `JSON.parse(...) as Record<string, unknown>[]` | Same |
| `packages/headroom/src/goal-store.ts` | 203 | `JSON.parse(row.metadata as string) as Record<string, unknown>` | Same |
| `packages/headroom/src/goal-store.ts` | 219 | `JSON.parse(...) as GoalRecord[]` | Asserts full schema match |
| `packages/headroom/src/goal-store.ts` | 243 | `JSON.parse(line) as GoalRecord` | Same for JSONL lines |
| `packages/headroom/src/heartbeat.ts` | 117 | `JSON.parse(...)` returns untyped object | `loadHeartbeatState` return type is implicit `any` |
| `packages/headroom/src/delta.ts` | 111 | `JSON.parse(lines[i]!) as HeadroomSnapshot` | Asserts snapshot schema |
| `packages/headroom/src/delta.ts` | 126 | `JSON.parse(line) as HeadroomSnapshot` | Same |
| `packages/headroom/src/delta.ts` | 142 | `JSON.parse(line) as HeadroomSnapshot` | Same |
| `packages/core/src/campaign/index.ts` | 44 | `JSON.parse(...) as Campaign` | Unvalidated campaign schema |
| `packages/core/src/constitution.ts` | 108 | `JSON.parse(...) as Constitution` | Unvalidated constitution schema |
| `packages/permissions/src/gates.ts` | 71 | `JSON.parse(...)` returns `unknown` | `readJsonIfExists` return type is `unknown`, but function returns `null` on missing file — mismatch |
| `packages/permissions/src/permissions.ts` | 40 | `JSON.parse(...) as PermissionPolicy` | Unvalidated policy schema |
| `packages/permissions/src/permissions.ts` | 68 | `JSON.parse(...) as PermissionRequest` | Unvalidated request schema |
| `packages/permissions/src/permissions.ts` | 83 | `JSON.parse(...) as PermissionRequest` | Same |
| `packages/permissions/src/capability-tokens.ts` | 100 | `JSON.parse(...) as CapabilityTokenPayload` | Decoded base64 payload trusted without validation |
| `packages/tracer/src/graphify.ts` | 80 | `parsed = JSON.parse(raw)` then cast at 99 | Unvalidated graph payload |
| `packages/tracer/src/jsonl-writer.ts` | 65 | `JSON.parse(line) as T` | Malformed line silently skipped |
| `packages/executor/src/executor.ts` | 42 | `JSON.parse(line) as Partial<AgentMessage> & Record<string, unknown>` | Unvalidated message schema |
| `packages/executor/src/session.ts` | 66 | `JSON.parse(line) as SessionEvent & Record<string, unknown>` | Unvalidated event schema |
| `packages/executor/src/program.ts` | 184 | `JSON.parse(...)` typed as `unknown` | Safe shape, but no guard before use downstream |
| `packages/dashboard/src/generator.ts` | 41 | `JSON.parse(...)` returns `any` | Unvalidated campaign data |
| `packages/dashboard/src/live.ts` | 113 | `JSON.parse(...)` returns `any` | Unvalidated session task data |
| `packages/plugin-api/src/session.ts` | 70 | `JSON.parse(line) as SessionEvent` | Unvalidated event schema |
| `packages/plugin-api/src/session.ts` | 158 | `JSON.parse(...) as SessionRecord` | Unvalidated session record schema |
| `packages/plugin-api/src/durability.ts` | 63 | `JSON.parse(raw) as Record<string, unknown>` | Plugin state trusted without schema check |
| `packages/mcp-server/src/bridge/HostBridge.ts` | 31 | `JSON.parse(input)` -> `unknown` then cast | JSON-RPC envelope unvalidated |
| `packages/mcp-server/src/server.ts` | 76 | `JSON.parse(line)` -> `unknown` then cast | JSON-RPC line unvalidated |
| `plugins/example-plugin/src/loader.ts` | 80 | `JSON.parse(...) as PluginDescriptor` | Plugin manifest trusted without validation |

**Suggested stronger pattern:**

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const parsed = JSON.parse(line);
if (!isRecord(parsed)) {
  throw new Error("Expected object");
}
```

Or use Zod schemas at deserialization boundaries.

---

### 2. Tool handlers accept `Record<string, unknown>`; arguments cast with `as` in body

**Files:** `packages/mcp-server/src/tools/types.ts:3-5`, and all 16 tool files under `packages/mcp-server/src/tools/`

`packages/mcp-server/src/tools/types.ts:3-5`
`packages/mcp-server/src/tools/glide-status.ts:15`
`packages/mcp-server/src/tools/glide-trace.ts:17`
`packages/mcp-server/src/tools/glide-review.ts:30`
`packages/mcp-server/src/tools/glide-executor.ts:34`
`packages/mcp-server/src/tools/glide-goal.ts:16,49`
`packages/mcp-server/src/tools/glide-permissions.ts:20`
`packages/mcp-server/src/tools/glide-gates.ts:23`
`packages/mcp-server/src/tools/glide-build.ts:36`
`packages/mcp-server/src/tools/glide-ship.ts:30`
`packages/mcp-server/src/tools/glide-converge.ts:35`
`packages/mcp-server/src/tools/glide-headroom.ts:31`
`packages/mcp-server/src/tools/glide-indepth.ts:18`
`packages/mcp-server/src/tools/glide-plan.ts:44`
`packages/mcp-server/src/tools/glide-test-tools.ts:30`
`packages/mcp-server/src/tools/glide-tracer.ts:17`
`packages/mcp-server/src/tools/glide-graph.ts:35`

**Issue:** Every handler signature is `(args: Record<string, unknown>)`. Inside each handler, arguments are extracted via `args["x"] as string | undefined`. This:
- Shifts validation to runtime
- Loses IDE autocomplete
- Allows misspelled keys without compile error

**Suggested stronger type:**

```ts
export type GlideToolHandler<TArgs extends Record<string, unknown>> = (
  args: TArgs
) => Promise<CallToolResult> | CallToolResult;

export interface GlideTool<TArgs extends Record<string, unknown>> {
  name: string;
  description: string;
  inputSchema: { ... };
  handler: GlideToolHandler<TArgs>;
}
```

---

### 3. MCP SDK request handler uses untyped `request` parameter

**File:** `packages/mcp-server/src/server.ts:24`

**Issue:** `server.setRequestHandler(CallToolRequestSchema, async (request) => { ... })` — `request` is effectively `any` because the SDK handler is not generic in this version. Accessing `request.params.name` and `request.params.arguments` is unchecked.

**Suggested stronger type:** Wrap or adapt with explicit types if SDK generics are unavailable, or validate `params` shape before destructuring.

---

### 4. `readJsonIfExists` return type mismatch

**File:** `packages/permissions/src/gates.ts:66-79`

**Issue:** Signature declares `unknown`, but implementation returns `null` when the file is missing or not a file. Callers do `if (!spec || !plan)` which conflates `null`, `undefined`, and malformed JSON.

**Suggested stronger type:**

```ts
function readJsonIfExists(path: string):
  | { ok: true; value: unknown }
  | { ok: false; error: "missing" | "not_file" | "parse" }
```

---

### 5. `GoalStoreOptions.database` typed as `unknown`

**File:** `packages/headroom/src/goal-store.ts:7`

**Issue:** Public API accepts `database?: unknown`, then casts to `DatabaseLike` at line 16. Any value is accepted at compile time.

**Suggested stronger type:**

```ts
export interface GoalStoreOptions {
  root: string;
  database?: DatabaseLike;
}
```

---

### 6. Host bridge generics default to `unknown`

**Files:** `packages/mcp-server/src/bridge/types.ts:14,21,27,38,41,45`, `packages/mcp-server/src/bridge/HostBridge.ts:22,24`

**Issue:** `HostRequest<TParams = unknown>`, `HostResponse<TResult = unknown>`, `HostRoute<TParams = unknown, TResult = unknown>`. Every instantiation in `HostBridge` uses `unknown`, making the entire bridge untyped.

**Suggested stronger type:** Use a shared envelope interface with explicit `params?: Record<string, unknown>` rather than fully open generics.

---

### 7. Schema fields typed as `z.any()`

**Files:** `packages/plugin-api/src/loader.ts:54`, `packages/core/src/schemas/index.ts:280`

**Issue:** `manifest: z.any().optional()` permits any payload shape without validation. While useful for forward compatibility, it bypasses Zod's type inference.

**Suggested stronger type:** Replace `z.any()` with a loose `z.record(z.string(), z.unknown())` or a branded `z.unknown()` with runtime validation.

---

### 8. Broad `catch` blocks with untyped `error`

**Files:**
- `packages/mcp-server/src/server.ts:223-234` — `catch (error)` with `error instanceof Error` check
- `packages/mcp-server/src/tools/glide-trace.ts:85-87` — `catch {}` swallows graphify failures silently
- `packages/headroom/src/goal-store.ts` — multiple `catch {}` blocks
- `packages/tracer/src/jsonl-writer.ts` — `catch {}` blocks
- `packages/executor/src/session.ts` — `catch {}` blocks
- `packages/executor/src/executor.ts` — `catch {}` blocks
- `packages/plugin-api/src/durability.ts` — `catch {}` blocks

**Issue:** Unhandled `unknown` errors lose stack traces and context. While not strictly type-unsafe, typed catch bindings (`catch (error: unknown)`) improve debuggability and align with `strict` mode intent.

**Suggested stronger type:**

```ts
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logStderr(`operation_failed error=${message}`);
}
```

---

### 9. Non-null assertions (`!`) used to bypass strict null checks

**Files:**
- `packages/mcp-server/src/tools/glide-gates.ts:31` — `gate.name!`
- `packages/plugin-api/src/registry.ts:74` — `limits.timeoutMs!`
- `packages/executor/src/executor.ts:349` — `events[events.length - 1]!`
- Test files: `test/coverage-headroom-runtime.test.ts:23,89`, `test/graphify.test.ts:26-48`, `test/e2e-graphify.test.ts:35-45`

**Issue:** `!` tells TypeScript to trust the value is non-null. In production code, this bypasses `strictNullChecks`; in tests, it can mask flaky preconditions.

**Suggested stronger type:** Replace with explicit guards or default values.

---

### 10. `createAgentFileContract` double-casts result

**File:** `packages/core/src/fs/agent-fs.ts:104`

**Issue:** `loadAgentDirectory(...).files as unknown as AgentFileContract` — `AgentDirectory["files"]` is not assignable to `AgentFileContract`, so the code inserts `unknown` as an intermediate type. This bypasses structural typing.

**Suggested stronger type:** Align `AgentDirectory["files"]` with `AgentFileContract` structurally, or map fields explicitly.

---

## Medium-Impact Findings

### 11. `HostBridge.buildErrorResponse` narrows via `"id" in request`

**File:** `packages/mcp-server/src/bridge/HostBridge.ts:104-107`

**Issue:** Uses `"id" in request` then casts to `{ id: string | number }`. While type-safe at runtime, the `request` parameter is already `unknown`-defaulted, so the cast is necessary but fragile.

---

### 12. `ExecutorRuntime.awaitAgent` returns `AgentResult` without explicit return type

**File:** `packages/executor/src/executor.ts:280`

**Issue:** The `new Promise((resolve) => { ... })` callback does not declare its return type; `resolve` is implicitly `(value: void | AgentResult) => void`. Not unsafe, but inconsistent with the rest of the typed codebase.

---

### 13. `SessionEventWriter.readAll` casts parsed JSON

**File:** `packages/executor/src/session.ts:66`

**Issue:** `JSON.parse(line) as SessionEvent & Record<string, unknown>` trusts the line shape. Malformed lines are skipped, but valid-looking lines with wrong types are accepted.

---

### 14. `JsonlWriter.readAll` casts parsed JSON

**File:** `packages/tracer/src/jsonl-writer.ts:65`

**Issue:** `JSON.parse(line) as T` — if `T` is a specific record type, malformed lines that happen to parse as objects are accepted.

---

### 15. `PluginLoaderRegistry` / `CompositionRegistry` use `Map<string, ...>` with string keys

**Files:** `packages/plugin-api/src/loader.ts:102`, `packages/plugin-api/src/composition.ts:83-85`

**Issue:** Registry keys are untyped strings; typos in `register("mcp", ...)` vs `get("MCP")` are not caught at compile time.

---

## Low-Impact / Informational

| File | Line | Note |
|------|------|------|
| `packages/cli/src/cli.ts` | 283 | `parseArgs` returns `Args` — well-typed CLI args |
| `packages/tracer/src/jsonl-writer.ts` | 21 | `[key: string]: unknown` index signature — appropriate for JSONL rows |
| `packages/mcp-server/src/index.ts` | 6 | `main().catch((err: unknown) => { ... })` — correct typed catch binding |
| `packages/headroom/src/goal-store.ts` | 7 | `database?: unknown` — covered in Finding 5 |
| `packages/dashboard/src/live.ts` | 58 | `toDate(value: unknown): Date \| undefined` — correct use of `unknown` |
| `packages/executor/src/program.ts` | 184 | `parsed: unknown = JSON.parse(...)` — safest pattern in codebase |

---

## Recommendations

1. **Introduce per-tool argument interfaces** derived from each tool's `inputSchema.properties`. This is the highest-value change for IDE safety.
2. **Add runtime validation for `JSON.parse` outputs** using Zod schemas or type-guard functions at deserialization boundaries.
3. **Fix `readJsonIfExists` return type** to distinguish missing, not-file, parse-error, and success states.
4. **Replace `database?: unknown`** in `GoalStoreOptions` with `DatabaseLike`.
5. **Replace `z.any()` schema fields** with `z.record(z.string(), z.unknown())` or stricter branded types.
6. **Type the MCP SDK request handlers** with explicit parameter types or validation wrappers.
7. **Reduce non-null assertions** by adding explicit guards or defaults.
8. **Add typed catch bindings** (`catch (error: unknown)`) in production code for better debuggability.
