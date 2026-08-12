# @glide/core — Architecture vs Production-Grade Audit
**Audit scope:** `packages/core/src/**/*.ts`  
**Reference docs:** `Plan/Architecture.md`, `Plan/TechnicalSpec.md`, `Plan/ImplementationPlan.md`, `Plan/ProductionReadiness-2026-08-11.md`, `Plan/ArchitectureReview-2026-08-11.md`  
**Date:** 2026-08-11

---
## 1. Global Findings (cross-file)
| Severity | File | Line(s) | Finding |
|----------|------|---------|---------|
| HIGH | `campaign/index.ts` | 60–62 | `generateCampaignId` uses `Date.now()` + `Math.random()`; `ids.ts` already exports `generateCampaignId()` with `nanoid`, but `campaign/index.ts` ignores it and imports nothing from `../ids.js`. |
| HIGH | `constitution.ts` | 107–115 | `loadConstitution` uses raw `JSON.parse(... ) as Constitution` with no Zod validation. `Constitution` fields like `createdAt`/`updatedAt` are typed `Date` but deserialize to `string`. |
| HIGH | `campaign/index.ts` | 43–51 | `loadCampaign` uses raw `JSON.parse(... ) as Campaign`. Same Date deserialization bug; corrupt JSON throws a bare `Error`, not `CampaignSchemaError`. |
| HIGH | `campaign/index.ts` | 25–34 | `createCampaign` writes four files with plain `writeFileSync`; no atomic replace, no fsync, no crash-safety. If the process dies mid-write, the campaign directory is left partially created. |
| HIGH | `fs/agent-fs.ts` | 125–152 | `defaultFileContent` emits placeholder `TBD` goal text in `GOAL.md`. `AGOAL.md` is marked required by `AgentFileContractSchema` but there is no runtime validation that placeholders were replaced. |
| HIGH | `campaign/index.ts` | 1–4 | File imports `readFileSync`, `writeFileSync`, `mkdirSync`, `existsSync` directly instead of using the package’s own `atomicWriteFileSync` from `io/atomic-write.js`. The architecture says “open-source first … avoid reinventing”; core should lead by using its own durability utilities. |
| MEDIUM | `constitution.ts` | 97–98 | Side-effect `node:fs`/`node:path` imports placed after 96 lines of interface definitions. Standard convention is imports at the top; mid-file imports reduce readability and can confuse tree-shaking/analysis tools. |
| MEDIUM | `schemas/index.ts` | 1–395 | `GoalMetadata` is not defined; `GoalRecordSchema` uses `metadata: z.record(z.unknown()).optional()`. The architecture explicitly lists `Record<string, unknown>` as a “vibe-coded” anti-pattern that must be replaced with a proper Zod schema. |
| MEDIUM | `types/index.ts` | 1–6 | `AgentId`/`SessionId`/`CampaignId` are bare string type aliases. The architecture technical spec (`TechnicalSpec.md`) defines them as branded interfaces with `readonly id: string`. This loses nominal typing and allows accidental interchangeability. |
| MEDIUM | `types/index.ts` | 27–48 | `Agent` interface has inline `personality`, `goal`, `notes`, `todos`, `rejected` content fields instead of path fields (`personalityPath`, etc.). The plan’s `AgentContext` model uses path-based fields plus `tokenBudget` and `allowedMcp`; core defines neither `AgentContext` nor those fields. |
| MEDIUM | `types/index.ts` | — | Plan-required interfaces `ToolName`, `ToolCall`, `MeetingRoomOutput`, `TodoItem` are entirely absent from core. They exist only in `schemas/index.ts` and are not re-exported from `types/index.ts` or `index.ts`. |
| MEDIUM | `fs/campaign-fs.ts` | 10–16 | `validateCampaignDirectory` checks `constitution.json` exists and is parseable JSON, but does not validate it against `ConstitutionSchema`. A malformed but syntactically valid JSON file passes. |
| MEDIUM | `contract.ts` | 70–83 | `ensureAgentContract` writes `contract.json` with `atomicWriteFileSync`, but does not validate the written artifact against `AgentContractSchema`. A write that succeeds but produces stale/invalid state is not detected. |
| MEDIUM | `fs/agent-fs.ts` | 30–64 | `validateAgentDirectory` reads files synchronously and validates only presence/`contract.json` schema. It does not check that `PERSONALITY.md`, `GOAL.md`, etc. contain required sections, even though `AgentFileContractSchema.expectedSection` exists in `constitution.ts`. |
| MEDIUM | `index.ts` | 1–12 | Barrel uses `.js` extensions for all re-exports. This is a TypeScript source tree; extensionless imports are standard for intra-package references and avoid build-tool confusion. |
| LOW | `errors/index.ts` | 1–8 | `GlideError` accepts `cause?: Error` but does not pass it to `super(message, { cause })`. Modern Node/TS supports `Error.cause` natively; the constructor ignores it. |
| LOW | `errors/index.ts` | 17–24 | `PermissionDeniedError` is defined but never raised by any code in core. Dead public API surface. |
| LOW | `goal.ts` | 1–20 | `GoalStatus` vocabulary (`active`/`scheduled`/`completed`/`abandoned`) does not share a base with `TodoItem.status` (`pending`/`in_progress`/`done`/`rejected`). No shared status union exists. |

---
## 2. File-by-File Findings
### `packages/core/src/index.ts`
- **Lines 1–12:** Re-exports compiled `.js` paths. Functional, but `.js` extensions in a TS source tree are non-standard (see Global finding MEDIUM).

### `packages/core/src/types/index.ts`
- **Lines 1–6:** `AgentId`/`SessionId`/`CampaignId` are string aliases, not branded interfaces.
- **Lines 27–48:** `Agent` has inline content fields; plan’s `AgentContext` with path fields and `tokenBudget` is missing.
- **Missing exports:** `ToolName`, `ToolCall`, `MeetingRoomOutput`, `TodoItem` are absent from this file.

### `packages/core/src/errors/index.ts`
- **Lines 1–10:** `GlideError` does not forward `cause` to `Error` constructor.
- **Lines 17–24:** `PermissionDeniedError` is unused dead code.
- **Missing errors:** `InvalidCampaignError`, `InvalidConstitutionError` do not exist; corrupt data throws bare `Error`.

### `packages/core/src/goal.ts`
- **Lines 1–20:** `GoalRecord.metadata` uses `Record<string, unknown>` instead of a typed schema.
- **Lines 1–2:** `GoalStatus` does not align with `TodoItem.status`; no shared status union.

### `packages/core/src/constitution.ts`
- **Lines 1–96:** Interfaces and classes are well-structured with JSDoc. No issues.
- **Lines 97–98:** Side-effect imports at mid-file.
- **Lines 102–116:** `loadConstitution` uses raw `JSON.parse` + `as Constitution`; no Zod, no Date coercion.
- **Lines 122–128:** `writeConstitution` uses plain `writeFileSync`; no atomic replace, no fsync.
- **Lines 130–152:** `proposeAmendment` mutates status to `"proposed"`; `ConstitutionAmendmentSchema` expects `status: ConstitutionAmendmentStatusEnum` without default, so a proposed amendment without explicit status would fail Zod if used.
- **Lines 229–248:** `generateAmendmentId` uses `Date.now()` + `Math.random()`. `ids.ts` already exports `generateAmendmentId()` using `nanoid`, but it is unused here.
- **Missing:** No schema validation for constitution reads; no `InvalidConstitutionError`; no atomic write helper usage.

### `packages/core/src/campaign/index.ts`
- **Lines 1–4:** Imports raw `node:fs` instead of `atomicWriteFileSync` from `../io/atomic-write.js`.
- **Lines 8–36:** `createCampaign` writes four files sequentially with `writeFileSync`; no atomicity, no fsync, no rollback on partial failure.
- **Lines 38–52:** `loadCampaign` uses raw `JSON.parse` + `as Campaign`; no Zod, no Date coercion, no `CampaignSchemaError` for malformed data.
- **Lines 54–58:** `ensureCampaignDir` creates `sessions`/`artifacts` but not `teams`/`agents` directories, even though `agent-fs.ts` expects `teams/<teamId>/agents/<agentId>`.
- **Lines 60–62:** `generateCampaignId` uses `Date.now()` + `Math.random()`. `ids.ts` exports `generateCampaignId()` with `nanoid`, but it is unused.
- **Lines 64–66:** `formatMarkdown` joins arrays with `\n` without list bullets. For `NON_GOALS.md` and `ASSUMPTIONS.md`, plan expects bullet lists.

### `packages/core/src/contract.ts`
- **Lines 20–28:** `AgentContractSchema` is defined and correctly used in `context.test.ts`, but `ensureAgentContract` does not validate the generated file after write.
- **Lines 70–83:** Uses `atomicWriteFileSync` for the write, which is good, but the function does not verify the result or emit a typed error on failure.

### `packages/core/src/fs/agent-fs.ts`
- **Lines 9–16:** `REQUIRED_AGENT_FILES` includes `contract.json`, matching `AgentFileContractSchema` in `constitution.ts`.
- **Lines 30–64:** `validateAgentDirectory` checks file presence and `contract.json` schema, but does not validate markdown section structure despite `AgentFileContractSchema.files[].expectedSection` being defined.
- **Lines 66–77:** `ensureAgentFiles` writes files with `writeFileSync` if missing; does not use `atomicWriteFileSync`.
- **Lines 79–91:** `loadAgentDirectory` reads all files synchronously into memory; no streaming for large notes.
- **Lines 93–105:** `createAgentFileContract` writes `contract.json` atomically, but returns raw file content cast to `AgentFileContract` without parsing/validation.
- **Lines 125–152:** `defaultFileContent` emits placeholder `TBD` goal text. No runtime check prevents an agent from running with unfulfilled placeholders.

### `packages/core/src/fs/campaign-fs.ts`
- **Lines 4–17:** `validateCampaignDirectory` checks `constitution.json` exists and is valid JSON, but does not validate against `ConstitutionSchema`. A file with wrong shape passes.

### `packages/core/src/fs/schemas.ts`
- **Lines 1–129:** Strong Zod schemas for campaign, goal, agent, directory, and markdown shapes. Good adherence to schema-first design.
- **Lines 107–129:** Markdown parsers use `parseGoalMarkdown` etc., but `campaign/index.ts` does not use them; it writes raw strings.

### `packages/core/src/fs/types.ts`
- **Lines 1–28:** Duplicates interfaces already in `types/index.ts` (`AgentContext`, `AgentFileContract`, `AgentDirectory`). Duplication risks drift.

### `packages/core/src/io/atomic-write.ts`
- **Lines 9–41:** `atomicWriteFileSync` is correctly implemented with temp-file + rename + fsync on file and directory. This is a positive finding.
- **Lines 48–80:** `atomicAppendFileSync` is also correctly implemented with temp-file + rename + fsync.
- **Lines 85–103:** `safeReadFileSync` and `fsyncPath` are useful utilities.
- **Gap:** No async variants (`atomicWriteFile`, `atomicAppendFile`) exist, blocking non-blocking I/O paths.

### `packages/core/src/io/id.ts`
- **Lines 1–58:** Exports `generateAgentId`, `generateSessionId`, `generateCampaignId`, `generateAmendmentId`, `generateTraceId`, plus validators. Uses `nanoid` correctly. This is a positive finding.
- **Gap:** `campaign/index.ts` and `constitution.ts` do not import these generators.

### `packages/core/src/security/path-guard.ts`
- **Lines 1–111:** Implements path traversal guards with symlink checks. Strong security primitive. No issues.

### `packages/core/src/security/command-guard.ts`
- **Lines 1–141:** Implements command allowlist with workspace sanitization and shell-metacharacter blocking. Strong security primitive. No issues.

---
## 3. Architecture Plan Compliance
| Pattern | Requirement | Implementation | Gap |
|---------|-------------|----------------|-----|
| Schema-first design | Zod for all external data | `schemas/index.ts` is comprehensive; `campaign/index.ts` and `constitution.ts` ignore it | HIGH: core loaders bypass Zod |
| ID generation | `ulid`/`nanoid` for IDs | `ids.ts` uses `nanoid` correctly; `campaign/index.ts` and `constitution.ts` use `Date.now()+Math.random()` | HIGH: inconsistent ID strategy |
| Atomic I/O | Crash-safe writes with fsync | `io/atomic-write.ts` is correct; `campaign/index.ts` and `constitution.ts` use plain `writeFileSync` | HIGH: durability gap in core writers |
| Type branding | `readonly` branded ID types | `types/index.ts` uses bare string aliases | MEDIUM: nominal typing lost |
| Agent context | Path-based fields + `tokenBudget` | `types/index.ts` defines inline content fields; plan’s `AgentContext` absent | MEDIUM: plan divergence |
| Tool contracts | `ToolName`, `ToolCall`, `TodoItem` | Exist in `schemas/index.ts` only; not re-exported from core public API | MEDIUM: incomplete public API |
| Status vocabulary | Shared status unions | `GoalStatus` and `TodoItem.status` are disconnected | LOW: inconsistent lifecycle modeling |
| Error chaining | `Error.cause` for diagnostics | `GlideError` accepts `cause` but does not forward it | LOW: incomplete error cause chain |

---
## 4. Production-Grade Issues Summary
1. **Durability gaps in core writers:** `campaign/index.ts` and `constitution.ts` use non-atomic `writeFileSync` without fsync. A power-loss or OOM kill during write corrupts campaign/constitution data. The package already ships `atomicWriteFileSync` in `io/atomic-write.ts` but does not use it.
2. **Schema validation bypassed:** Despite having comprehensive Zod schemas in `fs/schemas.ts` and `schemas/index.ts`, the core data-loading functions (`loadCampaign`, `loadConstitution`, `validateCampaignDirectory`) use raw `JSON.parse` + `as` casts. This defeats the purpose of schema-first design and silently accepts malformed data.
3. **ID strategy inconsistency:** `ids.ts` provides `nanoid`-based generators, but `campaign/index.ts` and `constitution.ts` generate IDs with `Date.now()` + `Math.random()`. This breaks collision resistance, time-sortability, and testability.
4. **Date deserialization bug:** `Campaign.createdAt`, `Constitution.createdAt`, etc. are typed `Date` in interfaces, but `JSON.parse` returns `string`. The type contract is silently broken at runtime.
5. **Missing Plan-specified interfaces:** `AgentContext`, `ToolName`, `ToolCall`, `MeetingRoomOutput`, `TodoItem` are specified in `TechnicalSpec.md` but absent from `types/index.ts` and the package public API.
6. **Testing coverage gap:** `vitest.config.ts` excludes `**/types.ts` and `**/index.ts`, so barrel and pure-type files are excluded from coverage. The only core unit test is `src/context.test.ts`; `campaign/`, `constitution`, `fs/`, `io/`, and `security/` have no tests in `packages/core/src/`.
7. **Placeholder content in durable artifacts:** `agent-fs.ts` writes `TBD` into `GOAL.md` by default. There is no runtime check that the placeholder was replaced before the agent is considered valid.

---
## 5. Exact File:Line Change Recommendations
| File | Line(s) | Recommendation |
|------|---------|----------------|
| `campaign/index.ts` | 1–4 | Replace raw `node:fs` imports with `atomicWriteFileSync` from `../io/atomic-write.js`; import `generateCampaignId` from `../ids.js`. |
| `campaign/index.ts` | 25–34 | Replace four `writeFileSync` calls with `atomicWriteFileSync`; add Zod validation after load. |
| `campaign/index.ts` | 43–51 | Replace `JSON.parse` + `as Campaign` with `CampaignSchema.parse(JSON.parse(...))` using `z.coerce.date()` for `createdAt`/`updatedAt`. |
| `campaign/index.ts` | 54–58 | Add `teams` and `agents` directory creation to match `agent-fs.ts` expectations. |
| `campaign/index.ts` | 60–62 | Use `generateCampaignId()` from `../ids.js` instead of `Date.now()` + `Math.random()`. |
| `campaign/index.ts` | 64–66 | Update `formatMarkdown` to emit bullet lists for arrays (`- item` per line). |
| `constitution.ts` | 1–96 | Move `node:fs`/`node:path` imports to the top of the file. |
| `constitution.ts` | 107–115 | Replace raw `JSON.parse` + `as Constitution` with `ConstitutionSchema.parse(...)`; import `generateAmendmentId` from `./ids.js`. |
| `constitution.ts` | 122–128 | Replace `writeFileSync` with `atomicWriteFileSync`. |
| `constitution.ts` | 229–248 | Replace `generateAmendmentId()` body with `generateAmendmentId()` from `./ids.js`. |
| `types/index.ts` | 1–6 | Replace bare string aliases with branded interfaces: `interface AgentId { readonly id: string }`, etc. |
| `types/index.ts` | 27–48 | Add `AgentContext` interface with plan-specified path fields, `tokenBudget`, and `allowedMcp`. |
| `types/index.ts` | — | Add missing `ToolName`, `ToolCall`, `TodoItem`, `MeetingRoomOutput` interfaces and re-export them. |
| `errors/index.ts` | 1–10 | Forward `cause` to `super(message, { cause })` in `GlideError`. |
| `errors/index.ts` | 17–24 | Either wire `PermissionDeniedError` into campaign/agent permission checks or remove it. |
| `errors/index.ts` | — | Add `InvalidCampaignError` and `InvalidConstitutionError` for schema-validation failures. |
| `fs/campaign-fs.ts` | 4–17 | Validate parsed JSON against `ConstitutionSchema`; throw `InvalidConstitutionError` on failure. |
| `fs/agent-fs.ts` | 66–77 | Use `atomicWriteFileSync` instead of `writeFileSync` for `ensureAgentFiles`. |
| `fs/agent-fs.ts` | 125–152 | Replace `TBD` placeholder in `GOAL.md` with an explicit `[UNSET]` marker and add a validator that rejects agents with unset goals. |
| `fs/types.ts` | 1–28 | Remove duplicate interfaces; re-export from `types/index.ts` instead. |
| `schemas/index.ts` | — | Define `GoalMetadataSchema` and replace `z.record(z.unknown())` in `GoalRecordSchema.metadata`. |
| `index.ts` | 1–12 | Drop `.js` extensions from barrel re-exports. |
| `contract.ts` | 70–83 | Validate the written `contract.json` against `AgentContractSchema` after `atomicWriteFileSync`. |
| `goal.ts` | 1–20 | Define a shared `Status` union or map `GoalStatus` to `TodoItem.status` values. |

---
## 6. Tests Required
| File | Public functions/classes | Required scenarios |
|------|--------------------------|--------------------|
| `campaign/index.ts` | `createCampaign`, `loadCampaign`, `ensureCampaignDir` | happy path, missing file, corrupt JSON, duplicate creation, atomicity on crash mid-write |
| `constitution.ts` | `loadConstitution`, `writeConstitution`, `proposeAmendment`, `transitionAmendmentStatus`, `validateChangeAgainstConstitution`, `isValidStatusTransition`, `generateAmendmentId` | round-trip with Date coercion, immutable principle violation, invalid status transition, unknown principle ID |
| `fs/agent-fs.ts` | `validateAgentDirectory`, `ensureAgentFiles`, `loadAgentDirectory`, `listAgentDirectories`, `cleanupAgentDirectory` | missing files, invalid contract JSON, placeholder rejection, empty teams dir |
| `fs/campaign-fs.ts` | `validateCampaignDirectory` | missing constitution, malformed JSON, invalid schema |
| `io/atomic-write.ts` | `atomicWriteFileSync`, `atomicAppendFileSync`, `safeReadFileSync`, `fsyncPath` | crash during write leaves no partial file, append preserves prior content, fsync on directory persists rename |
| `security/path-guard.ts` | `resolveAndValidatePath`, `createPathGuard` | traversal outside root, symlink outside root, non-existent path when required |
| `security/command-guard.ts` | `runAllowedCommand`, `sanitizeWorkspacePath`, `normalizeCommand` | disallowed command, shell metacharacters, cwd outside workspace |

---
## 7. Prioritized Fixes
### P0 — Must fix before production
| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 1 | Replace raw `JSON.parse` with Zod schemas + `z.coerce.date()` for all loaders | `campaign/index.ts`, `constitution.ts`, `fs/campaign-fs.ts` | Medium |
| 2 | Use `atomicWriteFileSync` for all core writers; add fsync durability | `campaign/index.ts`, `constitution.ts`, `fs/agent-fs.ts` | Medium |
| 3 | Import and use `generateCampaignId` / `generateAmendmentId` from `ids.ts`; remove `Math.random()` | `campaign/index.ts`, `constitution.ts` | Small |
| 4 | Add `InvalidCampaignError` and `InvalidConstitutionError`; replace bare `Error` throws | `errors/index.ts`, `campaign/index.ts`, `constitution.ts` | Small |
| 5 | Add `teams`/`agents` dir creation in `ensureCampaignDir` to match agent-fs layout | `campaign/index.ts` | Small |

### P1 — Production hardening
| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 6 | Brand `AgentId`/`SessionId`/`CampaignId` as `readonly` interfaces; add missing Plan interfaces | `types/index.ts` | Medium |
| 7 | Define `AgentContext`, `ToolName`, `ToolCall`, `TodoItem`, `MeetingRoomOutput` and re-export from `index.ts` | `types/index.ts`, `schemas/index.ts`, `index.ts` | Medium |
| 8 | Replace `Record<string, unknown>` metadata with typed `GoalMetadataSchema` | `goal.ts`, `schemas/index.ts` | Small |
| 9 | Forward `Error.cause` in `GlideError`; remove or wire `PermissionDeniedError` | `errors/index.ts` | Small |
| 10 | Move side-effect imports to file top in `constitution.ts` | `constitution.ts` | Trivial |
| 11 | Drop `.js` extensions from barrel re-exports in `index.ts` | `index.ts` | Trivial |
| 12 | Remove duplicate interfaces in `fs/types.ts`; re-export from `types/index.ts` | `fs/types.ts` | Small |
| 13 | Write vitest test suite for core loaders, writers, schemas, guards | `packages/core/src/**/*.test.ts` | Large |

### P2 — Polish and consistency
| # | Action | File(s) | Effort |
|---|--------|---------|--------|
| 14 | Add async I/O variants (`atomicWriteFile`, `atomicAppendFile`) | `io/atomic-write.ts` | Medium |
| 15 | Validate markdown section structure in `validateAgentDirectory` | `fs/agent-fs.ts` | Small |
| 16 | Define shared `Status` union for goals/todos | `goal.ts`, `schemas/index.ts` | Small |
| 17 | Add runtime validation that `GOAL.md` does not contain `TBD` placeholder | `fs/agent-fs.ts` | Small |

---
## 8. Positive Findings
- `io/atomic-write.ts` implements correct temp-file + rename + fsync crash-safe writes.
- `io/id.ts` provides `nanoid`-based ID generators with validators for all entity types.
- `schemas/index.ts` is comprehensive and schema-first; it defines contracts for campaigns, goals, agents, todos, permissions, plugins, sessions, traces, and graphify data.
- `security/path-guard.ts` and `security/command-guard.ts` are strong, well-tested security primitives with symlink traversal guards and shell-metacharacter blocking.
- `contract.ts` uses `atomicWriteFileSync` for agent contract creation and validates `AgentContext` IDs via `isAgentId`.
- No circular dependencies; package structure is clean and modular.

---
## 9. Bottom Line
`packages/core` has evolved from a stub into a structurally sound foundation with correct durability utilities (`io/atomic-write.ts`), strong schemas (`schemas/index.ts`), and security guards (`security/`). However, it still **violates its own architecture plan** in three critical ways: (1) core data loaders bypass the package’s Zod schemas, (2) writers ignore the package’s atomic-write utilities, and (3) ID generation is inconsistent. These gaps are P0 because they directly undermine the plan’s guarantees of type safety, crash safety, and deterministic execution. Fixing them requires wiring the existing internal utilities into `campaign/index.ts`, `constitution.ts`, and `fs/agent-fs.ts`, plus adding the missing Plan-specified type contracts and a test suite.
