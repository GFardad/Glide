# Glide Plugin System Security & Architecture Audit

Date: 2026-08-11  
Scope: `packages/plugin-api`, `plugins/example-plugin`, `packages/permissions`, `packages/executor`, `packages/mcp-server`  
Focus: sandboxing, capability tokens, resource limits, permission tie-in, composition safety

---

## Executive Summary

The plugin system defines permission and resource-limit schemas, but **none are enforced at runtime**. Plugin loading executes arbitrary code via dynamic `import()`, composition merges untrusted manifests without post-merge validation, and the MCP server grants tools broad filesystem/process access with no capability model. These are architectural gaps, not missing tests.

---

## 1. Sandboxing

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/loader.ts` | 63 | `ExamplePluginLoader.load` uses `await import(modulePath)` with no filesystem boundary. A plugin can load any module the host process can read. |
| `packages/executor/src/executor.ts` | 165-170 | `spawnAgent` inherits `process.env` and runs arbitrary commands. No chroot, no seccomp, no capability drop. |
| `packages/mcp-server/src/server.ts` | — | Tool handlers run in the same Node.js event loop as the server. A malicious plugin tool can access any state, any file, any env var. |

**Verdict:** No sandboxing exists. Plugin code runs with full host privileges.

---

## 2. Capability Tokens

| File | Line | Finding |
|------|------|---------|
| `packages/permissions/src/runtime.ts` | 35-36 | `createSubject()` generates an ephemeral UUID with no signing, no expiry, and no delegation chain. |
| `packages/mcp-server/src/tools/glide-permissions.ts` | 40-41 | MCP tool creates a fresh subject and checks authorization in-process. The caller's identity is `subject_id` from tool args — trivially spoofable. |
| `packages/executor/src/session.ts` | — | Session events record `agentId` and `parentId` but carry no signed capability token. Any tool can impersonate another agent by passing its `agent_id`. |

**Verdict:** Capabilities are unauthenticated identity strings, not unforgeable tokens.

---

## 3. Resource Limits

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/types.ts` | 36-40 | `PluginManifestResourceLimits` declares `maxMemoryMb`, `maxCpuPercent`, `timeoutMs` — but these are TypeScript interfaces only. |
| `packages/plugin-api/src/durability.ts` | 33-51 | `persist()` writes plugin state to disk with no size check. A plugin can write unbounded state, exhausting disk. |
| `packages/executor/src/executor.ts` | 130 | `agentRegistry` is a flat `Map` with no cap. Unlimited agent spawns leak memory. |
| `packages/mcp-server/src/server.ts` | — | No memory, CPU, or concurrency limit beyond any global request timeout. |

**Verdict:** Resource limits are declared but never enforced. Only a global request timeout exists.

---

## 4. Permission Tie-In

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/types.ts` | 29-34 | `PluginManifestPermissions` lists `network`, `filesystem`, `env`, `shell` — but `MCPPluginRegistry.register()` at `registry.ts:17` never inspects these fields. |
| `packages/plugin-api/src/registry.ts` | 17-38 | `register()` stores descriptor and optional `resourceLimits`, but ignores `manifest.permissions`. No enforcement happens at registration or later. |
| `packages/plugin-api/src/composition.ts` | 197-201 | `composeBundle` spreads `instance.descriptor`, `reference.overrides`, and `mergedDefaults` into a new `PluginDescriptor` without checking permission downgrades. |

**Verdict:** Manifest permissions are decorative. Registration and composition never gate actions on declared permissions.

---

## 5. Composition Safety

| File | Line | Finding |
|------|------|---------|
| `packages/plugin-api/src/composition.ts` | 159-201 | `composeBundle` merges parent bundle roles/presets/defaults and per-plugin `overrides` without validating the final merged descriptor. |
| `packages/plugin-api/src/composition.ts` | 197-201 | The merged `PluginDescriptor` is spread inline and then passed to `validatePluginDescriptor`, but validation only checks shape, not semantic safety (e.g., permission escalation via overrides). |
| `packages/plugin-api/src/types.ts` | 79-83 | `PluginManifestValidationResult` type exists but no validation function is implemented or called in composition paths. |

**Verdict:** Bundle composition is an unchecked merge of arbitrary plugin data. A single malicious plugin can poison composed plugins via `defaults` or `overrides`.

---

## 6. Additional Findings

| Severity | File | Line | Finding |
|----------|------|------|---------|
| HIGH | `packages/executor/src/executor.ts` | 165-170 | `spawn` passes `{ ...process.env, ...options.env }`. Even if `options.env` overrides secrets, the full parent env leaks. |
| HIGH | `plugins/example-plugin/src/loader.ts` | 63 | `await import(modulePath)` executes arbitrary code from the plugin directory with no validation. |
| HIGH | `packages/mcp-server/src/tools/glide-permissions.ts` | 40-41 | `subject_id` is taken from caller args and trusted for authorization checks. |
| MEDIUM | `packages/plugin-api/src/durability.ts` | 60-61 | `restore()` calls `JSON.parse` on persisted plugin state without size limit or schema validation. A corrupted or malicious state file can crash the host. |
| MEDIUM | `packages/plugin-api/src/durability.ts` | 42-44 | `persist()` writes plugin state with `writeFileSync` direct to target file. No temp-file + rename, no `fsync`. Partial write = corrupt state. |
| MEDIUM | `packages/plugin-api/src/session.ts` | 57-58 | `SessionEventLogWriter.write` uses `appendFileSync` without `fsync`. |
| MEDIUM | `packages/plugin-api/src/session.ts` | 222-228 | `SessionStore.upsert` writes JSON record without `fsync` or atomic rename. |
| MEDIUM | `packages/plugin-api/src/session.ts` | 82-84 | `clear()` truncates via `writeFileSync("", ...)` without `fsync`. |
| LOW | `packages/plugin-api/src/durability.ts` | 107-114 | `clear()` reads the event file and parses every line — unbounded memory on long-running systems. |
| LOW | `packages/plugin-api/src/loader.ts` | 104-111 | `PluginLoaderRegistry.register` throws on duplicate loader registration but does not validate loader implementations for safety. |

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
3. **Poisoned composition**: `composeBundle` merges plugin manifests without semantic validation; one bad plugin corrupts all.
4. **Declared-but-unenforced limits**: Resource limits and manifest permissions exist only as TypeScript types.
5. **Crash safety**: Persistence paths use `writeFileSync` / `appendFileSync` without `fsync` or atomic rename.

---

## Recommended Remediation Order

1. **Enforce manifest schema at registration**: validate `PluginManifest` in `MCPPluginRegistry.register()` and reject plugins that omit required permissions/resource limits.
2. **Introduce signed capability tokens**: replace ad-hoc UUID subjects with signed tokens; verify in every MCP tool handler before touching filesystem/network/shell.
3. **Enforce resource limits at plugin load**: run plugin code in `worker_threads` with explicit `resourceLimits` and kill on breach.
4. **Gate every MCP tool** on the plugin's declared permissions before touching filesystem/network/shell.
5. **Validate composition output** against `PluginDescriptor` schema after `composeBundle`; reject plugins that downgrade permissions via `overrides` or `defaults`.
6. **Harden persistence**: adopt temp-file + `renameSync` + `fsync` for all plugin/session writes; add integrity metadata to detect truncation.
