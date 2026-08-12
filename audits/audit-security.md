# Glide TypeScript Codebase — Security Audit

Date: 2026-08-11  
Scope: All TypeScript source files under `/media/Storage/home-gfardad/Projects/Glide/packages` and `/media/Storage/home-gfardad/Projects/Glide/plugins`  
Auditor: automated subagent

---

## Executive Summary

The codebase contains a coherent set of security primitives (path guards, command guards, capability tokens, permission policies), but several high-severity gaps allow untrusted input to influence shell execution, filesystem writes, and graph loading. Most risks stem from trusting caller-provided paths/strings without normalized allowlist enforcement in lower-level runtime modules, and from incomplete sanitization in the command executor. Fixes are straightforward: tighten path guards at runtime boundaries, replace `execSync` with `spawn` + argv validation, and harden IPC/JSONL handling.

---

## Findings

### 1. Command execution via `execSync` with shell metacharacter filtering

**Severity:** High  
**Files:**
- `packages/core/src/security/command-guard.ts:100-140`
- `packages/permissions/src/gates.ts:61-64`
- `packages/permissions/src/gates.ts:181-227`

`runAllowedCommand` blocks a few shell metacharacters (`$`, `` ` ``, `|`, `;`, `&`) only in the **first token** (`commandName`), then passes the full raw command string to `execSync`. An attacker can still inject via:
- newlines in the command string after the first token
- spaces that alter tokenization because `execSync` runs through `/bin/sh -c`
- shell globbing or redirection if future allowlist expansion re-enables broader commands

**Example risk:** command strings like `"git show HEAD:../outside && rm -rf /"` would be rejected by the first-token check, but `"git log --pretty=oneline | grep secret"` could slip if `|` were allowed elsewhere or if the tokenizer were bypassed.

**Fix:** Switch to `spawn(command, args, ...)` with an explicit argv array. Validate each argv element individually. Never invoke a shell. Enforce command allowlist on the binary name only, and pass arguments as an array.

---

### 2. Path-traversal protections missing at runtime filesystem boundaries

**Severity:** High  
**Files:**
- `packages/executor/src/runtime.ts:42-66` (`ensureAgentContract`, `loadAgentContract`)
- `packages/executor/src/runtime.ts:92-136` (`appendNote`, `markTodoDone`, `recordRejection`, `listAgents`)
- `packages/core/src/fs/agent-fs.ts:22-152` (`agentDir`, `ensureAgentFiles`, `loadAgentDirectory`, `createAgentFileContract`, `listAgentDirectories`, `cleanupAgentDirectory`)
- `packages/core/src/contract.ts:70-83` (`ensureAgentContract`)

These functions accept caller-controlled `workspace` and `agentId` strings, build paths with `join`, and read/write/delete files without ever calling `resolveAndValidatePath` or `createPathGuard`. If any caller passes `../../etc` as `workspace` or a crafted `agentId`, the application will read/write outside intended roots.

`PathGuard` exists in `packages/core/src/security/path-guard.ts` but is **not used** by the runtime/contract modules. The MCP tools (`glide-build`, `glide-plan`, etc.) do use `createPathGuard` for `campaign_dir`, but executor-facing tools (`glide-executor`, `glide-indepth`) do not apply it to `workspace`/`output_dir`.

**Fix:** All public runtime functions that touch the filesystem MUST resolve the target path, validate it against an allowlist root using `createPathGuard`, and reject traversal before any `readFileSync`/`writeFileSync`/`rmSync`.

---

### 3. IPC path creation without guard

**Severity:** High  
**File:** `packages/executor/src/executor.ts:322-326`

```ts
export function createIpcPath(baseDir: string, handleId: string): string {
  const path = join(baseDir, `glide-agent-${handleId}.ipc`);
  writeFileSync(path, "");
  return path;
}
```

`handleId` is user-controlled and can contain `../` segments. An attacker can create an empty IPC file outside `baseDir`. Later, if another component trusts this path for IPC, it may write sensitive data to an attacker-controlled location.

**Fix:** Validate `baseDir` with `createPathGuard`, sanitize `handleId` to an allowlist character set (e.g. `^[A-Za-z0-9_-]+$`), and resolve the joined path before writing.

---

### 4. Arbitrary output directory in `glide_indepth`

**Severity:** High  
**File:** `packages/mcp-server/src/tools/glide-indepth.ts:20-41`

The `output_dir` argument defaults to `join(workspace, "runtime")` but can be set to any string. There is no `createPathGuard` or `resolveAndValidatePath` call before `writeFileSync`. An attacker can dump full agent context to any filesystem location.

**Fix:** Validate `output_dir` against allowed roots with `createPathGuard`, or remove the parameter entirely and force output under the workspace.

---

### 5. Unsafe deserialization / JSON parsing without schema validation

**Severity:** Medium  
**Files:**
- `packages/core/src/fs/agent-fs.ts:51` (`JSON.parse(content)` for `contract.json` without Zod validation in `validateAgentDirectory` — note: `core/src/contract.ts` *does* validate, but `fs/agent-fs.ts` validates only minimally)
- `packages/core/src/fs/campaign-fs.ts:11` (`JSON.parse(readFileSync(constitution, "utf8"))`)
- `packages/headroom/src/goal-store.ts:40,90,123,145,170,194,219,243` (`JSON.parse` on `goals.json`, `goals.jsonl`, `goal-snapshot.json`)
- `packages/plugin-api/src/session.ts:158,229` (`JSON.parse` on session records)
- `packages/tracer/src/jsonl-writer.ts:65` (`JSON.parse` on JSONL lines)
- `packages/executor/src/session.ts:66,115` (`JSON.parse` on session event lines)
- `packages/plugin-api/src/durability.ts:63,110,144` (`JSON.parse` on plugin state)
- `packages/permissions/src/permissions.ts:40,68,83,115` (`JSON.parse` on policy/request files)

While these are mostly local-file reads, any prior write path that can be influenced by untrusted input becomes a deserialization target. There is no `JSON.parse` reviver or schema guard in most places; a malformed or maliciously crafted JSON file will throw or worse if later code trusts parsed fields.

**Fix:** Add explicit Zod schemas for every parsed JSON document and use `.parse()` instead of `JSON.parse`. Treat parse failures as hard errors, not silent skips.

---

### 6. Temp-file race / insecure permissions in `atomicWriteFileSync` and `atomicAppendFileSync`

**Severity:** Medium  
**File:** `packages/core/src/io/atomic-write.ts:9-80`

Temp paths use predictable names: `${filePath}.${process.pid}.${Date.now()}.tmp`. The file is created with default umask permissions, which can allow other local users to read/write the temp file before rename. On Linux with default umask `022`, this means world-readable temp files containing arbitrary content. There is also a TOCTOU window between `openSync` and `writeFileSync`.

**Fix:**
- Use `mkstemp`-style unique paths with `0o600` permissions.
- Write to the fd returned by `openSync` rather than using a separate `writeFileSync` call.
- Consider `O_TMPFILE` where available.

---

### 7. Error messages leak internal paths and exception details

**Severity:** Medium  
**Files:**
- `packages/core/src/security/path-guard.ts:79-95`
- `packages/core/src/security/command-guard.ts:68-88`
- `packages/executor/src/executor.ts:193-197` (`err.message` pushed to agent messages)
- `packages/mcp-server/src/server.ts:233-234` (error messages returned to client)
- `packages/mcp-server/src/bridge/HostBridge.ts:80-85` (exception name exposed)

Stack traces and raw error messages are surfaced to clients/agents. In a multi-tenant or remote scenario, this leaks filesystem layout, command names, and internal state.

**Fix:** Return sanitized error codes and generic messages to external callers. Log full errors only to a secure internal sink.

---

### 8. Unvalidated `repo_root` in `glide_converge`

**Severity:** Medium  
**File:** `packages/mcp-server/src/tools/glide-converge.ts:41-58`

`repo_root` is taken directly from caller input and passed to `runConvergeAssessment`, which recursively scans the directory tree. There is no `createPathGuard` on `repo_root`. A caller can scan any readable path on the host, not just the campaign workspace.

**Fix:** Validate `repo_root` with `createPathGuard` against allowed roots before passing it to filesystem scanning.

---

### 9. Unrestricted Graphify `projectPath`

**Severity:** Medium  
**File:** `packages/tracer/src/graphify.ts:45-58`

`GraphifyClient` defaults to `process.cwd()` and loads `graphify-out/graph.json` relative to it. Any caller that can instantiate the client can point it at an arbitrary directory and read/parse JSON files there. This bypasses campaign workspace boundaries.

**Fix:** Require callers to pass an explicit validated project path, or enforce that `graphify-out/graph.json` must resolve within an allowed root.

---

### 10. Permission bypass / weak authorization in MCP tools

**Severity:** Medium  
**Files:**
- `packages/mcp-server/src/tools/glide-executor.ts:34-136`
- `packages/mcp-server/src/tools/glide-indepth.ts:20-41`
- `packages/mcp-server/src/tools/glide-permissions.ts:20-45`

MCP tools do not check capability tokens or permission policies before performing actions. `glide-executor` accepts any `workspace`/`agent_id` and immediately mutates files. `glide-permissions` creates a subject from caller-supplied role/scopes but never validates the caller's own identity. This makes permission checks advisory rather than enforced.

**Fix:** Wire MCP tool handlers into the existing `CapabilityTokenService` and `PermissionRuntime`. Require a valid bearer token or internal capability context before touching filesystem or spawning processes.

---

### 11. In-memory-only token revocation and nonce registry

**Severity:** Medium  
**File:** `packages/permissions/src/capability-tokens.ts:45-155`

`CapabilityTokenService` stores revoked tokens and used nonces in memory `Set`s. A server restart clears all revocation state, allowing replay of previously revoked tokens. In a long-running MCP server, this means:
- Revoked tokens become valid after restart.
- Nonce replay protection is lost on restart.

**Fix:** Persist revocation state to a write-ahead log or durable store. Bound the nonce registry size with TTL eviction.

---

### 12. Unvalidated plugin entrypoints and manifest fields

**Severity:** Medium  
**Files:**
- `packages/plugin-api/src/loader.ts:29-35`
- `packages/plugin-api/src/loader.ts:38-55`
- `packages/plugin-api/src/registry.ts:26-38`
- `packages/plugin-api/src/composition.ts:197-204`

Plugin manifests declare permissions (`network`, `filesystem`, `env`, `shell`) but these are never enforced by the loader or runtime. Any plugin can perform network/filesystem operations regardless of manifest. The `entrypoint.module` string is later resolved by external loaders; if any loader uses `require()` on attacker-controlled input, this becomes an RCE vector.

**Fix:** Enforce manifest permissions in the plugin host/runtime. Validate `entrypoint.module` against an allowlist. Sandbox plugin execution.

---

### 13. Race condition in session/JSONL rotation

**Severity:** Low  
**Files:**
- `packages/tracer/src/jsonl-writer.ts:99-131`
- `packages/executor/src/session.ts:100-133`
- `packages/plugin-api/src/session.ts:57-84`

`rotateIfNeeded` reads file size, then renames files without locks. Concurrent writers can lose events or corrupt rotated files. There is no inter-process locking.

**Fix:** Use file locks (`flock`) or a single-writer process to serialize JSONL appends and rotation.

---

### 14. Weak ID randomness fallback

**Severity:** Low  
**Files:**
- `packages/executor/src/executor.ts:10-29`
- `packages/headroom/src/delta.ts:79`
- `packages/core/src/ids.ts:1-33`

Some ID generators fall back to `Math.random()` if `crypto.randomUUID` is unavailable (`executor/src/executor.ts:13-14, 20-21, 26-27`). `Math.random()` is predictable. Similarly, `snapshotId` in `delta.ts:79` uses `Math.random()` unconditionally.

**Fix:** Use `crypto.randomUUID` or `crypto.getRandomValues` exclusively. Do not fall back to `Math.random()` for security-sensitive IDs.

---

### 15. Agent message injection / unsanitized content in agent runtime

**Severity:** Low  
**File:** `packages/executor/src/executor.ts:35-64`

`parseLines` accepts arbitrary JSON from child process stdout. If a compromised child process sends crafted messages, they are appended verbatim to the agent message buffer with no sanitization. Downstream consumers may render or act on this content without escaping.

**Fix:** Validate message structure with a Zod schema. Sanitize or truncate `content` fields. Enforce maximum message size.

---

### 16. Default allowlist for `CommandGuard` is overly broad

**Severity:** Low  
**File:** `packages/core/src/security/command-guard.ts:20-64`

The default allowlist includes `rm`, `find`, `sed`, `awk`, `curl`, `wget`, `tar`, `zip`, `unzip`, etc. Combined with the `execSync` risk in finding #1, these commands can cause significant damage if the allowlist check is bypassed or if a caller provides a command like `"rm -rf /"` (blocked by metacharacter check on first token, but `"rm"` alone is still allowed and can delete files if cwd is attacker-controlled).

**Fix:** Narrow the default allowlist to read-only commands only. Make destructive commands opt-in per-tool rather than globally enabled.

---

## Recommendations by Priority

### P0 — Fix before production use
1. Replace `execSync` with `spawn` + argv validation in `command-guard.ts` and `gates.ts`.
2. Enforce `createPathGuard` in all runtime filesystem functions: `executor/src/runtime.ts`, `core/src/fs/agent-fs.ts`, `core/src/contract.ts`, `glide-indepth.ts`, `glide-converge.ts`.
3. Validate and sanitize `handleId` in `createIpcPath`.
4. Enforce plugin manifest permissions at runtime.

### P1 — Fix in next sprint
5. Harden `atomicWriteFileSync` with `0o600` temp files and fd-based writes.
6. Add Zod schemas for all JSON/JSONL parsing paths.
7. Persist capability-token revocation state.
8. Sanitize error messages returned to MCP clients.

### P2 — Fix in upcoming release
9. Remove `Math.random()` fallback from all ID generators.
10. Add file locking to JSONL rotation.
11. Validate `GraphifyClient.projectPath` against allowed roots.
12. Enforce plugin `shell`/`filesystem`/`network` permissions.

---

## Appendix: Files Reviewed

- `packages/core/src/security/path-guard.ts`
- `packages/core/src/security/command-guard.ts`
- `packages/core/src/io/atomic-write.ts`
- `packages/core/src/contract.ts`
- `packages/core/src/fs/agent-fs.ts`
- `packages/core/src/fs/campaign-fs.ts`
- `packages/core/src/fs/schemas.ts`
- `packages/core/src/fs/types.ts`
- `packages/core/src/ids.ts`
- `packages/executor/src/executor.ts`
- `packages/executor/src/runtime.ts`
- `packages/executor/src/contract.ts`
- `packages/executor/src/program.ts`
- `packages/executor/src/session.ts`
- `packages/executor/src/agent-handle.ts`
- `packages/executor/src/agent-message.ts`
- `packages/executor/src/agent-status.ts`
- `packages/headroom/src/runtime.ts`
- `packages/headroom/src/goal-store.ts`
- `packages/headroom/src/delta.ts`
- `packages/headroom/src/converge.ts`
- `packages/headroom/src/roles.ts`
- `packages/tracer/src/tracer.ts`
- `packages/tracer/src/trace-runtime.ts`
- `packages/tracer/src/jsonl-writer.ts`
- `packages/tracer/src/graphify.ts`
- `packages/permissions/src/permissions.ts`
- `packages/permissions/src/capability-tokens.ts`
- `packages/permissions/src/gates.ts`
- `packages/permissions/src/runtime.ts`
- `packages/plugin-api/src/types.ts`
- `packages/plugin-api/src/loader.ts`
- `packages/plugin-api/src/registry.ts`
- `packages/plugin-api/src/composition.ts`
- `packages/plugin-api/src/durability.ts`
- `packages/plugin-api/src/session.ts`
- `packages/mcp-server/src/server.ts`
- `packages/mcp-server/src/bridge/HostBridge.ts`
- `packages/mcp-server/src/bridge/types.ts`
- `packages/mcp-server/src/tools/index.ts`
- `packages/mcp-server/src/tools/types.ts`
- `packages/mcp-server/src/tools/glide-build.ts`
- `packages/mcp-server/src/tools/glide-test-tools.ts`
- `packages/mcp-server/src/tools/glide-executor.ts`
- `packages/mcp-server/src/tools/glide-trace.ts`
- `packages/mcp-server/src/tools/glide-indepth.ts`
- `packages/mcp-server/src/tools/glide-plan.ts`
- `packages/mcp-server/src/tools/glide-review.ts`
- `packages/mcp-server/src/tools/glide-ship.ts`
- `packages/mcp-server/src/tools/glide-headroom.ts`
- `packages/mcp-server/src/tools/glide-gates.ts`
- `packages/mcp-server/src/tools/glide-converge.ts`
- `packages/mcp-server/src/tools/glide-status.ts`
- `packages/mcp-server/src/tools/glide-permissions.ts`
- `packages/mcp-server/src/tools/glide-graph.ts`
- `packages/cli/src/cli.ts`
