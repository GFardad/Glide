# Glide — Full Architecture Plan vs Codebase Line-by-Line Comparison

**Date:** 2026-08-11  
**Repo:** /media/Storage/home-gfardad/Projects/Glide  
**Plans audited:** `Plan/Architecture.md`, `Plan/TechnicalSpec.md`, `Plan/ImplementationPlan.md`, `Plan/RawIdea.md`  
**Code audited:** `packages/*/src/*.ts`, `test/*`, `skills/*/SKILL.md`, root config/scripts  
**Output path:** `/home/gfardad/Projects/Glide/audits/audit-arch-full.md`

---

## Executive Summary

The Glide codebase implements the **major scaffolding** of the planned multi-agent mega-harness: a TypeScript monorepo with 9 workspace packages, MCP stdio control plane, Headroom runtime, executor with agent file contracts, tracer, permissions gates, plugin API, dashboard, CLI, and a CTO Hermes skill. However, it **deviates significantly** from the architecture and technical specification in package naming, core type contracts, dependency choices, MCP tool surface, and feature completeness. Several planned capabilities are **missing**, several implemented tools are **stubs**, and key plan features like **git-blame tracing**, **token budgets**, **Zod-based tool schemas**, and **real plugin loaders** are **not implemented**.

**Overall status:** Phases 0–6 are scaffolded and partially implemented, but the system is **not production-grade** without P0/P1 fixes.

---

## 1. Monorepo Structure

| Plan (`TechnicalSpec.md` §6.1) | Code | Status | Evidence |
|--------------------------------|------|--------|----------|
| `packages/core` | `packages/core` | ✅ Match | `packages/core/src/index.ts` |
| `packages/mcp` | `packages/mcp-server` | ⚠️ **Name divergence** | Plan says `mcp`, code uses `mcp-server` |
| `packages/runtime` | `packages/executor` | ⚠️ **Name divergence** | Plan says `runtime`, code uses `executor` |
| `packages/meeting-room` | `packages/headroom` | ⚠️ **Name divergence** | Plan says `meeting-room`, code uses `headroom` |
| `packages/governor` | `packages/permissions` | ⚠️ **Name divergence** | Plan says `governor`, code uses `permissions` |
| `packages/trace` | `packages/tracer` | ⚠️ **Name divergence** | Plan says `trace`, code uses `tracer` |
| `packages/cli` | `packages/cli` | ✅ Match | `packages/cli/src/cli.ts` |
| `packages/dashboard` | `packages/dashboard` | ✅ Match | `packages/dashboard/src/generator.ts` |
| `plugins/example-plugin` | `plugins/example-plugin` | ✅ Match | `plugins/example-plugin/` exists |
| `skills/glide-cto` | `skills/glide-cto` | ✅ Match | `skills/glide-cto/SKILL.md` |
| `scripts/glide.mjs` | `packages/cli/src/cli.ts` | ⚠️ **Path divergence** | CLI implemented at different path |

**Notes:**
- `pnpm-workspace.yaml` includes `plugins/*`, and `plugins/example-plugin/` exists.
- Root `package.json` exposes `pnpm glide` via `node packages/cli/dist/cli.js`.
- `scripts/glide.mjs` does **not** exist; CLI lives in `packages/cli/`.

---

## 2. Tech Stack Dependencies

| Plan (`TechnicalSpec.md` §6.3) | Code | Status | Evidence |
|--------------------------------|------|--------|----------|
| `@modelcontextprotocol/sdk` | `@modelcontextprotocol/sdk` | ✅ Match | `packages/mcp-server/src/server.ts:1` |
| `zod` — schema validation | `zod` declared but unused at tool registry level | ⚠️ **Partial** | `packages/mcp-server/src/tools/index.ts` — no Zod schemas |
| `simple-git` — trace via git blame | **Not used** | ❌ **Missing** | Plan explicitly lists `simple-git`; `packages/tracer/` never imports it |
| `ulid` / `nanoid` — ID generation | `Date.now()` + `Math.random()` | ⚠️ **Divergence** | `packages/core/src/campaign/index.ts:60-62`, `packages/executor/src/executor.ts:9-15` |
| `better-sqlite3` | `node:sqlite` (built-in) | ⚠️ **Divergence** | `packages/headroom/src/goal-store.ts` |
| `esbuild` for binaries | `tsc` only | ❌ **Missing** | Plan says `tsc + esbuild for binaries` |
| Vitest | Vitest | ✅ Match | `vitest.config.ts` |
| ESLint + Prettier | ESLint + Prettier | ✅ Match | `eslint.config.js`, `.prettierrc.cjs` |

---

## 3. Core Type Contracts

### Plan expects (`TechnicalSpec.md` §Core Type Contracts)

```ts
export interface AgentContext {
  agentId: AgentId;
  parentId?: AgentId;
  role: string;
  objective: string;
  personalityPath: string;
  goalPath: string;
  notesPath: string;
  todoPath: string;
  rejectedPath: string;
  sessionPath: string;
  tokenBudget: number;
  allowedMcp: string[];
}

export interface ToolCall<T = unknown> {
  name: ToolName;
  arguments: Record<string, unknown>;
  accessLevel: "cto" | "agent";
}

export interface MeetingRoomOutput {
  riskLog: string[];
  architecture: string[];
  todoRegistry: TodoItem[];
  driftScore: number;
  decision: "approved" | "revise" | "rejected";
}

export interface TodoItem {
  id: string;
  title: string;
  owner: AgentId;
  status: "pending" | "in_progress" | "done" | "rejected";
  priority: number;
}
```

### Code actually has (`packages/core/src/types/index.ts`)

```ts
export interface Campaign {
  id: CampaignId; root: string; goal: string;
  nonGoals: string[]; assumptions: string[];
  createdAt: Date; updatedAt: Date;
}

export interface Agent {
  id: AgentId; role: string; parentId: AgentId | null;
  sessionId: SessionId; personality: string; goal: string;
  notes: string[]; todos: string[]; rejected: string[];
  permissions: string[];
}

export interface Artifact {
  type: "risk_log" | "architecture" | "todo_registry" | "plan" | "code" | "test" | "review" | "ship";
  path: string; content: string; agentId: AgentId | null; createdAt: Date;
}
```

**Status:** ❌ **Plan-specified types are not implemented.** Code uses its own domain types (`Campaign`, `Agent`, `Artifact`) rather than `AgentContext`, `ToolCall`, `MeetingRoomOutput`, `TodoItem`.

| Plan Type | Code Type | Status | File:Line |
|-----------|-----------|--------|-----------|
| `AgentContext` with path-based fields + `tokenBudget`/`allowedMcp` | `Agent` with inline content fields, no paths | ❌ **Gap** | `packages/core/src/types/index.ts:27-48` |
| `ToolName` interface | Missing entirely | ❌ **Gap** | `packages/core/src/types/index.ts` |
| `ToolCall` interface | Missing entirely | ❌ **Gap** | `packages/core/src/types/index.ts` |
| `MeetingRoomOutput` interface | Missing entirely | ❌ **Gap** | `packages/core/src/types/index.ts` |
| `TodoItem` interface | Missing entirely | ❌ **Gap** | `packages/core/src/types/index.ts` |
| `AgentId` / `SessionId` with `readonly` | `type AgentId = string` (no readonly) | ⚠️ **Divergence** | `packages/core/src/types/index.ts:1-6` |

---

## 4. MCP Tool Registry Pattern

### Plan expects (`TechnicalSpec.md` §MCP Tool Registry Pattern)

```ts
export const TOOLS = {
  glide_status: { accessLevel: "cto" | "agent", schema: z.object({}) },
  glide_headroom: { accessLevel: "cto", schema: z.object({ objective: z.string() }) },
  glide_indepth: { accessLevel: "agent", schema: z.object({ agentId: z.string() }) },
} as const;
```

### Code actually has (`packages/mcp-server/src/tools/index.ts`)

```ts
export interface GlideTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[]; };
  handler: GlideToolHandler;
}

export const tools: GlideTool[] = [
  glideGoalSetTool, glideGoalGetTool, glideHeadroomTool, glideExecutorTool,
  glideTracerTool, glideStatusTool, glidePermissionsTool, glideIndepthTool,
  glideTraceTool, glidePlanTool, glideBuildTool, glideTestTool,
  glideReviewTool, glideShipTool, glideConvergeTool, glideGatesTool, glideGraphTool,
];
```

**Status:** ⚠️ **Divergence.** No `accessLevel` enforcement, no Zod schemas at registry level. Input schemas are plain JSON Schema objects.

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| `accessLevel: "cto" \| "agent"` per tool | No access level field | ❌ **Missing** | `packages/mcp-server/src/tools/index.ts:37-55` |
| Zod schema validation in registry | Plain JSON Schema objects | ⚠️ **Divergence** | `packages/mcp-server/src/tools/index.ts` |
| `TOOLS` constant object | `tools` array | ⚠️ **Structural divergence** | `packages/mcp-server/src/tools/index.ts` |

---

## 5. MCP Tools — Completeness

| Planned Tool | Code | Status | Evidence |
|--------------|------|--------|----------|
| `glide_status` | `packages/mcp-server/src/tools/glide-status.ts` | ✅ | |
| `glide_goal_set` | `packages/mcp-server/src/tools/glide-goal.ts` | ✅ | |
| `glide_goal_get` | `packages/mcp-server/src/tools/glide-goal.ts` | ✅ | |
| `glide_headroom` | `packages/mcp-server/src/tools/glide-headroom.ts` | ✅ | |
| `glide_plan` | `packages/mcp-server/src/tools/glide-plan.ts` | ✅ | |
| `glide_build` | `packages/mcp-server/src/tools/glide-build.ts` | ⚠️ **Stub** | Writes placeholder markdown |
| `glide_test` | `packages/mcp-server/src/tools/glide-test-tools.ts` | ⚠️ **Stub** | Writes placeholder markdown |
| `glide_review` | `packages/mcp-server/src/tools/glide-review.ts` | ⚠️ **Stub** | Writes placeholder markdown |
| `glide_ship` | `packages/mcp-server/src/tools/glide-ship.ts` | ⚠️ **Stub** | Writes placeholder markdown |
| `glide_indepth` | `packages/mcp-server/src/tools/glide-indepth.ts` | ✅ | Output format diverges from plan |
| `glide_trace` | `packages/mcp-server/src/tools/glide-trace.ts` | ⚠️ **Partial** | No `git blame` integration |
| `glide_context` | **Missing** | ❌ | Plan §2.2 agent tools lists this |
| `glide_permission_request` | **Missing** | ❌ | Plan §2.2 governance tools lists this |
| `glide_permission_approve` | **Missing** | ❌ | Plan §2.2 governance tools lists this |
| `glide_rejected_log` | **Missing** | ❌ | Plan §2.2 governance tools lists this |
| `glide_executor` | `packages/mcp-server/src/tools/glide-executor.ts` | ➕ **Extra** | Not in original plan tool list |
| `glide_tracer` | `packages/mcp-server/src/tools/glide-tracer.ts` | ➕ **Extra** | Not in original plan tool list |
| `glide_converge` | `packages/mcp-server/src/tools/glide-converge.ts` | ➕ **Extra** | Not in original plan tool list |
| `glide_gates` | `packages/mcp-server/src/tools/glide-gates.ts` | ➕ **Extra** | Not in original plan tool list |
| `glide_graph` | `packages/mcp-server/src/tools/glide-graph.ts` | ➕ **Extra** | Not in original plan tool list |

**Summary:** 4 planned tools missing, 4 implemented tools are stubs, 5 extra tools added.

---

## 6. Layer-by-Layer Comparison

### 6.1 Layer 0 — Hermes CTO Skill (Plan §1.1)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Hermes skill for idea extraction | `skills/glide-cto/SKILL.md` | ✅ Match | |
| Writes `GOAL.md` / `NON_GOALS.md` / `ASSUMPTIONS.md` | Implemented in skill | ✅ Match | |
| Approval gate before MCP | Implemented | ✅ Match | |
| Does **not** use `delegate_task` | Documented but **not enforced** in code | ⚠️ **Unenforced** | Policy is in skill text only |

### 6.2 Layer 1 — Headroom (Plan §1.2)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| 10–15 agents with different personalities | Role analysis via `runRoleAnalysis` | ✅ Match | `packages/headroom/src/headroom.ts:34-48` |
| Risk Log + Architecture + Todo Registry output | `generateRiskLog`, `generateArchitecture`, `generateTodoRegistry` | ✅ Match | `packages/headroom/src/headroom.ts:99-154` |
| Drift detection | Naive string inclusion check | ⚠️ **Naive** | `packages/headroom/src/headroom.ts:156-161` |
| Snapshot/rollback support | `HeadroomRuntime` with delta ops | ✅ Match | `packages/headroom/src/runtime.ts:91-129` |
| Heartbeat/scheduling | `heartbeat.ts` | ✅ Match | `packages/headroom/src/heartbeat.ts` |
| SQLite + JSONL state | `goal-store.ts` uses `node:sqlite` | ✅ Match | `packages/headroom/src/goal-store.ts` |
| Plan-vs-code convergence | `converge.ts` | ➕ **Extra** | Not explicitly in original plan |

**Drift:** `detectDrift` at `packages/headroom/src/headroom.ts:156-161` does a simple substring check (`combined.includes(normalized)`). This is not semantic drift detection as implied by the plan's "Drift detection" requirement.

### 6.3 Layer 2 — Program Management (Plan §1.3)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Epic → Team → Agent tree | `buildProgramTree` | ✅ Match | |
| Parent sees only child summaries | `summarizeProgram` | ✅ Match | |
| `glide_plan` tool | Implemented | ✅ Match | |

### 6.4 Layer 3 — Execution Teams (Plan §1.4)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Agent file contract: PERSONALITY.md, GOAL.md, NOTES.md, TODO.md, REJECTED.md | `ensureAgentContract`, `generateAgentContract` | ✅ Match | `packages/executor/src/runtime.ts:42-68`, `packages/executor/src/contract.ts:44-66` |
| `appendNote`, `markTodoDone`, `recordRejection` | Implemented | ✅ Match | `packages/executor/src/runtime.ts:92-136` |
| `listAgents`, `cleanupAgentWorkspace` | Implemented | ✅ Match | `packages/executor/src/runtime.ts:138-153` |
| Session durability | `SessionEventEmitter`, `SessionStore` | ✅ Match | `packages/executor/src/session.ts` |

### 6.5 Tracer / `glide_trace` / `glide_indepth` (Plan §2.2)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| `glide_indepth`: JSON output in `runtime/workspace/indepth/<agent_id>.json` | Writes markdown to `<output_dir>/<agent_id>.md` | ❌ **Format/path divergence** | `packages/mcp-server/src/tools/glide-indepth.ts:27-33` |
| `glide_indepth`: includes aggregated NOTES/TODO/REJECTED + session_path | Returns markdown with Goal/Parent/Children/Notes/Todos; **no REJECTED, no session_path** | ⚠️ **Missing fields** | `packages/tracer/src/tracer.ts:107-133` |
| `glide_trace`: full trace from code line to Headroom via `git blame` | Reads agent markdown files only; **no git integration** | ❌ **Missing** | `packages/tracer/src/tracer.ts:53-105` |
| `simple-git` for git blame | **Not imported or used anywhere** | ❌ **Missing** | `packages/tracer/src/tracer.ts`, `packages/tracer/package.json` |
| Trace persistence | `TRACE_STORE` is in-memory `Map` only | ❌ **Non-persistent** | `packages/tracer/src/tracer.ts:6-9` |

### 6.6 Permissions / Governance (Plan §2.2)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| `glide_permission_request` | **Missing** | ❌ | Not in `tools/index.ts` |
| `glide_permission_approve` | **Missing** | ❌ | Not in `tools/index.ts` |
| `glide_rejected_log` | **Missing** | ❌ | Not in `tools/index.ts` |
| CTO Session (full) vs Agent Native (limited) access levels | No access level enforcement on MCP tools | ❌ **Missing** | `packages/mcp-server/src/tools/index.ts` |
| Authorization check | Single `glide_permissions` tool | ⚠️ **Partial** | `packages/mcp-server/src/tools/glide-permissions.ts` |
| Quality gates (typecheck, lint, build) | `gates.ts` implements these | ✅ Match | `packages/permissions/src/gates.ts` |
| `testPresenceGate` reads directory as file | `readFileSync(testDir, "utf8")` on directory | ❌ **Bug** | `packages/permissions/src/gates.ts:143` |

### 6.7 Plugin API / Prime-Agent Durability (Plan §3.2, §3.3)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Plugin manifest JSON with `capabilities`, `allowedRoles`, `tokenCost` | Manifest has `kind`, `sessionDurable`, `permissions`, `resourceLimits`; **no `capabilities`/`allowedRoles`/`tokenCost`** | ⚠️ **Partial** | `packages/plugin-api/src/types.ts`, `packages/plugin-api/src/loader.ts:18-36` |
| OpenCode/Hermes Agent plugin loader | `IPluginLoader` interface exists; **no concrete implementation** | ⚠️ **Stub** | `packages/plugin-api/src/loader.ts:87-99` |
| MCP plugin registry | `MCPPluginRegistry` | ✅ Match | `packages/plugin-api/src/registry.ts` |
| Prime-Agent session durability | `PrimeAgentSessionDurability`, `SessionStore`, `SessionEventEmitter` | ✅ Match | `packages/plugin-api/src/session.ts`, `packages/plugin-api/src/durability.ts` |
| Composition/bundle system | `CompositionRegistry` with extension points, presets, bundles | ✅ Match | `packages/plugin-api/src/composition.ts` |

### 6.8 Dashboard / Virtual Office Surface (Plan §4.7)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Web UI or Hermes skill dashboard | Static HTML + live HTML renderer | ✅ Match | `packages/dashboard/src/generator.ts` |
| Real-time session/task view | `renderLiveHtml` with auto-refresh | ✅ Match | `packages/dashboard/src/live.ts` |
| Hermes skill for dashboard | `skills/glide-dashboard/SKILL.md` | ✅ Match | |

### 6.9 MCP Server stdio (Plan §3.1, `TechnicalSpec.md` §MCP)

| Plan Requirement | Code Reality | Status | Evidence |
|------------------|--------------|--------|----------|
| Manual stdio JSON-RPC for full control | Manual newline-delimited JSON-RPC | ✅ Match | `packages/mcp-server/src/server.ts` |
| Backpressure handling | `writeMessage` + `waitDrain` | ✅ Match | `packages/mcp-server/src/server.ts:46-67` |
| Per-request timeout | `REQUEST_TIMEOUT_MS = 120_000` with `Promise.race` | ✅ Match | `packages/mcp-server/src/server.ts:8`, `203-211` |
| Lifecycle: initialize → initialized → shutdown | Partial; missing `notifications/initialized` send | ⚠️ **Incomplete** | `packages/mcp-server/src/server.ts:109-130` |
| Error codes: numeric JSON-RPC | Mixed; some string codes in bridge | ⚠️ **Partial** | `packages/mcp-server/src/bridge/HostBridge.ts` |

---

## 7. Specific Stubs / Placeholders / Missing Implementations

| File | Issue | Severity | Line(s) |
|------|-------|----------|---------|
| `packages/mcp-server/src/tools/glide-status.ts` | Hardcoded `phase: "1-2"`; no real status computation | MEDIUM | 16-19 |
| `packages/mcp-server/src/tools/glide-build.ts` | Writes placeholder markdown (`## Artifacts\n- TBD`) | MEDIUM | |
| `packages/mcp-server/src/tools/glide-test-tools.ts` | Writes placeholder markdown; no real test execution | MEDIUM | |
| `packages/mcp-server/src/tools/glide-review.ts` | Writes placeholder markdown; no real review logic | MEDIUM | |
| `packages/mcp-server/src/tools/glide-ship.ts` | Writes placeholder markdown; no real shipping logic | MEDIUM | |
| `packages/tracer/src/graphify.ts` | `prImpact` uses deterministic mock (`pickFilesForPr`) instead of real `git diff` | MEDIUM | 227-259, 298-311 |
| `packages/headroom/src/headroom.ts` | `detectDrift` is naive string inclusion check | MEDIUM | 156-161 |
| `packages/permissions/src/gates.ts` | `testPresenceGate` reads directory with `readFileSync` (should be `readdirSync`) | HIGH | 143 |
| `packages/permissions/src/gates.ts` | `execSync` with unsanitized workspace paths | HIGH | 30-36, 161-225 |
| `packages/tracer/src/tracer.ts` | `TRACE_STORE` is in-memory `Map`; never persisted | HIGH | 6-9 |

---

## 8. Missing Files / Directories

| Expected | Status | Notes |
|----------|--------|-------|
| `packages/mcp/src/tools/registry.ts` (Zod-based) | ❌ **Missing** | Plan expects Zod-validated registry |
| `packages/mcp-server/src/tools/glide-context.ts` | ❌ **Missing** | Plan §2.2 lists this tool |
| `packages/mcp-server/src/tools/glide-permission-request.ts` | ❌ **Missing** | Plan §2.2 lists this tool |
| `packages/mcp-server/src/tools/glide-permission-approve.ts` | ❌ **Missing** | Plan §2.2 lists this tool |
| `packages/mcp-server/src/tools/glide-rejected-log.ts` | ❌ **Missing** | Plan §2.2 lists this tool |
| OpenCode/Hermes plugin loader impl | ❌ **Missing** | Only `IPluginLoader` interface exists |
| `packages/mcp` (plan name) | ⚠️ **Divergence** | Code uses `packages/mcp-server` |

---

## 9. Architectural Violations

### 9.1 Global Mutable Singletons (HIGH)

- **`packages/tracer/src/tracer.ts:6-9`** — Module-level `TRACE_STORE = new Map()` with hidden global state. Breaks multi-campaign isolation and durability.
- **`packages/executor/src/session.ts:285`** — `globalSessionEmitter = new SessionEventEmitter({ enabled: true })` constructed at import time with no lifecycle management.

**Impact:** Memory leaks in long-running MCP sessions; impossible to run two independent campaigns in the same process.

### 9.2 Cross-Package `node:fs`/`node:path` Coupling (MEDIUM)

Multiple packages directly call `readFileSync`/`writeFileSync`/`readdirSync` on workspace paths instead of using each other's public APIs:

- `packages/tracer/src/tracer.ts:60-92` — reads agent markdown files directly
- `packages/executor/src/runtime.ts:42-68` — reads/writes agent files directly
- `packages/headroom/src/headroom.ts:70-76` — writes artifacts directly
- `packages/permissions/src/gates.ts:61-64` — runs CLI commands directly

**Impact:** Impossible to swap storage backends without modifying every package.

### 9.3 In-Memory Trace Store with No Persistence (HIGH)

- **`packages/tracer/src/tracer.ts:6-9`** — `TRACE_STORE` records traces but is never written to disk and has no read API.
- Plan requirement: "trace completo de código a agente padre hasta Headroom" with session durability.

**Impact:** Trace feature is non-functional across restarts.

### 9.4 `git blame` Integration Missing (MEDIUM)

- Plan explicitly lists `simple-git` for `git blame` integration in `glide_trace`.
- Code: `packages/tracer/src/tracer.ts` never imports or uses `simple-git`. `traceAgent` reads markdown files only.

**Impact:** The documented trace-to-code-line feature is missing.

---

## 10. Security Findings

| Severity | Finding | File:Line |
|----------|---------|-----------|
| HIGH | `execSync` with unsanitized workspace paths in quality gates | `packages/permissions/src/gates.ts:30-36`, `161-225` |
| HIGH | `readFileSync` on directory path (guaranteed `EISDIR` crash) | `packages/permissions/src/gates.ts:143` |
| HIGH | Default-allow for unknown actions in permission runtime | `packages/permissions/src/runtime.ts:25-32` |
| HIGH | Path traversal risk in MCP file-writing tools | `packages/mcp-server/src/tools/glide-indepth.ts:21-34` |
| MEDIUM | `JSON.parse` of untrusted `graph.json` without Zod validation | `packages/tracer/src/graphify.ts:77-87` |
| MEDIUM | Plugin manifest composition trusts plugin-provided defaults | `packages/plugin-api/src/composition.ts:198-202` |
| MEDIUM | Dashboard HTML embeds JSON without escaping (XSS risk) | `packages/dashboard/src/generator.ts:210-228` |
| LOW | No hardcoded secrets found | — |

---

## 11. Durability & Crash-Safety Findings

| Severity | Finding | File:Line |
|----------|---------|-----------|
| HIGH | Only one crash-safe write path (`datasync()` in `jsonl-writer.ts`) | `packages/tracer/src/jsonl-writer.ts:57` |
| HIGH | All other writes use plain `writeFileSync`/`appendFileSync` without fsync | `packages/executor/src/runtime.ts`, `packages/headroom/src/goal-store.ts`, `packages/plugin-api/src/durability.ts` |
| HIGH | `TRACE_STORE` purely in-memory; lost on restart | `packages/tracer/src/tracer.ts:6-9` |
| MEDIUM | No JSONL rotation/corruption recovery in headroom delta | `packages/headroom/src/delta.ts:82-120` |
| MEDIUM | SQLite without WAL or `synchronous` pragmas | `packages/headroom/src/goal-store.ts:42-61` |
| MEDIUM | Read-modify-write races on agent contract files | `packages/executor/src/contract.ts:92-136` |

---

## 12. Documentation Drift

| Doc | Issue | Code |
|-----|-------|------|
| `README.md` | Claims `packages/mcp-server` in repo structure | `pnpm-workspace.yaml` and actual packages use `packages/mcp-server` |
| `README.md` | Lists 14 MCP tools | Code has 17 tools (`tools/index.ts:37-55`) |
| `README.md` | `GraphifyClient` exposes `prImpact` with "real file-diff integration" | `graphify.ts:227-259` uses deterministic mock |
| `Plan/ImplementationPlan.md` | Says Hermes wiring is "in progress" | `docs/hermes-mcp.md` and `skills/glide-cto/SKILL.md` describe it as ready |
| `Plan/ImplementationPlan.md` | References `scripts/glide.mjs` | CLI is at `packages/cli/src/cli.ts` |
| `Plan/ImplementationPlan.md` | Claims 163 tests / 27 files | Actual is ~300 tests / 46 files |
| `Plan/TechnicalSpec.md` | Lists `better-sqlite3`, `esbuild`, `ulid`, `nanoid` | Code uses `node:sqlite`, `tsc` only, `Date.now()+Math.random()` |

---

## 13. Prioritized Fixes

### P0 — Must Fix Before Production

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 1 | Fix `readFileSync` on directory bug in `testPresenceGate` | `packages/permissions/src/gates.ts:143` | Trivial |
| 2 | Sanitize `execSync` workspace paths; add capability check before shell | `packages/permissions/src/gates.ts:30-36,161-225` | Medium |
| 3 | Fix default-allow auth hole in `PermissionRuntime` | `packages/permissions/src/runtime.ts:25-32` | Small |
| 4 | Add path traversal guards to all MCP file-writing tools | `packages/mcp-server/src/tools/glide-*.ts` | Medium |
| 5 | Replace `TRACE_STORE` in-memory Map with persistent JSONL writer | `packages/tracer/src/tracer.ts:6-9` | Medium |
| 6 | Fix MCP server lifecycle: send `notifications/initialized`, drain stdout before exit | `packages/mcp-server/src/server.ts:109-150,298-306` | Medium |
| 7 | Add Zod schemas for all `JSON.parse` sites | `packages/core/src/*`, `packages/headroom/src/goal-store.ts`, `packages/tracer/src/graphify.ts` | Large |
| 8 | Implement atomic writes + fsync for all durability paths | `packages/core/src/constitution.ts`, `packages/core/src/campaign/index.ts`, `packages/headroom/src/delta.ts`, `packages/executor/src/runtime.ts`, `packages/executor/src/session.ts` | Large |

### P1 — Production Hardening

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 9 | Implement missing governance tools: `glide_context`, `glide_permission_request`, `glide_permission_approve`, `glide_rejected_log` | `packages/mcp-server/src/tools/` | Large |
| 10 | Add `accessLevel` enforcement to MCP tool registry | `packages/mcp-server/src/tools/index.ts` | Medium |
| 11 | Replace naive drift detection with semantic check | `packages/headroom/src/headroom.ts:156-161` | Medium |
| 12 | Add `git blame` integration to `glide_trace` via `simple-git` | `packages/tracer/src/tracer.ts` | Medium |
| 13 | Align `glide_indepth` output format to JSON per plan | `packages/mcp-server/src/tools/glide-indepth.ts`, `packages/tracer/src/tracer.ts` | Small |
| 14 | Replace stub build/test/review/ship tools with real logic or remove stubs | `packages/mcp-server/src/tools/glide-*.ts` | Large |
| 15 | Replace global mutable singletons with package-scoped lifecycle objects | `packages/tracer/src/tracer.ts`, `packages/executor/src/session.ts` | Medium |
| 16 | Replace `Date.now()+Math.random()` IDs with `ulid`/`nanoid` | `packages/core/src/campaign/index.ts`, `packages/executor/src/executor.ts`, `packages/core/src/constitution.ts` | Small |
| 17 | Add SQLite WAL + `synchronous` pragmas | `packages/headroom/src/goal-store.ts` | Small |
| 18 | Escape JSON in dashboard HTML to prevent XSS | `packages/dashboard/src/generator.ts:210-228` | Small |
| 19 | Implement real `prImpact` using `git diff` instead of deterministic mock | `packages/tracer/src/graphify.ts:227-259` | Medium |
| 20 | Write `core` test suite (minimum 15 tests, 80% coverage) | `packages/core/test/` | Large |

### P2 — Polish + Observability + Docs

| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 21 | Sync all docs: tool count, paths, phase status, API signatures | `README.md`, `docs/*.md`, `Plan/*.md` | Medium |
| 22 | Reconcile package names in docs vs code or add aliases | `Plan/TechnicalSpec.md`, `README.md` | Small |
| 23 | Add structured logging abstraction (JSON logs, levels) | All packages | Large |
| 24 | Add metrics/telemetry hooks | `packages/mcp-server`, `packages/executor`, `packages/tracer` | Medium |
| 25 | Replace hand-rolled CLI transport with MCP SDK `StdioClientTransport` | `packages/cli/src/cli.ts` | Medium |
| 26 | Add JSONL rotation + corruption recovery | `packages/tracer/src/jsonl-writer.ts`, `packages/headroom/src/delta.ts` | Medium |
| 27 | Wire plugin manifest validation + capability checks before load | `packages/plugin-api/src/loader.ts`, `packages/plugin-api/src/composition.ts` | Large |
| 28 | Add backpressure handling + timeouts to executor child processes | `packages/executor/src/executor.ts` | Medium |
| 29 | Fix `.js` barrel import extensions | `packages/core/src/index.ts` | Trivial |
| 30 | Move side-effect imports to file top | `packages/core/src/constitution.ts:97-98` | Trivial |

---

## 14. Naming / API Divergences Summary

| Plan Name | Code Name | Impact | Severity |
|-----------|-----------|--------|----------|
| `packages/mcp` | `packages/mcp-server` | Import paths in docs vs code differ | LOW |
| `packages/runtime` | `packages/executor` | Semantic mismatch | LOW |
| `packages/meeting-room` | `packages/headroom` | Semantic mismatch | LOW |
| `packages/governor` | `packages/permissions` | Semantic mismatch | LOW |
| `packages/trace` | `packages/tracer` | Minor | LOW |
| `AgentContext` / `ToolCall` / `MeetingRoomOutput` / `TodoItem` | `Agent` / `Campaign` / `Artifact` | Type contract mismatch | HIGH |
| `better-sqlite3` | `node:sqlite` | Dependency mismatch | MEDIUM |
| `ulid` / `nanoid` | `Date.now()` + `Math.random()` | ID generation divergence | MEDIUM |
| `accessLevel` on tools | No access level enforcement | Security model divergence | HIGH |
| `glide_indepth` JSON output | Markdown output | Output format divergence | MEDIUM |
| `git blame` in `glide_trace` | Filesystem-only tracing | Feature gap | HIGH |
| `scripts/glide.mjs` | `packages/cli/src/cli.ts` | Path divergence | LOW |

---

## 15. Conclusion

The Glide codebase implements the **major scaffolding** of the planned architecture: monorepo, MCP stdio server, Headroom runtime, executor with agent contracts, tracer, permissions gates, plugin API, dashboard, CLI, and a CTO Hermes skill. However, it **deviates significantly** from the technical specification in package naming, core type contracts, and dependency choices. Several planned MCP tools are **missing** (`glide_context`, `glide_permission_request`, `glide_permission_approve`, `glide_rejected_log`), several implemented tools are **stubs** (build/test/review/ship), and key plan features like **git-blame tracing**, **token budgets**, **Zod-based tool schemas**, and **real plugin loaders** are **not implemented**.

The highest-risk issues are:
1. **Security:** `execSync` with unsanitized paths, default-allow auth, path traversal in MCP tools.
2. **Durability:** In-memory trace store, non-atomic writes, no fsync, no crash recovery.
3. **Observability:** No structured logging, no metrics, no trace correlation.
4. **Stubbed features claimed complete:** `git blame` integration, real PR impact analysis, OpenCode/Hermes plugin loaders.
5. **Doc/code drift:** Repo structure, CLI status, tool count, and Hermes wiring status are inconsistent across README, ImplementationPlan, and actual source.

**Recommended execution order:** P0 fixes first (security + data integrity), then P1 (tests + types + missing tools), then P2 (observability + docs + polish).
