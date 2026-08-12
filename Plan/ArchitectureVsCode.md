# Glide Architecture Plan vs Codebase — Line-by-Line Comparison Report

## Executive Summary

- **Plan docs audited:** `Plan/Architecture.md`, `Plan/TechnicalSpec.md`, `Plan/ImplementationPlan.md`
- **Code audited:** `packages/*/src/*.ts`, `test/*.ts`, `skills/*/SKILL.md`, root config/scripts
- **Overall state:** Phases 0–6 are scaffolded and mostly implemented, but there are **multiple missing MCP tools**, **naming/type divergences** from the technical spec, **stub implementations**, and **incomplete wiring** for remaining work.

---

## 1. Monorepo Structure

| Plan | Code | Status |
|------|------|--------|
| `packages/core` | `packages/core` | ✅ Match |
| `packages/mcp` | `packages/mcp-server` | ⚠️ **Name divergence** (plan says `mcp`, code uses `mcp-server`) |
| `packages/runtime` | `packages/executor` | ⚠️ **Name divergence** |
| `packages/meeting-room` | `packages/headroom` | ⚠️ **Name divergence** |
| `packages/governor` | `packages/permissions` | ⚠️ **Name divergence** |
| `packages/trace` | `packages/tracer` | ⚠️ **Name divergence** |
| `packages/cli` | `packages/cli` | ✅ Match |
| `packages/dashboard` | `packages/dashboard` | ✅ Match |
| `plugins/example-plugin` | **Missing** | ❌ **Missing** |
| `skills/glide-cto` | `skills/glide-cto` | ✅ Match |
| `scripts/glide.mjs` | **Missing** | ❌ **Missing** (plan lists this as next step) |
| `scripts/verify-hermes-config.cjs` | `scripts/verify-hermes-config.cjs` | ✅ Match |

**Notes:**
- `pnpm-workspace.yaml` includes `plugins/*`, but no `plugins/` directory exists.
- Root `package.json` exposes `pnpm glide` via `node packages/cli/dist/cli.js`, which satisfies the CLI wrapper requirement, just not at the exact path `scripts/glide.mjs`.

---

## 2. Tech Stack Dependencies

| Plan | Code | Status |
|------|------|--------|
| `better-sqlite3` | `node:sqlite` | ⚠️ **Divergence** — code uses Node built-in SQLite instead of `better-sqlite3` |
| `@modelcontextprotocol/sdk` | `@modelcontextprotocol/sdk` | ✅ Match |
| `zod` | `zod` (declared but not used in tool registry) | ⚠️ **Partial** — plan expects Zod schema validation in registry; code does not use Zod at the tool registry level |
| `simple-git` | **Not used** | ❌ **Missing** — plan calls for `simple-git` in `glide_trace` for `git blame` |
| `ulid` / `nanoid` | `Date.now()` + `Math.random()` | ⚠️ **Divergence** — no ULID/Nanoid usage |
| esbuild for binaries | tsc only | ❌ **Missing** — plan says `tsc + esbuild for binaries` |
| Vitest | Vitest | ✅ Match |
| ESLint + Prettier | ESLint + Prettier | ✅ Match |

---

## 3. Core Type Contracts

### Plan (`TechnicalSpec.md`) expects:
```ts
export interface AgentContext { agentId: AgentId; parentId?: AgentId; role: string; ... }
export interface ToolCall<T = unknown> { name: ToolName; arguments: Record<string, unknown>; accessLevel: "cto" | "agent"; }
export interface MeetingRoomOutput { riskLog: string[]; architecture: string[]; todoRegistry: TodoItem[]; driftScore: number; decision: "approved" | "revise" | "rejected"; }
export interface TodoItem { id: string; title: string; owner: AgentId; status: ...; priority: number; }
```

### Code actually has (`packages/core/src/types/index.ts`):
```ts
export interface Campaign { id: CampaignId; root: string; goal: string; nonGoals: string[]; assumptions: string[]; createdAt: Date; updatedAt: Date; }
export interface Agent { id: AgentId; role: string; parentId: AgentId | null; sessionId: SessionId; personality: string; goal: string; notes: string[]; todos: string[]; rejected: string[]; permissions: string[]; }
export interface Artifact { type: ...; path: string; content: string; agentId: AgentId | null; createdAt: Date; }
```

**Status:** ❌ **Plan-specified types are not implemented.** Code uses its own domain types (`Campaign`, `Agent`, `Artifact`) rather than `AgentContext`, `ToolCall`, `MeetingRoomOutput`, `TodoItem`.

---

## 4. MCP Tool Registry Pattern

### Plan expects:
```ts
export const TOOLS = {
  glide_status: { accessLevel: "cto" | "agent", schema: z.object({}) },
  glide_headroom: { accessLevel: "cto", schema: z.object({ objective: z.string() }) },
  ...
} as const;
```

### Code actually has (`packages/mcp-server/src/tools/index.ts` + `types.ts`):
```ts
export interface GlideTool { name: string; description: string; inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[]; }; handler: GlideToolHandler; }
export const tools: GlideTool[] = [ glideGoalSetTool, glideGoalGetTool, glideHeadroomTool, glideExecutorTool, glideTracerTool, glideStatusTool, glidePermissionsTool, glideIndepthTool, glideTraceTool, glidePlanTool, glideBuildTool, glideTestTool, glideReviewTool, glideShipTool, glideConvergeTool, glideGatesTool, glideGraphTool ];
```

**Status:** ⚠️ **Divergence.** No `accessLevel` enforcement, no Zod schemas at the registry level. Input schemas are plain JSON Schema objects.

---

## 5. MCP Tools — Completeness

| Planned Tool | Code | Status |
|--------------|------|--------|
| `glide_status` | `packages/mcp-server/src/tools/glide-status.ts` | ✅ |
| `glide_goal_set` | `packages/mcp-server/src/tools/glide-goal.ts` | ✅ |
| `glide_goal_get` | `packages/mcp-server/src/tools/glide-goal.ts` | ✅ |
| `glide_headroom` | `packages/mcp-server/src/tools/glide-headroom.ts` | ✅ |
| `glide_plan` | `packages/mcp-server/src/tools/glide-plan.ts` | ✅ |
| `glide_build` | `packages/mcp-server/src/tools/glide-build.ts` | ✅ |
| `glide_test` | `packages/mcp-server/src/tools/glide-test-tools.ts` | ✅ |
| `glide_review` | `packages/mcp-server/src/tools/glide-review.ts` | ✅ |
| `glide_ship` | `packages/mcp-server/src/tools/glide-ship.ts` | ✅ |
| `glide_indepth` | `packages/mcp-server/src/tools/glide-indepth.ts` | ✅ |
| `glide_trace` | `packages/mcp-server/src/tools/glide-trace.ts` | ✅ |
| `glide_context` | **Missing** | ❌ |
| `glide_permission_request` | **Missing** | ❌ |
| `glide_permission_approve` | **Missing** | ❌ |
| `glide_rejected_log` | **Missing** | ❌ |
| `glide_executor` | `packages/mcp-server/src/tools/glide-executor.ts` | ➕ Extra |
| `glide_tracer` | `packages/mcp-server/src/tools/glide-tracer.ts` | ➕ Extra |
| `glide_converge` | `packages/mcp-server/src/tools/glide-converge.ts` | ➕ Extra |
| `glide_gates` | `packages/mcp-server/src/tools/glide-gates.ts` | ➕ Extra |
| `glide_graph` | `packages/mcp-server/src/tools/glide-graph.ts` | ➕ Extra |

---

## 6. Tool Behavior Divergences & Stubs

### `glide_trace`
- **Plan:** should use `git blame` to map code lines to agent IDs, returning a chain from code line → agent_id → parent_ids → Headroom session.
- **Code:** reads agent `GOAL.md`, `NOTES.md`, `TODO.md`, and `PERSONALITY.md` parent references from the workspace filesystem. **No git integration.**
- **Status:** ❌ **Missing `git blame` integration.**

### `glide_indepth`
- **Plan:** output JSON in `runtime/workspace/indepth/<agent_id>.json`, including aggregated NOTES/TODO/REJECTED and session_path.
- **Code:** writes markdown to `<output_dir>/<agent_id>.md`. Does not include REJECTED.md or session_path.
- **Status:** ⚠️ **Output format and path divergence.**

### `glide_status`
- **Plan:** general system status.
- **Code:** hardcodes `phase: "1-2"` and optionally reads graphify stats.
- **Status:** ⚠️ **Stub** — phase is hardcoded, not computed.

### `glide_build` / `glide_test` / `glide_review` / `glide_ship`
- **Plan:** start build, run acceptance tests, review code, ship.
- **Code:** each writes a placeholder markdown artifact with `TBD` / static fields. No real build/test/review/ship execution.
- **Status:** ⚠️ **Stubs** — artifact stubs only.

### `glide_permissions`
- **Plan:** `glide_permission_request`, `glide_permission_approve`, `glide_rejected_log`.
- **Code:** single `glide_permissions` tool that checks authorization via `authorize(subject, { action, resource })`. No request/approve/rejected-log flow.
- **Status:** ❌ **Missing governance tools.**

### `glide_graph`
- **Plan:** not explicitly listed in Architecture.md, but ImplementationPlan says validate `glide_graph` end-to-end.
- **Code:** fully implemented with `graph_stats`, `query`, `shortest_path`, `community`, `node_details`, `pr_impact`. `pr_impact` uses a deterministic mock based on PR number, not real git diff.
- **Status:** ⚠️ **`pr_impact` is a stub/mock.**

---

## 7. Layer 0 — Hermes CTO Skill

- **Plan:** Layer 0 is a Hermes skill that extracts ideas, writes `GOAL.md`/`NON_GOALS.md`/`ASSUMPTIONS.md`, and calls `glide_headroom`.
- **Code:** `skills/glide-cto/SKILL.md` implements this workflow, including constitution workflow, approval gate, and Hermes MCP setup instructions.
- **Status:** ✅ Match.

---

## 8. Layer 1 — Headroom

- **Plan:** CTO + 10–15 agents with different personalities; drift detection; outputs Risk Log + Architecture + Todo Registry.
- **Code:**
  - `packages/headroom/src/headroom.ts` runs role analysis, generates artifacts, detects drift.
  - `packages/headroom/src/runtime.ts` provides snapshot/rollback delta support.
  - `packages/headroom/src/heartbeat.ts` implements heartbeat/scheduling.
  - `packages/headroom/src/goal-store.ts` uses `node:sqlite` + JSONL.
  - `packages/headroom/src/converge.ts` implements plan-vs-codebase convergence assessment.
- **Status:** ✅ Mostly match. `converge.ts` is an extra that wasn't explicitly planned but aligns with the plan's converge concept.

---

## 9. Layer 2 — Program Management

- **Plan:** Epic → Team → Agent tree; parent sees only child summaries.
- **Code:** `packages/executor/src/program.ts` (referenced via `buildProgramTree`, `renderProgramMarkdown`) implements the tree. `glide_plan` tool writes the plan artifact.
- **Status:** ✅ Match.

---

## 10. Layer 3 — Execution Teams

- **Plan:** specialized teams; agent file contract: `PERSONALITY.md`, `GOAL.md`, `NOTES.md`, `TODO.md`, `REJECTED.md`.
- **Code:** `packages/executor/src/executor.ts` has `ensureAgentContract`, `appendNote`, `markTodoDone`, `recordRejection`, `listAgents`. `glide_executor` exposes these via MCP.
- **Status:** ✅ Match.

---

## 11. Tracer / `glide_trace` / `glide_indepth`

- **Plan:**
  - `glide_indepth`: JSON output in `runtime/workspace/indepth/<agent_id>.json`.
  - `glide_trace`: full trace from code line to Headroom via `git blame`.
- **Code:**
  - `packages/tracer/src/tracer.ts`: `traceAgent` reads filesystem agent docs; `indepthAgent` returns markdown string.
  - `packages/tracer/src/trace-runtime.ts`: `TraceRuntime` / `SessionTraceLogger`.
  - `packages/tracer/src/jsonl-writer.ts`: JSONL event writer.
  - `packages/tracer/src/graphify.ts`: `GraphifyClient` for knowledge graph.
- **Status:** ⚠️ Partial. Filesystem-based tracing is implemented, but **no `git blame`** and **markdown output instead of JSON**.

---

## 12. Permissions / Governance

- **Plan:**
  - CTO Session (full access) vs Agent Native (limited).
  - `glide_permission_request`, `glide_permission_approve`, `glide_rejected_log`.
- **Code:**
  - `packages/permissions/src/gates.ts`: `runGates`, `DEFAULT_GATES` (spec/plan alignment, test presence, typecheck, lint, build).
  - `packages/mcp-server/src/tools/glide-permissions.ts`: single authorization check tool.
  - No request/approve/rejected-log workflow.
  - No access-level enforcement on MCP tools.
- **Status:** ❌ **Governance workflow missing.** Only quality gates and basic authorization check exist.

---

## 13. Plugin API / Prime-Agent Durability

- **Plan:**
  - Plugin manifest JSON with `capabilities`, `allowedRoles`, `tokenCost`.
  - OpenCode/Hermes Agent plugin loader.
- **Code:**
  - `packages/plugin-api/src/types.ts`: `PluginDescriptor`, `PluginInstance`, `PluginManifest`.
  - `packages/plugin-api/src/durability.ts`: `PrimeAgentSessionDurability` (persist/restore/remove plugin state).
  - `packages/plugin-api/src/session.ts`: `SessionStore`, `SessionEventEmitter`, `SessionReplayHelper`.
  - `packages/plugin-api/src/composition.ts`: `CompositionRegistry`, bundle composition, extension points.
- **Status:** ⚠️ **Partial.** Durability and composition are implemented, but **no `capabilities`/`allowedRoles`/`tokenCost` fields** and **no OpenCode/Hermes Agent-specific loader**.

---

## 14. Dashboard / Virtual Office Surface

- **Plan:** Web UI or Hermes skill dashboard; real-time session/task view.
- **Code:**
  - `packages/dashboard/src/generator.ts`, `live.ts`, `index.ts`.
  - `skills/glide-dashboard/SKILL.md`: Hermes skill for listing/viewing/opening/live dashboard.
- **Status:** ✅ Match.

---

## 15. CLI Wrapper

- **Plan:** `scripts/glide.mjs` spawning `packages/mcp-server/dist/index.js`.
- **Code:** `packages/cli/src/cli.ts` implements the full CLI. Root `package.json` has `"glide": "node packages/cli/dist/cli.js"`.
- **Status:** ✅ Functional match, different path.

---

## 16. MCP Server stdio Implementation

- **Plan:** manual stdio JSON-RPC implementation for full control.
- **Code:** `packages/mcp-server/src/server.ts` implements manual newline-delimited JSON-RPC over stdin/stdout with backpressure, timeouts, and lifecycle handling. `HostBridge.ts` provides a host-side router.
- **Status:** ✅ Match.

---

## 17. Quality Gates & Testing

- **Plan:** `tsc --noEmit`, `vitest run`, `eslint --max-warnings 0`, `prettier --check .`, MCP contract tests, E2E test, 80% coverage for core.
- **Code:**
  - Root `package.json` has `build`, `test`, `lint`, `format`, `typecheck`, `verify`, `verify:deps`.
  - `test/` contains many `coverage-*.test.ts` files.
  - `vitest.config.ts` present.
- **Status:** ✅ Match.

---

## 18. Specific Stubs / Placeholders / Missing Implementations

| File | Issue |
|------|-------|
| `packages/mcp-server/src/tools/glide-status.ts` | Hardcoded `phase: "1-2"`; no real system status computation. |
| `packages/mcp-server/src/tools/glide-build.ts` | Writes placeholder markdown (`## Artifacts\n- TBD`). |
| `packages/mcp-server/src/tools/glide-test-tools.ts` | Writes placeholder markdown; no real test execution. |
| `packages/mcp-server/src/tools/glide-review.ts` | Writes placeholder markdown; no real review logic. |
| `packages/mcp-server/src/tools/glide-ship.ts` | Writes placeholder markdown; no real shipping logic. |
| `packages/tracer/src/graphify.ts` | `prImpact` uses deterministic mock (`pickFilesForPr`) instead of real `git diff`. |
| `packages/headroom/src/headroom.ts` | `detectDrift` is naive string inclusion check; not semantic drift detection. |
| `packages/permissions/src/gates.ts` | `testPresenceGate` reads directory with `readFileSync` on a directory path (bug: should use `readdirSync`). |
| `packages/plugin-api/src/durability.ts` | `clear()` reads `this.eventFile` but constructor default is relative; may resolve to wrong path if `rootDir` is set without `eventFile`. |

---

## 19. Missing Files / Directories

| Expected | Status |
|----------|--------|
| `plugins/example-plugin/` | ❌ Missing |
| `scripts/glide.mjs` | ❌ Missing (CLI is in `packages/cli` instead) |
| `packages/mcp-server/src/tools/glide-context.ts` | ❌ Missing |
| `packages/mcp-server/src/tools/glide-permission-request.ts` | ❌ Missing |
| `packages/mcp-server/src/tools/glide-permission-approve.ts` | ❌ Missing |
| `packages/mcp-server/src/tools/glide-rejected-log.ts` | ❌ Missing |

---

## 20. Naming / API Divergences Summary

| Plan Name | Code Name | Impact |
|-----------|-----------|--------|
| `packages/mcp` | `packages/mcp-server` | Import paths in docs vs code differ |
| `packages/runtime` | `packages/executor` | Semantic mismatch |
| `packages/meeting-room` | `packages/headroom` | Semantic mismatch |
| `packages/governor` | `packages/permissions` | Semantic mismatch |
| `packages/trace` | `packages/tracer` | Minor |
| `AgentContext` / `ToolCall` / `MeetingRoomOutput` / `TodoItem` | `Agent` / `Campaign` / `Artifact` | Type contract mismatch |
| `better-sqlite3` | `node:sqlite` | Dependency mismatch |
| `ulid` / `nanoid` | `Date.now()` + `Math.random()` | ID generation divergence |
| `accessLevel` on tools | No access level enforcement | Security model divergence |
| `glide_indepth` JSON output | markdown output | Output format divergence |
| `git blame` in `glide_trace` | filesystem-only tracing | Feature gap |

---

## Conclusion

The codebase implements the **major scaffolding** of the Glide architecture: monorepo, MCP stdio server, headroom runtime, executor with agent contracts, tracer, permissions gates, plugin API, dashboard, CLI, and a CTO Hermes skill. However, it **deviates significantly** from the technical specification in package naming, core type contracts, and dependency choices. Several planned MCP tools are **missing** (`glide_context`, permission request/approve/rejected-log), several implemented tools are **stubs** (build/test/review/ship), and key plan features like **git-blame tracing**, **token budgets**, **Zod-based tool schemas**, and **real plugin capabilities** are **not implemented**.

**Recommended next actions:**
1. Reconcile package names in docs vs code or add aliases.
2. Implement missing governance tools.
3. Replace naive drift detection and placeholder artifacts with real logic.
4. Add `git blame` integration to tracer.
5. Align core types with the technical spec or update the spec to match code.
6. Fix `testPresenceGate` directory-read bug.
