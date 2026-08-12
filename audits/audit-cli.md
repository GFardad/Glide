# @glide/cli — Architecture & Production-Grade CLI Audit

**Audit scope:** `packages/cli/src/cli.ts`, `packages/cli/package.json`, `packages/cli/tsconfig.json`  
**Reference docs:** `Plan/Architecture.md`, `Plan/ImplementationPlan.md`, `Plan/TechnicalSpec.md`, `README.md`  
**Date:** 2026-08-11

---

## 1. Executive Summary

`packages/cli` implements a thin stdio JSON-RPC client that spawns the MCP server, forwards tool calls, and pretty-prints results. It satisfies basic smoke tests and command routing, but it deviates from the repository's stated production-grade standards on transport robustness, framework reuse, argument validation, observability, and lifecycle management.

**Top-line verdict:** the CLI is functional but not production-grade. The highest-risk issue is the per-invocation server spawn lifecycle, which makes the tool expensive, non-streaming, and fragile.

---

## 2. Architecture Alignment

### 2.1 MCP stdio control plane
- **Plan:** `Architecture.md` §3.1, §3.3; `README.md` CLI section.
- **Finding:** `packages/cli/src/cli.ts:427-442` manually spawns `node packages/mcp-server/dist/index.js` and hand-frames JSON-RPC over stdio. The architecture explicitly uses MCP stdio as the command surface, but it does not mandate hand-rolled framing. Using `@modelcontextprotocol/sdk`'s `StdioClientTransport` would align with the rest of the monorepo's SDK dependency and reduce stdio edge-case risk.
- **Severity:** HIGH

### 2.2 Public API boundary
- **Plan:** `Architecture.md` §6.4 — "between packages only public API is used."
- **Finding:** `packages/cli/src/cli.ts:427` bypasses any package-level API by shelling out to a compiled `dist` path. This couples the CLI to build output layout and makes refactoring the server entry point a CLI-breaking change.
- **Severity:** MEDIUM

### 2.3 Package listing completeness
- **Plan:** `Architecture.md` §6.1 lists `core`, `mcp-server`, `headroom`, `executor`, `tracer`, `permissions`, `plugin-api`. There is no `packages/cli` in the architecture.
- **Finding:** `packages/cli` is an undocumented package in the architecture. Either the plan must be updated to include it, or the package must be folded into `mcp-server` or a dedicated `cli` workspace with documented ownership.
- **Severity:** LOW

### 2.4 Prime-Agent wiring expectation
- **Plan:** `Architecture.md` §3.2 — "Prime-Agent: context/session durability + process spawning + session budget."
- **Finding:** The CLI spawns a fresh server process per invocation (`packages/cli/src/cli.ts:427-442`). It does not participate in session durability, budget, or reuse. This is acceptable for a thin CLI wrapper, but it means the CLI cannot be used for long-running or streaming tool interactions, which limits its production viability.
- **Severity:** MEDIUM

---

## 3. Production-Grade CLI Standards Review

### 3.1 Argument parsing
- **Finding:** `packages/cli/src/cli.ts:283-311` implements a custom argv scanner. It manually detects `--flag value`, lowercases format values, and rejects nothing except explicit `--format` validation. Production CLIs use Commander, oclif, yargs, or comparable frameworks that provide typed flags, defaults, required enforcement, usage synthesis, and automatic help generation.
- **Gaps:**
  - No strict unknown-option rejection (`packages/cli/src/cli.ts:547-558`).
  - No centralized schema for commands, flags, and positional args.
  - Help text is hand-maintained and duplicated across `printHelp` and `printCommandHelp` (`packages/cli/src/cli.ts:58-281`).
- **Severity:** MEDIUM

### 3.2 Help discipline
- **Finding:** Help strings are hard-coded (`packages/cli/src/cli.ts:58-281`). Adding a command requires manual updates in at least four places: `COMMANDS` array, alias map, dispatch switch, and help strings. This is a known drift vector.
- **Severity:** MEDIUM

### 3.3 Output contract
- **Finding:** `packages/cli/src/cli.ts:710-722` prints `result.content[0].text` raw for `--format json`, then falls back to `console.log(text)` if it is not valid JSON. This means `--json` does not guarantee structured output. A production CLI should emit a stable JSON envelope regardless of payload parseability.
- **Severity:** MEDIUM

### 3.4 Logging and observability
- **Finding:** Errors are printed via `console.error` (`packages/cli/src/cli.ts:513,688,728`). There is no structured log envelope, log levels, or correlation IDs. Tool stderr is inherited (`packages/cli/src/cli.ts:429`), mixing server diagnostics with CLI diagnostics.
- **Severity:** MEDIUM

### 3.5 Error handling and exit codes
- **Finding:** `packages/cli/src/cli.ts:513,520,532,695,706,714` uses `process.exit(2)` for usage errors, `process.exit(1)` for tool errors, and `process.exit(0)` otherwise. This is POSIX-compatible, but parse errors do not emit structured JSON error envelopes, and the CLI does not distinguish between "tool returned error" and "transport failed."
- **Severity:** LOW

### 3.6 Timeout and retry
- **Finding:** `packages/cli/src/cli.ts:401-407` hard-codes a 10-second timeout. Long-running tools such as `glide_headroom` or `glide_trace` may need configurable timeouts or retry policies.
- **Severity:** MEDIUM

### 3.7 Transport robustness
- **Finding:** `packages/cli/src/cli.ts:350-424` implements a one-shot JSON-RPC request/response loop. It ignores backpressure on stdin (`packages/cli/src/cli.ts:414-416`) and silently drops server notifications after settlement (`packages/cli/src/cli.ts:377-396`). There is no reconnect, no retry, and no streaming support.
- **Severity:** HIGH

---

## 4. Line-by-Line Findings

### 4.1 Transport and process lifecycle
| File | Lines | Finding | Severity |
|------|-------|---------|----------|
| `packages/cli/src/cli.ts` | 427-442 | `callTool` spawns a new `node` process per invocation, sends `initialize`, one `tools/call`, then `SIGTERM`. No persistent transport, no connection reuse. | HIGH |
| `packages/cli/src/cli.ts` | 313-325 | `findMcpServer` searches three hard-coded relative paths. This is brittle when the CLI is installed globally or symlinked. | MEDIUM |
| `packages/cli/src/cli.ts` | 350-361 | `sendInitialize` sends empty/minimal `capabilities` and `clientInfo`. No protocol version negotiation or server capability validation. | LOW |
| `packages/cli/src/cli.ts` | 372-424 | `sendWithId` buffers stdout lines, parses JSON, and resolves on the first envelope matching `expectedId`, `error`, or `result`. If the server sends out-of-order or notification envelopes after settlement, they are ignored. | MEDIUM |
| `packages/cli/src/cli.ts` | 414-416 | `child.stdin.write` is fire-and-forget; backpressure is not awaited. | MEDIUM |
| `packages/cli/src/cli.ts` | 429 | Child stderr is inherited (`stdio: ["pipe","pipe","inherit"]`), so server logs bleed into the CLI's stderr stream. | MEDIUM |

### 4.2 Argument parsing and dispatch
| File | Lines | Finding | Severity |
|------|-------|---------|----------|
| `packages/cli/src/cli.ts` | 283-311 | `parseArgs` is a custom loop. It does not reject unknown flags, does not enforce required options, and treats unrecognized `--flag` as positional or boolean `true`. | MEDIUM |
| `packages/cli/src/cli.ts` | 339-348 | `readFlagJson` coerces strings to booleans/numbers with no range or enum validation. | LOW |
| `packages/cli/src/cli.ts` | 525-536 | Alias resolution calls `resolveCommand` twice and falls back to `""`, which is redundant. | LOW |
| `packages/cli/src/cli.ts` | 544-559 | Remaining args after command are re-parsed into `globalNamed`/`globalPositional`. This ignores flags that were already consumed by `parseArgs`, leading to inconsistent flag handling between early and late stages. | MEDIUM |
| `packages/cli/src/cli.ts` | 567-684 | Dispatch switch manually maps each command to a tool name and arg shape. There is no central registry, so adding a command touches multiple code paths. | MEDIUM |

### 4.3 Output formatting
| File | Lines | Finding | Severity |
|------|-------|---------|----------|
| `packages/cli/src/cli.ts` | 444-499 | `formatText` prints known keys line-by-line and dumps everything else as compact JSON. This is ad-hoc and can change shape silently when server payloads evolve. | MEDIUM |
| `packages/cli/src/cli.ts` | 699-722 | Assumes `result.content[0].text` exists and is a string. If the server returns multiple content blocks, only the first is shown. If `envelope.result` is missing `content`, output is `"No content returned."`. | MEDIUM |

### 4.4 Type safety and schema
| File | Lines | Finding | Severity |
|------|-------|---------|----------|
| `packages/cli/src/cli.ts` | 16-31 | `CliError`, `ToolCallResult`, and `JsonRpcEnvelope` are hand-rolled interfaces. `JsonRpcEnvelope.result` is `JsonValue`, which loses the structure that the MCP SDK or Zod could enforce. | LOW |
| `packages/cli/src/cli.ts` | 33-49 | `COMMANDS` is a const tuple; this is good. However, `resolveCommand` does a simple `.includes` check, so typos or casing drift are not caught at compile time beyond the tuple itself. | LOW |

### 4.5 Packaging and scripts
| File | Lines | Finding | Severity |
|------|-------|---------|----------|
| `packages/cli/package.json` | 1-22 | `bin` points to `./dist/cli.js`, which is correct. However, `dependencies` is empty; the CLI has no runtime dependencies, but it also has no lockfile or integrity metadata shown here. | LOW |
| `packages/cli/tsconfig.json` | 1-19 | Strict mode is enabled, which matches architecture §6.2. `skipLibCheck` is on, which is acceptable. | OK |

---

## 5. Test Coverage Observations

### 5.1 Existing tests
- `test/cli.test.ts` and `test/coverage-cli.test.ts` exercise happy paths: help text, text/json output, command routing, and a subset of tools (`status`, `goal-set/get`, `headroom`, `build`, `review`, `ship`, `trace`, `indepth`, `permissions`, `graph`).
- Tests spawn the compiled `dist/cli.js`, so CI must run `pnpm build` before tests.

### 5.2 Gaps
- **No transport-failure tests:** no test for malformed JSON-RPC, missing newline, spawn failure, or server crash.
- **No unknown-option strictness tests:** `test/coverage-cli.test.ts:71-75` checks invalid `--format xml`, but there is no test for unknown `--foo` or missing required positionals.
- **No timeout tests:** the 10-second timeout is untested.
- **No stderr isolation tests:** tool stderr merging is not validated.
- **No multi-invocation lifecycle tests:** no test verifies that repeated `callTool` spawns do not leak processes.

---

## 6. Prioritized Remediation Plan

| Priority | Recommendation | Target Lines | Rationale |
|----------|----------------|--------------|-----------|
| P0 | Replace hand-rolled JSON-RPC transport with `@modelcontextprotocol/sdk` `StdioClientTransport` or implement a persistent single-session spawn lifecycle. | 350-442 | Eliminates per-call spawn overhead, adds reconnect/reset semantics, and aligns with the monorepo's existing SDK dependency. |
| P0 | Add strict argv parsing with typed flags, required enforcement, and unknown-option rejection. | 283-311, 544-559 | Prevents silent acceptance of typos and reduces drift. |
| P1 | Centralize command/tool registry: derive `COMMANDS`, dispatch, help text, and arg mapping from a single source of truth. | 33-49, 58-281, 525-536, 567-684 | Eliminates duplication and drift when adding commands. |
| P1 | Make timeout configurable per command, with sensible defaults and a global `--timeout` override. | 401-407 | Supports long-running tools without making the default unsafe. |
| P1 | Isolate tool stderr and emit structured JSON logs with request correlation IDs. | 429, 688, 728 | Enables debugging in CI and production without polluting user output. |
| P2 | Stabilize `--json` output contract: always emit a machine-readable envelope, even on parse or transport failure. | 699-722 | Allows downstream automation to reliably parse CLI output. |
| P2 | Add transport-failure tests: malformed envelopes, spawn errors, timeout behavior, unknown flags, and process leak checks. | `test/cli.test.ts`, `test/coverage-cli.test.ts` | Closes the largest coverage gap in the CLI test suite. |
| P2 | Add `findMcpServer` resolution via package `exports` or workspace-relative resolution instead of hard-coded relative paths. | 313-325 | Makes the CLI installable and relocatable. |
| P3 | Replace hand-rolled `JsonRpcEnvelope`/`ToolCallResult` with SDK types or Zod-validated schemas. | 16-31 | Improves type safety and catches malformed responses earlier. |
| P3 | Document `packages/cli` in `Plan/Architecture.md` §6.1 or fold it into `packages/mcp-server` with a documented entrypoint. | `Plan/Architecture.md` | Closes the architecture/code drift on CLI ownership. |

---

## 7. Summary

- **What I did:** audited `packages/cli` line by line, cross-referenced `Plan/Architecture.md`, `Plan/ImplementationPlan.md`, `README.md`, and existing CLI tests.
- **What I found:** the CLI is functional but not production-grade. Major gaps are manual stdio framing, per-call server spawning, hand-rolled argument parsing, ad-hoc output contracts, and missing observability.
- **Files created/modified:** created `/home/gfardad/Projects/Glide/audits/audit-cli.md`. No source files were modified.
- **Issues encountered:** none; all referenced files were readable and tests are present but incomplete for failure modes.
