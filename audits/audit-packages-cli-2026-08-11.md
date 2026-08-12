# Audit: `packages/cli` vs Architecture Plan & Production-Grade CLI Standards

Repo: /media/Storage/home-gfardad/Projects/Glide
Source of truth: `packages/cli/src/cli.ts`
Line references are exact for the current file.

---

## 1. Architecture Plan Alignment

### 1.1 CLI transport must use MCP stdio control plane
- Plan: `Architecture.md` 3.1, 3.3; `TechnicalSpec.md` 9.
- Implementation: lines 427-442.
- Finding: transport is a raw `child_process.spawn` loop. It is manually framing JSON-RPC over stdio instead of using the `@modelcontextprotocol/sdk` `StdioClientTransport`. This increases stdio fragility and diverges from the architecture’s explicit `MCP stdio` mandate.
- Severity: **HIGH**

### 1.2 CLI should not bypass public package APIs
- Plan: `Architecture.md` 19, 233-234.
- Implementation: line 427.
- Finding: `callTool` spawns the MCP server binary directly. This tightly couples CLI to server distribution layout, bypassing any future package-level control-plane API.
- Severity: **MEDIUM**

### 1.3 Doc/code drift on CLI implementation path
- Plan: `ImplementationPlan.md` 131-132, `README.md` 78-86.
- Implementation: lines 313-325.
- Finding: plan still says `scripts/glide.mjs` is next work, but `packages/cli/src/cli.ts` exists and root `package.json:19` already exposes `pnpm glide`. Help text and documentation also omit the CLI wrapper from CLI docs while README only shows server invocation.
- Severity: **MEDIUM**

---

## 2. Production-Grade CLI Standard Violations

### 2.1 Hand-rolled argv parsing instead of framework semantics
- File: `packages/cli/src/cli.ts`
- Lines: 283-311, 524-558, 567-684
- Finding: argument parsing is custom string scanning with ad-hoc `--flag value` rules. No Commander, oclif, yargs, or comparable parser.
- Production expectation: Commander/oclif provide typed flags, defaults, required validation, usage synthesis, and help-after-error behavior.
- Severity: **MEDIUM**

### 2.2 Unknown option handling is unsafe
- File: `packages/cli/src/cli.ts`
- Lines: 547-558
- Finding: unrecognized flags are silently treated as strings, then later some become `true`. There is no strict unknown-option rejection, so typos like `--fo` are accepted instead of rejected.
- Severity: **MEDIUM**

### 2.3 Argument type validation is minimal
- File: `packages/cli/src/cli.ts`
- Lines: 339-348
- Finding: `readFlagJson` coerces booleans and numbers, but `readFlag` returns strings, and numeric validation is only `Number.isNaN` after `Number(...)`. No `min`, `max`, enum, or required option checks are centralized.
- Severity: **LOW**

### 2.4 Exit code discipline is inconsistent
- File: `packages/cli/src/cli.ts`
- Lines: 513, 520, 532, 695, 706, 714
- Finding: uses `process.exit(2)` for parse/usage errors, `process.exit(1)` for tool error, and `process.exit(0)` otherwise. This matches POSIX CLI conventions, but there is no structured `CliError` typing for programmatic consumers and error codes are not surfaced via `--json` in parse failures.
- Severity: **LOW**

### 2.5 Single-request lifecycle spawn per tool call
- File: `packages/cli/src/cli.ts`
- Lines: 426-442, 350-361
- Finding: `callTool` spawns a new server process for every CLI invocation, sends `initialize`, then one `tools/call`, then kills it. This makes the CLI expensive and prevents streaming/long-running tool use.
- Production expectation: persistent stdio transport or session-aware daemon; initialize once, reuse for follow-up tool calls.
- Severity: **HIGH**

### 2.6 No backpressure-aware stdio writes
- File: `packages/cli/src/cli.ts`
- Lines: 414-416, 401-407
- Finding: stdin write is fire-and-forget; if stdout stalls, backpressure is ignored. Timeout logic covers response wait but not transport stalls.
- Severity: **MEDIUM**

### 2.7 Stderr separation and structured logging absent
- File: `packages/cli/src/cli.ts`
- Lines: 429, 688, 728
- Finding: errors go to `console.error`, but there is no structured JSON log envelope, log levels, or correlation IDs. `callTool` sets `stdio: ["pipe","pipe","inherit"]`, so tool stderr is merged into parent stderr instead of isolated/logged.
- Severity: **MEDIUM**

### 2.8 Help discovery is static and duplicated
- File: `packages/cli/src/cli.ts`
- Lines: 58-281
- Finding: help strings are hard-coded in `printHelp` and `printCommandHelp`. Adding a command requires manual updates to `COMMANDS`, the switch block, and help text; drift is likely.
- Production expectation: derive help from a central tool registry or use a framework that auto-generates subcommand docs.
- Severity: **MEDIUM**

### 2.9 Command alias logic is incorrect/incomplete
- File: `packages/cli/src/cli.ts`
- Lines: 525-536
- Finding: `resolveCommand(aliasMap[rawCommand] ?? "")` may return `""` for unknown commands, then `!command` prints unknown command, but `resolveCommand` is called twice and the alias map is not reused in `printCommandHelp`.
- Severity: **LOW**

### 2.10 JSON output contract is ambiguous
- File: `packages/cli/src/cli.ts`
- Lines: 710-722
- Finding: for `--format json`, if `content[0].text` is already JSON, it is printed raw; otherwise falls back to `console.log(text)`. This means `--json` does not guarantee structured output, only a best-effort parse.
- Severity: **MEDIUM**

### 2.11 Timeout is fixed and not configurable
- File: `packages/cli/src/cli.ts`
- Lines: 401-407
- Finding: 10-second timeout is hard-coded. Long-running tools such as `glide_headroom` or `glide_trace` may need longer timeouts or retry policies.
- Severity: **MEDIUM**

---

## 3. MCP/Transport-Specific Findings

### 3.1 Initialize handshake is minimal
- File: `packages/cli/src/cli.ts`
- Lines: 351-360
- Finding: client capabilities and clientInfo are empty/minimal; no server capabilities negotiation beyond accepting the response. For production CLI, `initialize` should validate server protocol version and capabilities.
- Severity: **LOW**

### 3.2 No notifications handling
- File: `packages/cli/src/cli.ts`
- Lines: 377-396
- Finding: `handleData` ignores server notifications or out-of-order messages once `settled` is true, but never logs them. Production stdio clients usually surface or log lifecycle notifications.
- Severity: **LOW**

### 3.3 Tool response contract assumptions
- File: `packages/cli/src/cli.ts`
- Lines: 699-722
- Finding: assumes `result.content[0].text` and `envelope.error.code` are always present. If the server returns multiple content items or different error shapes, CLI silently degrades.
- Severity: **MEDIUM**

---

## 4. Test Coverage Observations

### 4.1 CLI tests exercise happy paths, not transport failures
- File: `test/cli.test.ts`
- Lines: 1-141
- Finding: tests verify command dispatch, text/json output, and tool routing. There are no tests for malformed server output, timeout behavior, spawn failure, unknown flag strictness, or large payload handling.
- Severity: **MEDIUM**

### 4.2 CLI tests depend on built artifact path
- File: `test/cli.test.ts`
- Line: 6
- Finding: `CLI_ENTRY` is `packages/cli/dist/cli.js`; tests require prebuilt output. CI must build before testing, or tests will fail silently.
- Severity: **LOW**

---

## 5. Recommended Remediations (Priority Order)

1. Replace hand-rolled transport with `@modelcontextprotocol/sdk` `StdioClientTransport` or keep a minimal single-session persistent spawn lifecycle.
2. Centralize command/tool registry and derive parser, help, and dispatch from it.
3. Add strict option parsing with typed defaults, required enforcement, and unknown-option rejection.
4. Isolate tool stderr and add structured JSON logging with request/correlation IDs.
5. Make timeout and retry configurable per command.
6. Improve JSON output contract: emit machine-readable envelope when `--json` is set, even on parse failures.
7. Expand tests to cover transport failure modes and malformed envelopes.
8. Synchronize docs with CLI presence and supported commands.

---

## 6. Summary

- Did: audited `packages/cli/src/cli.ts` line by line, cross-referenced `Plan/*`, `README.md`, and `test/cli.test.ts`, and researched production CLI/transport patterns from Commander, oclif, and MCP stdio guidance.
- Found: CLI satisfies basic command dispatch and smoke tests, but deviates from the repo’s production-grade standards on transport robustness, structured parsing, framework reuse, help/error discipline, and observability.
- Files created/modified: none; only read-only inspection.
- Blockers: none.
