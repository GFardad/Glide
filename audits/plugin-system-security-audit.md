# Glide Plugin System Security & Architecture Audit

Date: 2026-08-11  
Scope: `packages/plugin-api`, `packages/permissions`, `packages/executor`, `packages/mcp-server`, `plugins/example-plugin`  
Focus: sandboxing, capability tokens, resource limits, permission tie-in, composition safety

---

## Executive Summary

The plugin system defines rich permission and resource-limit types but has **no runtime enforcement** of any of them. Plugin loading executes arbitrary code via `import()`, composition merges untrusted manifests without schema validation, and the MCP server grants all tools broad filesystem/process access with no capability model. These are **architectural gaps**, not missing tests.

---

## 1. Sandboxing

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/loader.ts` | 63 | `ExamplePluginLoader` uses dynamic `import(modulePath)` with no filesystem boundary. A plugin can load any module the host process can read. |
| `packages/executor/src/executor.ts` | 88-93 | `spawnAgent` inherits `process.env` and runs arbitrary commands. No chroot, no seccomp, no capability drop. |
| `packages/mcp-server/src/server.ts` | 197-206 | Tool handlers run in the same Node.js event loop as the server. A malicious plugin tool can access any state, any file, any env var. |

**Verdict:** No sandboxing exists. Plugin code runs with full host privileges.

---

## 2. Capability Tokens

| File | Line | Finding |
|------|------|---------|
| `packages/permissions/src/runtime.ts` | 40-72 | `authorize()` checks scopes on a `PermissionSubject`, but subjects are ephemeral UUIDs created ad-hoc (`createSubject`). There is no token issuance, no signed capability, no delegation chain. |
| `packages/mcp-server/src/tools/glide-permissions.ts` | 41-42 | MCP tool creates a fresh subject and checks authorization in-process. The caller's identity is `subject_id` from tool args — trivially spoofable. |
| `packages/executor/src/session.ts` | 138-172 | Session events record `agentId` and `parentId` but carry no signed capability token. Any tool can impersonate another agent by passing its `agent_id`. |

**Verdict:** Capabilities are unauthenticated identity strings, not unforgeable tokens.

---

## 3. Resource Limits

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/types.ts` | 36-40 | `PluginManifestResourceLimits` declares `maxMemoryMb`, `maxCpuPercent`, `timeoutMs` — but these are TypeScript interfaces only. |
| `packages/plugin-api/src/durability.ts` | 33-51 | `persist()` writes plugin state to disk with no size check. A plugin can write unbounded state, exhausting disk. |
| `packages/executor/src/executor.ts` | 48 | `agentRegistry` is a flat `Map` with no cap. Unlimited agent spawns leak memory. |
| `packages/mcp-server/src/server.ts` | 8 | `REQUEST_TIMEOUT_MS = 120_000` is the only resource guard. No memory, CPU, or concurrency limit. |

**Verdict:** Resource limits are declared but never enforced. Only a global request timeout exists.

---

## 4. Permission Tie-In

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/types.ts` | 29-34 | `PluginManifestPermissions` lists `network`, `filesystem`, `env`, `shell` — but `MCPPluginRegistry.register()` at `registry.ts:12` never inspects these fields. |
| `packages/mcp-server/src/tools/glide-build.ts` | 43-62 | `glide_build` writes to any `campaign_dir` on disk. No check against the plugin's declared `filesystem` permission. |
| `packages/mcp-server/src/tools/glide-indepth.ts` | 29-34 | `glide_indepth` writes to `output_dir` with `mkdirSync`/`writeFileSync`. No filesystem permission gate. |
| `packages/mcp-server/src/tools/glide-headroom.ts` | 57-61 | `runHeadroom` is called without verifying the plugin's `network` or `shell` permissions (headroom spawns role analysis which may invoke external tools). |

**Verdict:** Manifest permissions are decorative. Every MCP tool has unrestricted filesystem/process access regardless of plugin manifest.

---

## 5. Composition Safety

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/composition.ts` | 197-201 | `composeBundle` spreads `instance.descriptor`, `reference.overrides`, and `mergedDefaults` into a new `PluginDescriptor` with no validation. |
| `packages/plugin-api/src/composition.ts` | 143-217 | `composeBundle` trusts `pluginRegistry.load(reference.id)` to return a valid instance, but `MCPPluginRegistry` has no schema check on registration. |
| `packages/plugin-api/src/types.ts` | 79-83 | `PluginManifestValidationResult` type exists but no validation function is implemented or called anywhere. |

**Verdict:** Bundle composition is an unchecked merge of arbitrary plugin data. A single malicious plugin can poison all composed plugins via `defaults` or `overrides`.

---

## 6. Additional Findings

| Severity | File | Line | Finding |
|----------|------|------|---------|
| HIGH | `packages/permissions/src/gates.ts` | 28-35 | `runCliCommand` uses `execSync` with `workspace`-derived `cwd`. If workspace path contains shell metacharacters, this is command injection. |
| HIGH | `plugins/example-plugin/src/loader.ts` | 63 | `await import(modulePath)` executes arbitrary code from the plugin directory with no validation. |
| HIGH | `packages/executor/src/executor.ts` | 88 | `spawn` passes `{ ...process.env, ...options.env }`. Even if `options.env` overrides secrets, the full parent env leaks. |
| MEDIUM | `packages/plugin-api/src/durability.ts` | 60-61 | `restore()` calls `JSON.parse` on persisted plugin state without size limit or schema validation. A corrupted or malicious state file can crash the host. |
| MEDIUM | `packages/mcp-server/src/tools/glide-converge.ts` | 41-43 | `repoRoot` defaults to `join(campaignDir, "..", "..")`. An attacker can write to any parent directory by crafting a `campaign_dir`. |
| LOW | `packages/plugin-api/src/durability.ts` | 100 | `clear()` reads the event file and parses every line — unbounded memory on long-running systems. |

---

## 7. Production-Grade References

| Concern | Production Pattern | Glide Gap |
|---------|-------------------|-----------|
| Sandboxing | gVisor / Firecracker microVMs; Node.js `worker_threads` with `--sandbox` | No process isolation; plugins share the main event loop |
| Capability tokens | OPA / SPIFFE / signed JWTs with audience + expiry | Ad-hoc UUIDs with no signing or verification |
| Resource limits | cgroups / `worker_threads` resource quotas / `v8` memory limits | Types only; no enforcement at load or runtime |
| Permission tie-in | Envoy RBAC / OPA sidecar evaluated on every I/O call | Manifest declared but never checked at call site |
| Composition safety | JSON Schema / Zod validation on merge; capability downgrade on override | Unchecked `...spread` merge of untrusted plugin data |

---

## Summary of Highest-Risk Issues

1. **Arbitrary code execution**: `import()` in plugin loader + unrestricted filesystem in MCP tools = any plugin can own the host.
2. **Spoofable identity**: MCP tools accept `agent_id` / `subject_id` from caller args with no token verification.
3. **Poisoned composition**: `composeBundle` merges plugin manifests without schema validation; one bad plugin corrupts all.
4. **Declared-but-unenforced limits**: Resource limits and manifest permissions exist only as TypeScript types.
5. **Command injection surface**: `execSync` in gates uses unsanitized workspace paths as `cwd`.

---

## Recommended Remediation Order

1. **Enforce manifest schema at load time** using Zod (`PluginManifest` → `zodSchema` → `safeParse` in `MCPPluginRegistry.register`).
2. **Introduce signed capability tokens** for agent/subject identity; reject unsigned or mismatched tokens in MCP tool handlers.
3. **Enforce resource limits** at plugin load: spawn plugins in `worker_threads` with explicit `resourceLimits` and kill on breach.
4. **Gate every MCP tool** on the plugin's declared permissions before touching filesystem/network/shell.
5. **Validate composition output** against `PluginDescriptor` schema after `composeBundle`; reject plugins that downgrade permissions via `overrides` or `defaults`.
