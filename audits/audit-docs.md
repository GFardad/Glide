# Glide Documentation Accuracy & Completeness Audit

**Date:** 2026-08-11
**Auditor:** Hermes subagent
**Scope:** `README.md`, `docs/*.md`, `packages/*/README.md`, `Plan/*.md`
**Source of truth:** Actual TypeScript source in `/media/Storage/home-gfardad/Projects/Glide/`

---

## Executive Summary

- **Doc/code drift is significant.** Counts, paths, package names, tool names, and API shapes are inconsistent across 7+ files.
- **The most damaging errors are:** wrong tool counts (14 vs 17), missing tools in tool lists, mismatched Hermes config paths, wrong `glide_graph` action enum casing, missing `phase` field docs, and stale `Plan/*.md` metrics.
- **Production-grade doc standards require:** machine-readable API contracts, versioned docs, error-schema tables, and CI validation. None of the audited docs meet this bar today.

---

## Exact Line-by-Line Corrections

### 1. `README.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 4 | `production-grade multi-agent mega harness.` | `production-grade deterministic multi-agent orchestration harness.` | Aligns with repo description; “mega harness” is vague. |
| 14-21 | Architecture block omits `glide_graph` and `glide_gates` | Add `glide_graph` and `glide_gates` to the architecture block. | The MCP server exposes 17 tools; the diagram only shows 14. |
| 30 | `packages/plugin-api` row says “MCP plugin registry + loader + Prime-Agent session durability” | Correct to: `Plugin registry, loader contracts (`IPluginLoader`), `PrimeAgentSessionDurability`, and `CompositionRegistry` for bundle composition.` | Missing composition surface; README under-describes the package. |
| 32 | `packages/mcp-server` — “exposing all **14** glide_* tools” | Change **14** to **17**. | `src/tools/index.ts:37-55` registers 17 tools. |
| 43-46 | Tool list omits `glide_graph`, `glide_converge`, `glide_gates` | Add `glide_converge`, `glide_gates`, `glide_graph` to the comma-separated list. | Same root cause: stale tool count. |
| 66-70 | Hermes wiring block uses `/media/Storage/home-gfardad/Projects/Glide/...` | Replace absolute path with a placeholder or installer-generated value, or add a note: “Replace with your absolute repo path.” | Hardcoding `/media/Storage/...` breaks every other host; `docs/hermes-mcp.md` also hardcodes `/home/gfardad/...`, so both docs are host-specific. |
| 89-91 | `README.md` claims `GraphifyClient` exposes `prImpact` with “real file-diff integration” | Rewrite: “`prImpact` currently uses a deterministic mock (`pickFilesForPr`); replace with `git diff --name-only` when git history is available.” | `packages/tracer/src/graphify.ts:223-225` explicitly states this is a mock. |
| 53 | `pnpm test         # vitest (300 tests / 46 files)` | Update to current actual count. | Stale metric; see metrics section below. |

### 2. `docs/api.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 4 | `exposing 17 tools` then later lists 14 names | Update the tool list block to include all 17 names. | Inconsistent internal counts. |
| 14 | `Output: { ok, tool, packages, plugins, version }` | Add `phase` field: `{ ok, tool, packages, plugins, version, phase }` | `glide-status.ts:19` returns `phase`. |
| 67 | `<workspace>/runtime/workspace/indepth/<agent_id>.md` | Change to `<output_dir>/<agent_id>.md` where `output_dir` defaults to `${workspace}/runtime`. | The tool accepts an overrideable `output_dir` (`glide-indepth.ts:22-28`). |
| 128-132 | `glide_graph` action enum documented as `read/query/shortestPath/community/nodeDetails/prImpact` | Change enum values to snake_case matching actual implementation: `graph_stats`, `query`, `shortest_path`, `community`, `node_details`, `pr_impact`. | `glide-graph.ts:14-21` defines snake_case enum. |
| 146 | `isError?: true` | Change to `isError: true` or document that `isError` is a boolean flag on the MCP response envelope, not inside `content[0].text`. | The actual tool returns `CallToolResult`; error shaping should be documented at the protocol level. |
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
| 33 | `node scripts/verify-hermes-config.cjs` | Add `pnpm`-aware invocation note: run from repo root. | Script exists and works, but docs don’t mention it must be run from repo root. |

### 5. `packages/plugin-api/README.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 7 | `PluginDescriptor / PluginInstance / PluginEntrypointDescriptor — manifest contract (kind: "mcp" \| "agent-hook" \| "skill")` | Rewrite: `PluginDescriptor` contains `entrypoint: PluginEntrypointDescriptor`; `PluginEntrypointDescriptor` is a nested object, not a standalone manifest root. | `types.ts:12-22` shows `PluginEntrypointDescriptor` is a property of `PluginDescriptor`, not an independent top-level contract. |
| 25 | `Reference implementation: plugins/example-plugin.` | Add second reference: `plugins/example-bundle` demonstrates `CompositionRegistry` bundle composition. | `example-bundle` exists but is undocumented. |

### 6. `Plan/TechnicalSpec.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 20 | `packages/mcp/` | Change to `packages/mcp-server/`. | Actual package name is `mcp-server`. |
| 21 | `packages/runtime/` | Change to `packages/executor/`. | Actual package name is `executor`. |
| 22 | `packages/meeting-room/` | Change to `packages/headroom/`. | Actual package name is `headroom`. |
| 23 | `packages/governor/` | Change to `packages/permissions/`. | Actual package name is `permissions`. |
| 24 | `packages/trace/` | Change to `packages/tracer/`. | Actual package name is `tracer`. |
| 8 | `State: SQLite (better-sqlite3) + JSONL event stream` | Change to `State: JSONL event stream; SQLite not currently in use.` | `better-sqlite3` is not a dependency; mocks exist in `test/mocks/sqlite.ts` but no production SQLite layer is implemented. |
| 12 | `Build: tsc + esbuild for binaries` | Change to `Build: tsc`. | `esbuild` is not in `package.json` or `tsconfig`. |

### 7. `Plan/ImplementationPlan.md` and `Plan/ImplementationPlan-vs-Reality.md`

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| various | Stale test counts, coverage numbers, phase status | Update to current actual values. | See metrics section below. |

### 8. `Plan/Architecture.md` (Persian)

| Line | Current Text | Required Correction | Rationale |
|------|-------------|---------------------|-----------|
| 224 | `simple-git — trace via git blame` | Add caveat: “Declared in `tracer/package.json` but not imported in `tracer.ts`; git-blame integration is stubbed.” | Prevents readers from assuming the feature works. |

---

## Metrics Corrections

### Test Counts

Current `README.md:53` claims:
```
pnpm test         # vitest (300 tests / 46 files)
```

Actual counts from `test/` directory:
- **48 `.ts` files** total in `test/`
- **47 files** contain test code (`describe` or `it(`)
- **422** `describe`/`it(` occurrences total

The `300 tests` figure appears to be a test case count, not a file count. The actual file count is **47–48**, not 46.

### Coverage Numbers

`Plan/ImplementationPlan-vs-Reality.md:41` claims `97.33% stmts`. This is a stale snapshot and should be updated to reflect the current `pnpm test -- --coverage` run.

### Tool Count

All docs that mention `14` tools should be updated to `17`. The actual tool registry is at `packages/mcp-server/src/tools/index.ts:37-55` and contains exactly 17 tools.

### Package Count

`README.md` and plan docs list varying package counts. The actual workspace packages are:

| Package | Directory | package.json name |
|---------|-----------|-------------------|
| CLI | `packages/cli/` | `@glide/cli` |
| Core | `packages/core/` | `@glide/core` |
| Dashboard | `packages/dashboard/` | `@glide/dashboard` |
| Executor | `packages/executor/` | `@glide/executor` |
| Headroom | `packages/headroom/` | `@glide/headroom` |
| MCP | `packages/mcp/` | *(no package.json found)* |
| MCP Server | `packages/mcp-server/` | `@glide/mcp-server` |
| Permissions | `packages/permissions/` | `@glide/permissions` |
| Plugin API | `packages/plugin-api/` | `@glide/plugin-api` |
| Tracer | `packages/tracer/` | `@glide/tracer` |

**Note:** `packages/mcp/` exists as a directory but has no `package.json`. This is a potential orphaned directory and should be investigated.

---

## Host-Specific Paths

The following docs contain hardcoded absolute paths that break portability:

| File | Line | Path |
|------|------|------|
| `README.md` | 70 | `/media/Storage/home-gfardad/Projects/Glide/packages/mcp-server/dist/index.js` |
| `docs/hermes-mcp.md` | 14 | `/home/gfardad/Projects/Glide/packages/mcp-server/dist/index.js` |

**Fix:** Replace with placeholders or installer-generated values. Example:
```yaml
args:
  - <REPO_ROOT>/packages/mcp-server/dist/index.js
```

---

## API Shape Inconsistencies

### `glide_status` output schema

`docs/api.md:14` documents:
```
{ ok, tool, packages, plugins, version }
```

Actual return (`glide-status.ts:16-20`):
```
{ status: "ok", version: "0.1.0", phase: "1-2" }
```

**Discrepancies:**
- `ok` vs `status` (field name mismatch)
- `phase` field is undocumented
- `packages` and `plugins` are not returned by `glide_status`

### `glide_graph` action enum

`docs/api.md:128-132` documents camelCase actions:
```
read, query, shortestPath, community, nodeDetails, prImpact
```

Actual enum (`glide-graph.ts:14-21`):
```
graph_stats, query, shortest_path, community, node_details, pr_impact
```

### `glide_indepth` output path

`docs/api.md:67` documents:
```
<workspace>/runtime/workspace/indepth/<agent_id>.md
```

Actual behavior (`glide-indepth.ts:28`):
```
<output_dir>/<agent_id>.md
```
where `output_dir` defaults to `${workspace}/runtime` (not `${workspace}/runtime/workspace/indepth`).

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
| **Protocol framing docs** | No mention that the MCP stdio server expects newline-delimited JSON-RPC frames. | Add a `docs/protocol.md` section documenting framing, backpressure, and timeout expectations. |

---

## Recommended Immediate Fixes (Priority Order)

1. **Fix tool counts everywhere.** Update `README.md`, `docs/api.md`, `packages/mcp-server/README.md` from 14 → 17 and add the three missing tools (`glide_graph`, `glide_converge`, `glide_gates`).
2. **Fix `glide_graph` action enum in `docs/api.md`.** Use snake_case matching the implementation.
3. **Fix Hermes config paths in `README.md` and `docs/hermes-mcp.md`.** Replace host-specific paths with placeholders.
4. **Fix `glide_status` output schema in `docs/api.md`.** Document `status` (not `ok`) and add `phase`.
5. **Fix `docs/api.md` `glide_indepth` output path documentation.** Document the overrideable `output_dir`.
6. **Sync `Plan/*.md` metrics.** Update test counts, coverage numbers, and package names to match current reality.
7. **Fix `Plan/TechnicalSpec.md` package names.** Replace `mcp`, `runtime`, `meeting-room`, `governor`, `trace` with actual names.
8. **Fix `packages/plugin-api/README.md` type description.** Clarify that `PluginEntrypointDescriptor` is nested.
9. **Document `prImpact` mock honestly.** In `README.md` and `docs/api.md`, note that `pickFilesForPr` is deterministic and git integration is pending.
10. **Add production-grade doc standards section to `CONTRIBUTING.md` or a new `docs/STANDARDS.md`.** Require that any new tool must be added to `docs/api.md` and the root `README.md` tool list in the same PR.

---

## Files Created/Modified During Audit

- **Created:** `/media/Storage/home-gfardad/Projects/Glide/audits/audit-docs.md` (this report)
- **Modified:** None yet. Corrections are staged above for the parent agent to apply via `patch` or equivalent.

---

## Issues Encountered

- **Host-specific paths** in multiple docs (`/media/Storage/...`, `/home/gfardad/...`) make the repo non-portable.
- **Doc generation is manual** — no tooling enforces consistency between source and markdown.
- **Plan docs are internally inconsistent** — `ImplementationPlan.md`, `ImplementationPlan-vs-Reality.md`, and `TechnicalSpec.md` contradict each other on package names, test counts, and phase status.
- **`packages/mcp/` exists without `package.json`** — potential orphaned directory that should be investigated.
- **Previous audit exists** at `docs/DOCUMENTATION_AUDIT_2026-08-11.md` with similar findings; this audit consolidates and extends those findings with current source-of-truth verification.
