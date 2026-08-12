# Audit: `packages/plugin-api` vs Architecture Plan & Plugin Security Best Practices

Date: 2026-08-11
Scope: `packages/plugin-api/*`, `plugins/example-plugin/*`
References:
- `Plan/Architecture.md`
- `Plan/TechnicalSpec.md`
- `security-audit.md`
- `audits/plugin-system-security-audit.md`
- `docs/api.md`

---

## Executive Summary

`packages/plugin-api` defines rich permission, resource-limit, composition, and durability types, but most of them are **not enforced at runtime**. Plugin loading allows arbitrary code execution, composition merges untrusted manifests without security downgrade checks, session/durability paths lack schema validation and path containment, and the package violates the architecture’s single-domain responsibility rule by bundling session runtime alongside plugin API concerns. These gaps are **architectural mismatches**, not merely missing tests.

Severity summary:
- HIGH: 2
- MEDIUM: 4
- LOW: 3
- INFO: 2

---

## 1. Architecture Mismatch — Package Boundary Bloat

**Plan:** `Plan/Architecture.md:212` assigns `packages/plugin-api` to “API for external plugins”. `Plan/Architecture.md:19` mandates single-domain packages; `Plan/Architecture.md:232-234` forbids circular dependencies and indirect coupling.

**Finding:** `packages/plugin-api/src/index.ts:1-6` exports six modules, including `session.js` and `durability.js`. Session durability and session-event replay are runtime/state concerns, not plugin-API concerns. This makes the package a God-module, increasing blast radius and coupling.

- `packages/plugin-api/src/session.ts:1` imports `SessionDurabilityOptions` from `./durability.js`.
- `packages/plugin-api/src/durability.ts:18-151` implements a full plugin-state persistence subsystem.

**Fix (HIGH):**
- Extract `session` and `durability` into `packages/plugin-state` or `packages/session`.
- `packages/plugin-api` should expose only descriptor types, loader interfaces, registry, and composition contracts.

---

## 2. Permission Model Is Decorative — No Enforcement

**Plan:** `Plan/TechnicalSpec.md:110-117` shows a manifest with `capabilities` and `allowedRoles`. `Plan/Architecture.md:138-144` says MCP tools must be gated by declared permissions.

**Finding:** `packages/plugin-api/src/types.ts:29-34` defines `PluginManifestPermissions` (`network`, `filesystem`, `env`, `shell`). But runtime code never gates I/O on these flags:

- `packages/plugin-api/src/registry.ts:17-38` (`register`) ignores `descriptor.manifest?.permissions`.
- `packages/plugin-api/src/loader.ts:123-136` (`loadWithLoader`) validates shape only; no permission check.
- `plugins/example-plugin/src/loader.ts:27-34` (`resolve`) and `:38-76` (`load`) perform no permission inspection before `await import(...)`.

A plugin can declare `filesystem: false` and still read/write arbitrary files via its loader or MCP tool wrappers, because no code path evaluates the manifest.

**Fix (HIGH):**
- Add a permission gate in `IPluginLoader.load` or `MCPPluginRegistry.register` that throws `PERMISSION_DENIED` when the plugin attempts disallowed capabilities.
- Enumerate allowed FS paths, network endpoints, env keys, and shell commands at registration; enforce via proxies/wrappers rather than ad-hoc checks.

---

## 3. Resource Limits Are Declared but Not Enforced

**Plan:** `Plan/Architecture.md:138-144` mandates token/session budgets and resource limits; `Plan/TechnicalSpec.md:7-8` specifies `maxMemoryMb`, `maxCpuPercent`, `timeoutMs`.

**Finding:**
- `packages/plugin-api/src/types.ts:36-40` defines `PluginManifestResourceLimits`.
- `packages/plugin-api/src/registry.ts:64-100` (`enforceResourceLimits`) checks **host process** `heapUsed` once, not plugin memory. It does not kill or throttle the plugin on breach; it throws from a `setInterval` timer only for timeout.
- `packages/plugin-api/src/durability.ts:42-44` (`persist`) writes unbounded JSON state; no size check against `resourceLimits`.
- `packages/plugin-api/src/session.ts:205-224` (`resumeByHandle`) and `:152-161` (`load`) have no timeout or size guard.

This is a direct “types-only” gap vs. production-grade enforcement.

**Fix (MEDIUM):**
- Spawn plugin code in `worker_threads` with `resourceLimits` and `terminate()` on breach.
- Enforce `timeoutMs` with `AbortController`/worker messaging, not just `setInterval`.
- Bound persisted state size in `durability.ts` before write.

---

## 4. Arbitrary Code Execution Surface — No Sandboxing

**Plan:** `Plan/Architecture.md:20-21` says “production-grade, schema-first, deterministic execution” and `Plan/TechnicalSpec.md:9-11` expects strict TypeScript and security gates.

**Finding:**
- `plugins/example-plugin/src/loader.ts:63` executes `await import(modulePath)` where `modulePath = join(this.pluginDir, manifest.entrypoint.module)`. No filesystem boundary, capability check, or worker isolation.
- `packages/plugin-api/src/loader.ts:92-98` (`IPluginLoader`) contract allows any implementation to run arbitrary code. `loadWithLoader` wraps it but does not sandbox it.
- `packages/plugin-api/src/composition.ts:197-201` merges plugin descriptors and re-validates shape, but this does not prevent a composed plugin from referencing a malicious `entrypoint.module`.

A malicious plugin can import any module readable by the host process and execute it with full Node.js privileges.

**Fix (HIGH):**
- Resolve entrypoint modules only within an explicit plugin root; reject paths with `..` or absolute roots.
- Run plugin loaders in `worker_threads` or separate processes with dropped capabilities and limited env.
- Add an explicit allowlist of importable entrypoint locations.

---

## 5. Composition Safety — Unchecked Merge

**Plan:** `Plan/TechnicalSpec.md:107-117` defines a strict manifest schema. `Plan/Architecture.md:20` mandates schema-first design.

**Finding:**
- `packages/plugin-api/src/composition.ts:197-204` composes a descriptor by spreading `instance.descriptor`, `reference.overrides`, and `mergedDefaults` with no validation of security-critical fields after merge.
- `mergedDefaults` (line 161) and `reference.overrides` (line 200) can override `kind`, `entrypoint`, `mcpEndpoint`, or even inject unknown fields.
- `packages/plugin-api/src/types.ts:13-14` keeps deprecated `manifest?: PluginManifest` on `PluginDescriptor`, allowing bypass of validated fields.
- `PluginDescriptorSchema` in `packages/plugin-api/src/loader.ts:38-55` does not forbid unknown properties, so additional fields may slip through.

A malicious parent bundle can poison child plugin capabilities, entrypoints, or MCP endpoints via defaults/overrides.

**Fix (HIGH):**
- Validate composed descriptors with a strict schema that rejects unknown keys (`.strict()` or explicit whitelist).
- Forbid downgrade of permissions/resource limits via `overrides`/`defaults`; require explicit capability elevation approval.
- Remove deprecated `manifest` field from `PluginDescriptor` or deprecate it entirely in v1.

---

## 6. Session/Durability Integrity — Missing Schema Validation

**Reference:** `security-audit.md:118-127` flags unsafe deserialization; `audits/plugin-system-security-audit.md:118-127` repeats the risk.

**Finding:**
- `packages/plugin-api/src/session.ts:152-161` (`SessionStore.load`) calls `JSON.parse(readFileSync(path, "utf8"))` with no schema validation.
- `packages/plugin-api/src/session.ts:164-173` (`update`) blindly merges `patch: Partial<SessionRecord>` into an existing record.
- `packages/plugin-api/src/durability.ts:60-64` (`restore`) parses persisted plugin state without validating `PluginInstance.state` shape or size.
- `packages/plugin-api/src/durability.ts:107-111` (`clear`) maps `JSON.parse(line)` directly.
- `packages/plugin-api/src/durability.ts:142-144` (`readEvents`) parses JSONL without validation.

A tampered or corrupted local state file can inject malformed records, alter `status`, `agentId`, or `metadata`, or crash the host via unexpected shapes.

**Fix (MEDIUM):**
- Validate all parsed JSON against Zod schemas for `SessionRecord`, `SessionEvent`, and plugin state shapes.
- Reject records with unknown or disallowed fields.
- Add integrity checks (append-only signed events or checksums) for persisted state.

---

## 7. Path Containment Failures

**Plan:** `Plan/Architecture.md:82-84` distinguishes CTO Session vs Agent Native access levels; local execution is the boundary model.

**Finding:**
- `packages/plugin-api/src/session.ts:134` computes `recordPath(handle)` via `join(this.rootDir, `${handle}${this.extension}`)`. A `handle` of `../../etc` escapes `rootDir`.
- `packages/plugin-api/src/durability.ts:29-31` computes `filePath(pluginId)` with `join(this.stateDir, `${pluginId}${this.extension}`)`. A crafted `pluginId` containing `../` escapes the state directory.
- No `path.resolve` + root-containment check is performed anywhere in these files.

This is a path-traversal vulnerability: a plugin or caller-controlled identifier can read/write outside intended directories.

**Fix (MEDIUM):**
- Normalize all constructed paths with `path.resolve` and verify the resolved path starts with the intended root directory.
- Reject inputs containing `..`, backticks, or other traversal components at the API boundary.

---

## 8. Unbounded Memory Usage in Event Reads

**Finding:**
- `packages/plugin-api/src/session.ts:65-66` reads the entire event file into memory and splits by newline. For long-running systems this grows unbounded.
- `packages/plugin-api/src/durability.ts:107-111` does the same for state files during `clear()`.
- `packages/plugin-api/src/session.ts:82-84` (`clear`) writes an empty file but does not truncate atomically in a crash-safe manner.

**Fix (LOW):**
- Stream JSONL reads with a bounded buffer or max-line count.
- Truncate via write-to-temp + rename for atomic clear.

---

## 9. Silent Error Swallowing

**Finding:**
- `packages/plugin-api/src/session.ts:71-73` catches JSON parse errors and silently skips malformed lines. This hides corruption or tampering.
- `packages/plugin-api/src/session.ts:159-161` and `:199-201` swallow load/remove errors silently.
- `packages/plugin-api/src/durability.ts:63-65`, `:113-115`, and `:125-128` swallow all I/O/parse errors.

Silent failures prevent security-relevant incidents from being detected.

**Fix (LOW):**
- Emit structured warnings or metrics when malformed records are encountered.
- Do not swallow `unlink`/`rm` errors silently; at minimum log them with context.

---

## 10. Validation Result Type Is Unused

**Finding:**
- `packages/plugin-api/src/types.ts:79-83` defines `PluginManifestValidationResult { valid, errors, warnings }`.
- `packages/plugin-api/src/loader.ts:61-81` (`validatePluginManifest`/`validatePluginDescriptor`) throws on invalid input and returns `ValidatedPluginDescriptor` on valid input. The structured validation result type is never returned or consumed.

This contradicts the architecture’s schema-first intent (`Plan/Architecture.md:20`) and removes the ability to collect soft warnings.

**Fix (LOW):**
- Add `validatePluginManifestResult` returning `PluginManifestValidationResult`; use it for soft validation paths.
- Remove the unused type or wire it into registry registration to collect warnings without aborting.

---

## 11. No Capability Token / Identity Model

**Plan:** `Plan/TechnicalSpec.md:110-117` defines `ToolCall.accessLevel: "cto" | "agent"`; `Plan/Architecture.md:82-84` mandates two access levels.

**Finding:**
- `packages/plugin-api/src/types.ts` has no `accessLevel`, `subject`, or signed token concept. Plugin identity is just `id: string`.
- `packages/plugin-api/src/session.ts:18-38` (`SessionEvent`, `SessionRecord`) carry `handle`, `agentId`, `parentHandle` with no audience, expiry, or signature.
- `packages/plugin-api/src/composition.ts:25` (`ExtensionHook`) uses plain `pluginId` strings.

Any caller can impersonate another agent or plugin by reusing identifiers.

**Fix (MEDIUM):**
- Introduce signed capability tokens (e.g., JWT or HMAC) scoped to plugin/agent/session with audience and expiry.
- Validate tokens at registry, composition, and MCP tool boundaries.

---

## 12. README Omits Security Contract

**Finding:**
- `README.md:15-25` documents public API usage but omits permission model, resource-limit semantics, sandboxing constraints, and access-level policy.
- `docs/api.md:1-148` documents tools but does not mention plugin-manifest permissions, capability tokens, or runtime enforcement.

**Fix (LOW):**
- Add a “Security Contract” section to README describing manifest permissions, resource limits, expected sandboxing, and failure modes.

---

## Prioritized Fixes

| Priority | Finding | Files |
|----------|---------|-------|
| P0 | Enforce manifest permissions at load/runtime | `packages/plugin-api/src/loader.ts`, `packages/plugin-api/src/registry.ts` |
| P0 | Remove arbitrary `import()` execution / sandbox loader | `plugins/example-plugin/src/loader.ts`, `packages/plugin-api/src/loader.ts` |
| P1 | Enforce resource limits via worker isolation + kill on breach | `packages/plugin-api/src/registry.ts`, `packages/plugin-api/src/durability.ts` |
| P1 | Add path containment to all user-supplied identifiers | `packages/plugin-api/src/session.ts`, `packages/plugin-api/src/durability.ts` |
| P1 | Validate composed descriptors strictly; disallow permission downgrade | `packages/plugin-api/src/composition.ts`, `packages/plugin-api/src/loader.ts` |
| P1 | Validate all persisted JSON/JSONL against schemas | `packages/plugin-api/src/session.ts`, `packages/plugin-api/src/durability.ts` |
| P2 | Introduce signed capability tokens for plugin/agent identity | `packages/plugin-api/src/types.ts`, `packages/plugin-api/src/session.ts` |
| P2 | Extract session/durability into a dedicated package | `packages/plugin-api/src/index.ts`, `packages/plugin-api/src/session.ts`, `packages/plugin-api/src/durability.ts` |
| P3 | Replace silent catch blocks with structured warnings/logging | `packages/plugin-api/src/session.ts`, `packages/plugin-api/src/durability.ts` |
| P3 | Document security contract in README and API docs | `README.md`, `docs/api.md` |
