# Glide TypeScript Security Audit
Scope: all `*.ts` source files under `/media/Storage/home-gfardad/Projects/Glide`, excluding `dist` and `node_modules`.
Reference: OWASP Node.js Security Cheat Sheet / OWASP Top 10 for common web/service codebases.

## Executive Summary
- High: 2 confirmed command-injection surfaces (`execSync`, external command spawn)
- Medium: 2 path-handling risks (untrusted output path, filesystem writes from CLI args)
- Medium: 2 unsafe-deserialization points (`JSON.parse` without schema validation on persisted/DB data)
- Low: 1 semantic correctness / unexpected FS access bug
- Info: no hardcoded secrets or weak-crypto usage found in TypeScript source

---

## Findings

### 1) Command injection via `execSync` in gates runner
- File: `packages/permissions/src/gates.ts`
- Lines: 28-35
- Code:
  ```ts
  function runCliCommand(command: string, cwd: string): string {
    const timeoutMs = 120_000;
    return execSync(command, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
  }
  ```
- Risk: `command` is executed verbatim. Any caller-controlled string reaching this function can run arbitrary OS commands in `cwd`.
- Impact: arbitrary code execution in the process context.
- Remediation:
  - Replace shell execution with an allowlisted command map and array args (`spawn(command, [args...])`).
  - If shell execution is absolutely required, sanitize/validate and never interpolate untrusted input.
  - Add explicit `input_schema` validation before invoking gates from external interfaces.

### 2) Arbitrary external command spawn in executor
- File: `packages/executor/src/executor.ts`
- Lines: 74-93, especially 88
- Code:
  ```ts
  export function spawnAgent(options: SpawnAgentOptions): AgentHandle {
    ...
    const child = spawn(options.command, options.args ?? [], {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    ...
  }
  ```
- Risk: `options.command` is not validated against an allowlist. An attacker who controls program input can spawn arbitrary binaries with inherited environment variables.
- Impact: remote/arbitrary command execution, environment leakage, child process compromise.
- Remediation:
  - Validate `options.command` against a strict allowlist.
  - Remove inherited secrets from `env` unless explicitly required.
  - Consider process sandboxing / capability constraints for spawned agents.

### 3) Path traversal / untrusted write path in indepth tool
- File: `packages/mcp-server/src/tools/glide-indepth.ts`
- Lines: 21-34
- Code:
  ```ts
  const outputDir =
    (args["output_dir"] as string | undefined) ??
    `${String(workspace)}/runtime/workspace/indepth`;
  ...
  const path = `${outputDir}/${agentId}.md`;
  ...
  fs.mkdirSync(pathModule.dirname(path), { recursive: true });
  fs.writeFileSync(path, md, "utf8");
  ```
- Risk: `output_dir` is user-supplied and concatenated into a filesystem path without normalization or containment checks. `../` sequences can write outside the workspace.
- Impact: arbitrary file write, possible code execution if markdown lands in a loaded/runtime path.
- Remediation:
  - Normalize with `path.resolve` and verify resolved path is within an allowed root.
  - Reject absolute paths or traversal components.
  - Sanitize `agentId` for filesystem use.

### 4) Semantic FS bug / directory-as-file read in presence gate
- File: `packages/permissions/src/gates.ts`
- Lines: 130-158, especially 141-144
- Code:
  ```ts
  for (const testDir of testDirs) {
    if (existsSync(testDir) && statSync(testDir).isDirectory()) {
      const files = readFileSync(testDir, "utf8");
      if (files.trim().length > 0) {
        hasTests = true;
        detail = `Tests found in ${testDir}`;
        break;
      }
    }
  }
  ```
- Risk: `readFileSync` is called on a directory path. Behavior is platform-dependent and semantically incorrect. It can throw or return implementation-specific data.
- Impact: runtime errors, unreliable gate behavior, potential information leakage depending on platform FS implementation.
- Remediation:
  - Use `readdirSync(testDir)` and check for file contents or test file patterns.

### 5) Unsafe deserialization / missing schema validation on persisted JSON
- File: `packages/headroom/src/goal-store.ts`
- Lines: 81, 202-205
- Code:
  ```ts
  if (metadataRaw) record.metadata = JSON.parse(metadataRaw as string) as Record<string, unknown>;
  ...
  .map((line) => JSON.parse(line) as GoalRecord);
  ```
- Risk: `JSON.parse` results are trusted without schema validation. If the file or DB field is tampered with, malformed or malicious structures propagate through the app.
- Impact: downstream type confusion, crashes, or logic bypass if runtime behavior branches on attacker-controlled metadata.
- Remediation:
  - Validate parsed objects with `zod`/`io-ts` or similar before use.
  - Add integrity checks (e.g., checksums or signed manifests) for persisted state files.

### 6) Session/plugin state deserialization without integrity checks
- Files:
  - `packages/plugin-api/src/durability.ts`: 60-61, 100-103, 120-127
  - `packages/plugin-api/src/session.ts`: 65-70, 152-157
  - `packages/executor/src/session.ts`: 47-52
- Risk: Multiple `readFileSync(...).split("\n").map(JSON.parse)` patterns read local state files without validation. Tampered JSONL can inject unexpected records.
- Impact: state corruption, privilege or workflow manipulation in local-use contexts.
- Remediation:
  - Validate each parsed record against expected schemas.
  - Consider append-only signed events or write-ahead checksums.

---

## Positive Security Observations
- `packages/tracer/src/graphify.ts:49-58` explicitly validates resolved graph file path stays within project root.
- Permission model in `packages/permissions/src/runtime.ts` validates actions against allowed sets and `secrets` scope.
- Child process usage in `cli.ts` and `executor.ts` mostly uses array-form `spawn` (no shell=True), reducing injection risk in those paths.

---

## Recommendations by Priority
1. Remove/replace `execSync` in `gates.ts` or sandbox it with strict allowlist + no untrusted interpolation.
2. Allowlist `options.command` in `executor.ts` and stop inheriting full `process.env`.
3. Add path containment checks to every tool that accepts user-supplied output/write paths.
4. Add runtime schema validation for all persisted JSON/JSONL reads.
5. Fix `testPresenceGate` to use directory listing instead of `readFileSync` on a folder.
6. Add security-focused unit tests covering traversal, command strings, and malformed state files.
