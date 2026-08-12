# Glide — Consolidated Production-Readiness Audit
**Date:** 2026-08-11
**Repo:** /media/Storage/home-gfardad/Projects/Glide
**Audits merged:** plan-vs-reality, MCP patterns, MCP control-plane hardening, architecture-vs-code, code-quality/coverage, live command verification

---

## Overall Health
- `pnpm typecheck` / `build` / `lint` / `test` / `e2e` / `cli --help` all pass.
- 300 tests across 46 files.
- No leftover `Glide`/`.py`/`systemd` refs outside plan docs and the intentional helper `scripts/generate-coverage-tests.py`.

---

## Critical / P0 — must fix before production
| # | Area | File(s) | Issue |
|---|------|---------|-------|
| 1 | MCP lifecycle | `packages/mcp-server/src/server.ts` | No `notifications/initialized`, no `shutdown`/`exit`, no drain of in-flight handlers. |
| 2 | Logging/stderr | `packages/mcp-server/src/server.ts`, `bridge/HostBridge.ts` | Zero structured stderr logging for requests, responses, errors, lifecycle transitions. |
| 3 | Stdio robustness | `packages/mcp-server/src/server.ts` | No backpressure-aware writes, no per-request timeout/abort, no batch support. |
| 4 | Error schema | `packages/mcp-server/src/bridge/types.ts`, `bridge/HostBridge.ts` | Uses string error codes; spec requires numeric JSON-RPC codes. |
| 5 | Security | `packages/permissions/src/gates.ts` | `execSync` with unsanitized workspace paths; hard-coded `npm` commands. |
| 6 | Security | `packages/tracer/src/graphify.ts` | `JSON.parse` of untrusted `graph.json` without validation. |
| 7 | Security | `packages/plugin-api/src/composition.ts` | Unvalidated plugin defaults injected into composed bundle. |
| 8 | Architecture | `packages/tracer/src/tracer.ts`, `packages/executor/src/session.ts` | Module-level mutable singletons break multi-campaign isolation and durability. |
| 9 | Durability | `packages/tracer/src/tracer.ts`, `packages/executor/src/session.ts` | `appendFileSync` JSONL not crash-safe; no fsync, rotation, sequence markers, compaction. |
| 10 | Docs | `README.md`, `docs/api.md` | Tool surface drift: docs omit `glide_graph`, `glide_converge`, `glide_gates`; `glide_status` hard-codes stale `phase: "1-2"`. |

---

## High / P1 — production hardening
| # | Area | File(s) | Issue |
|---|------|---------|-------|
| 11 | Plugin sandboxing | `packages/plugin-api/src/registry.ts`, `loader.ts` | In-memory only; no capability tokens, resource limits, crash isolation, permissions tie-in. |
| 12 | CLI transport | `packages/cli/src/cli.ts` | Manual argv parsing + raw spawn; no SDK `StdioClientTransport`, `--timeout`, `--retries`, stderr separation. |
| 13 | Coverage | `packages/mcp-server/src/server.ts`, `tools/*` | `server.ts` 41%, `glide-converge.ts` 27%, `glide-gates.ts` 47%, `gates.ts` 19%, `composition.ts` 13%. |
| 14 | Types | `packages/plugin-api/src/composition.ts`, `durability.ts`, `types.ts` | Excessive `Record<string, unknown>`; weak schema boundaries. |
| 15 | Trace feature | `packages/tracer/src/tracer.ts` | `simple-git`/`git blame` integration listed in Architecture/deps but never used. |
| 16 | Hermes config | `docs/hermes-mcp.md`, `scripts/verify-hermes-config.cjs` | No CI/test gate verifies live Hermes discovery or config path. |
| 17 | Generated artifacts | `graphify-out/`, `coverage/`, `todos.json` | Large generated files tracked; `.gitignore` does not exclude them. |

---

## Medium / P2 — cleanup and consistency
| # | Area | File(s) | Issue |
|---|------|---------|-------|
| 18 | Docs | `Plan/ImplementationPlan.md` | Still references `scripts/glide.mjs`; actual CLI is `packages/cli/src/cli.ts`. |
| 19 | Docs | `Plan/ImplementationPlan-vs-Reality.md` | Claims 97.33% coverage / 163 tests; actual ~85% / 300 tests. |
| 20 | Package metadata | `packages/cli/package.json` | Declares `bin` but root also hard-codes node invocation; inconsistent binary contract. |
| 21 | Tech-stack drift | `Plan/TechnicalSpec.md` | Lists `better-sqlite3`, `esbuild`, `ulid`, `nanoid` not present in source. |
| 22 | Repo structure | `README.md` | Lists `packages/mcp-server` as a separate package while workspace/config already accounts for it differently. |
| 23 | Tests | `test/repro-mcp.ts` | Malformed Node script piped to stdio; should be a JSON-RPC harness or removed. |

---

## Source of Truth for Fixes
- `Plan/ArchitectureReview-2026-08-11.md`
- `/tmp/glide-gap-report.md`
- `/home/gfardad/glide-cleanup-audit.md`
- `deleg_ce23b8b9` MCP control-plane audit summary

---

## Recommended Execution Order
1. Stabilize MCP stdio lifecycle/stderr/backpressure in `server.ts`.
2. Harden `HostBridge` error codes and wire or remove it consistently.
3. Fix `gates.ts` exec/validation and add gate tests.
4. Add schema validation / narrower types in `composition.ts`, `durability.ts`, `types.ts`.
5. Crash-safe JSONL writers in `tracer.ts` and `session.ts`.
6. Replace global singletons with package-scoped lifecycle objects.
7. Sync docs/tool lists and stale phase/coverage claims.
8. `.gitignore` generated artifacts; clean up `test/repro-mcp.ts`.
9. CLI transport hardening.
10. Plugin sandboxing/capabilities/permissions tie-in.
