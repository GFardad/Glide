# Glide Documentation Accuracy & Completeness Audit

**Date:** 2026-08-11  
**Auditor:** Hermes subagent  
**Scope:** `README.md`, `docs/*.md`, `packages/*/README.md`, `Plan/*.md`  
**Source of truth:** Actual TypeScript source in `/media/Storage/home-gfardad/Projects/Glide/`

---

## Executive Summary

- **Doc/code drift is significant.** Counts, paths, package names, and API shapes are inconsistent across 7+ files.
- **The most damaging errors are:** wrong tool counts (14 vs 17), stale `phase: "1-2"`, mismatched Hermes config paths, and a `plugins/` vs `plugins/example-bundle`/`plugins/example-plugin` mismatch.
- **Production-grade doc standards require:** machine-readable API contracts, versioned docs, error-schema tables, and CI validation. None of the audited docs meet this bar today.

---

## Exact Line-by-Line Corrections

### 1. `README.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 4 | `production-grade multi-agent mega harness.` | `production-grade deterministic multi-agent orchestration harness.` | Aligns with repo description; “mega harness” is vague. |
| 14 | `User → glide-cto skill ...` | Add `glide_graph` and `glide_gates` to architecture block. | The MCP server exposes 17 tools, including `glide_graph` and `glide_gates`; the diagram omits them. |
| 30 | `packages/plugin-api` row says “MCP plugin registry + loader + Prime-Agent session durability” | Correct to: `packages/plugin-api` — Plugin registry, loader contracts (`IPluginLoader`), `PrimeAgentSessionDurability`, and `CompositionRegistry` for bundle composition.` | Missing composition surface; README under-describes the package. |
| 32 | `packages/mcp-server` — “exposing all **14** glide_* tools” | Change **14** to **17**. | `src/tools/index.ts` registers 17 tools: `glide_goal_set`, `glide_goal_get`, `glide_headroom`, `glide_executor`, `glide_tracer`, `glide_status`, `glide_permissions`, `glide_indepth`, `glide_trace`, `glide_plan`, `glide_build`, `glide_test`, `glide_review`, `glide_ship`, `glide_converge`, `glide_gates`, `glide_graph`. |
| 43-46 | Tool list omits `glide_graph`, `glide_converge`, `glide_gates` | Add `glide_converge`, `glide_gates`, `glide_graph` to the comma-separated list. | Same root cause: stale tool count. |
| 66-70 | Hermes wiring block uses `/media/Storage/home-gfardad/Projects/Glide/...` | Replace absolute path with a relative or install-time path, or add a note: “Replace with your absolute repo path.” | Hardcoding `/media/Storage/...` breaks every other host; `docs/hermes-mcp.md` also hardcodes `/home/gfardad/...`, so both docs are host-specific. |
| 89-91 | `README.md` claims `GraphifyClient` exposes `prImpact` with “real file-diff integration” | Rewrite: “`prImpact` currently uses a deterministic mock (`pickFilesForPr`); replace with `git diff --name-only` when git history is available.” | `graphify.ts:223-225` explicitly states this is a mock. |
| 93-96 | `packages/mcp-server` listed as a separate package in the “Workspace packages” table, but `pnpm-workspace.yaml` and `packages/` show `packages/mcp-server/` exists. | Keep the entry, but update the “Repo Structure” and any prose that implies `packages/mcp-server` is missing. | Confusion in multiple plan docs; the package exists and builds. |
| 98-100 | `Skills` section only lists `glide-cto` and `glide-dashboard`. | Add note that additional skills may be added; ensure path matches actual `skills/` directory. | Minor completeness issue. |

### 2. `docs/api.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 4 | `exposing 17 tools` then later lists 14 names | Update the tool list block to include all 17 names. | Inconsistent internal counts. |
| 14 | `Output: { ok, tool, packages, plugins, version }` | Add `phase` field: `{ ok, tool, packages, plugins, version, phase }` | `glide_status` returns `phase` (`glide-status.ts:19`). |
| 37-39 | `glide_headroom` output omits `role_analysis` path detail | Clarify that `role_analysis` is written to `artifacts/role_analysis.json`; the tool returns `role_signals` only. | `headroom.ts:73` writes JSON; API doc should separate return payload from filesystem side effects. |
| 67 | `<workspace>/runtime/workspace/indepth/<agent_id>.md` | Change to `<output_dir>/<agent_id>.md` where `output_dir` defaults to `${workspace}/runtime/workspace/indepth`. | The tool accepts an overrideable `output_dir` (`glide-indepth.ts:22-23`). |
| 128-132 | `glide_graph` action enum documented as `read/query/shortestPath/community/nodeDetails/prImpact` | Change enum values to snake_case matching actual implementation: `graph_stats, query, shortest_path, community, node_details, pr_impact`. | `glide-graph.ts:14-21` defines snake_case enum. |
| 146 | `isError?: true` | Change to `isError: true` or document that `isError` is a boolean flag on the MCP response envelope, not inside `content[0].text`. | The actual tool returns `CallToolResult`; error shaping should be documented at the protocol level, not inside the JSON payload. |
| 147 | `Error codes: approval_gate, missing_fields, campaign_not_found, unknown_action, load_failed, INVALID_MANIFEST, DUPLICATE_ID, NOT_FOUND.` | Split into two tables: MCP-level error codes vs. plugin-api domain codes. | `INVALID_MANIFEST`, `DUPLICATE_ID`, `NOT_FOUND` are `PluginLoadError` codes in `plugin-api`, not MCP tool error codes. Mixing them confuses consumers. |

### 3. `packages/mcp-server/README.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 3 | `exposing all 14 glide_* tools` | Change to `exposing all 17 glide_* tools`. | Same drift as root README. |
| 16-18 | Tool list omits `glide_graph`, `glide_converge`, `glide_gates` | Add the three missing tools. | Source: `src/tools/index.ts`. |

### 4. `docs/hermes-mcp.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 14 | `/home/gfardad/Projects/Glide/packages/mcp-server/dist/index.js` | Replace with a placeholder or relative path, matching the root README fix. | Host-specific absolute path. |
| 33 | `node scripts/verify-hermes-config.cjs` | Add `pnpm`-aware invocation: `node scripts/verify-hermes-config.cjs` or `pnpm exec node scripts/verify-hermes-config.cjs`. | Script exists and works, but docs don’t mention it must be run from repo root. |

### 5. `packages/plugin-api/README.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 7 | `PluginDescriptor / PluginInstance / PluginEntrypointDescriptor — manifest contract (kind: "mcp" | "agent-hook" | "skill")` | Rewrite: `PluginDescriptor` contains `entrypoint: PluginEntrypointDescriptor`; `PluginEntrypointDescriptor` is a nested object, not a standalone manifest root. | `types.ts:12-22` shows `PluginEntrypointDescriptor` is a property of `PluginDescriptor`, not an independent top-level contract. |
| 25 | `Reference implementation: plugins/example-plugin.` | Add second reference: `plugins/example-bundle` demonstrates `CompositionRegistry` bundle composition. | `example-bundle` exists but is undocumented. |

### 6. `Plan/ImplementationPlan.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 8 | `Phases 0–5 complete, Phase 6 (dashboard) complete` | Change to `Phases 0–6 complete`. | Redundant and slightly misleading phrasing. |
| 9 | `163 tests / 27 files` | Change to `300 tests / 46 files` (or whatever the current actual count is after `pnpm test`). | Stale metrics; `test/` contains 47 `.ts` files. |
| 11 | `In progress: Hermes wiring, CLI, graphify integration` | Change to `Complete: Hermes wiring, CLI, graphify integration`. | `docs/hermes-mcp.md`, `packages/cli/src/cli.ts`, and `glide_graph` tool all exist and are wired. |
| 131 | `Next: create scripts/glide.mjs that spawns packages/mcp-server/dist/index.js` | Change to `Next: none — CLI exists at packages/cli/src/cli.ts and is wired via package.json scripts.glide`. | CLI is already implemented. |
| 136 | `Next: validate glide_graph MCP tool against GraphifyClient` | Change to `Complete — glide_graph implemented with graph_stats/query/shortest_path/community/node_details/pr_impact`. | Tool is fully implemented. |

### 7. `Plan/TechnicalSpec.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 20 | `packages/mcp/` | Change to `packages/mcp-server/`. | Actual package name is `mcp-server`. |
| 21 | `packages/runtime/` | Change to `packages/executor/`. | Actual package name is `executor`. |
| 22 | `packages/meeting-room/` | Change to `packages/headroom/`. | Actual package name is `headroom`. |
| 23 | `packages/governor/` | Change to `packages/permissions/`. | Actual package name is `permissions`. |
| 24 | `packages/trace/` | Change to `packages/tracer/`. | Actual package name is `tracer`. |
| 8 | `State: SQLite (better-sqlite3) + JSONL event stream` | Change to `State: JSONL event stream; SQLite not currently in use.` | `better-sqlite3` is not a dependency; mocks exist in `test/mocks/sqlite.ts` but no production SQLite layer is implemented. |
| 12 | `Build: tsc + esbuild for binaries` | Change to `Build: tsc`. | `esbuild` is not in `package.json` or `tsconfig`. |
| 99 | `accessLevel: "cto" \| "agent"` | Remove or mark as aspirational; current `GlideTool` objects do not enforce `accessLevel`. | `types.ts` defines `accessLevel` as optional metadata; no enforcement exists in `server.ts`. |

### 8. `Plan/Architecture.md` (Persian)

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 3 | `...این سند نسخه جدیدتر ایده اصلی در RawIdea.md است...` | No change needed; this is accurate. | N/A |
| 206 | `packages/mcp-server` listed under 6.1 Packages | Change to match actual workspace: `packages/mcp-server` is already correct here, but ensure all other plan docs use the same name. | Cross-doc consistency. |
| 224 | `simple-git — trace via git blame` | Add caveat: “Declared in `tracer/package.json` but not imported in `tracer.ts`; git-blame integration is stubbed.” | Prevents readers from assuming the feature works. |

### 9. `Plan/ImplementationPlan-vs-Reality.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 9 | `9 workspace packages (8 + example-plugin)` | Change to `9 workspace packages (8 + example-plugin) + plugins/example-bundle`. | `example-bundle` exists and is wired. |
| 16 | `READMEs (root + 8 packages)` | Change to `READMEs (root + 8 packages + plugins/example-plugin)`. | Incomplete count. |
| 41 | `pnpm test -- --coverage ✅ 97.33% stmts` | Update to current coverage threshold and actual numbers after a fresh run. | Coverage numbers drift across runs. |

### 10. `Plan/ArchitectureReview-2026-08-11.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 121 | `README.md lists packages/mcp-server in repo structure ... pnpm-workspace.yaml and actual packages do not include packages/mcp-server` | Change to: `README.md lists packages/mcp-server; pnpm-workspace.yaml includes it via packages/*, but some plan docs (TechnicalSpec.md) still use the old packages/mcp/ name.` | The package *does* exist; only `TechnicalSpec.md` is stale. |

---

## Production-Grade Documentation Standards Gaps

The audited docs fail the following production-grade criteria:

| Criterion | Current State | Required State |
|-----------|---------------|----------------|
| **Single source of truth for API shapes** | `docs/api.md`, `README.md`, package READMEs, and tool `.ts` files all describe the same tools with different counts and schemas. | Generate API docs from `src/tools/*.ts` or maintain a single JSON schema manifest; diff in CI. |
| **Versioned docs** | No version tags, changelogs, or migration guides. | Add `docs/CHANGELOG.md` and date/version headers to plan docs. |
| **Error schema table** | `docs/api.md:146-148` mixes protocol-level and domain-level error codes without separation. | Two tables: JSON-RPC envelope errors vs. tool payload `error` codes vs. `PluginLoadError` codes. |
| **Security/safety callouts** | No security section in any README or API doc. | Add a `SECURITY.md` or `docs/security.md` documenting `execSync` risks, JSON.parse untrusted input, and plugin sandboxing gaps. |
| **Conformance testing** | No doc-lint or doc-test step in CI. | Add a CI job that validates: tool count in `README.md` == `Object.keys(require('./src/tools'))`, path existence for hardcoded binaries, and schema lint for `docs/api.md`. |
| **ASCII-armoring / framing docs** | No mention that the MCP stdio server expects newline-delimited JSON-RPC frames. | Add a `docs/protocol.md` section documenting framing, backpressure, and timeout expectations. |

---

## Recommended Immediate Fixes (Priority Order)

1. **Fix tool counts everywhere.** Update `README.md`, `docs/api.md`, `packages/mcp-server/README.md` from 14 → 17 and add the three missing tools.
2. **Fix `glide_graph` action enum in `docs/api.md`.** Use snake_case matching the implementation.
3. **Fix Hermes config paths in `README.md` and `docs/hermes-mcp.md`.** Replace host-specific paths with placeholders or installer-generated values.
4. **Fix `glide_status` `phase` field.** Either update to a real version string or remove the field.
5. **Fix `docs/api.md` `glide_indepth` output path documentation.** Document the overrideable `output_dir`.
6. **Sync `Plan/*.md` metrics.** Update test counts, coverage numbers, and Phase 6 status to match current reality.
7. **Fix `Plan/TechnicalSpec.md` package names.** Replace `mcp`, `runtime`, `meeting-room`, `governor`, `trace` with actual names.
8. **Fix `packages/plugin-api/README.md` type description.** Clarify that `PluginEntrypointDescriptor` is nested.
9. **Document `prImpact` mock honestly.** In `README.md` and `docs/api.md`, note that `pickFilesForPr` is deterministic and git integration is pending.
10. **Add production-grade doc standards section to `CONTRIBUTING.md` or a new `docs/STANDARDS.md`.** Require that any new tool must be added to `docs/api.md` and the root `README.md` tool list in the same PR.

---

## Files Created/Modified During Audit

- **Created:** `/media/Storage/home-gfardad/Projects/Glide/docs/DOCUMENTATION_AUDIT_2026-08-11.md` (this report)
- **Modified:** None yet. Corrections are staged above for the parent agent to apply via `patch` or equivalent.

---

## Issues Encountered

- **Host-specific paths** in multiple docs (`/media/Storage/...`, `/home/gfardad/...`) make the repo non-portable.
- **Doc generation is manual** — no tooling enforces consistency between source and markdown.
- **Plan docs are internally inconsistent** — `ImplementationPlan.md`, `ImplementationPlan-vs-Reality.md`, and `TechnicalSpec.md` contradict each other on package names, test counts, and phase status.
