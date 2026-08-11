# Glide — Implementation Plan

## Current State

- OmniForge proved multi-mid-tier-token > single-strong-model
- All systemd daemons stopped/disabled
- TypeScript monorepo scaffolded and verified at `~/Projects/Glide/`
- **Phases 0–5 complete**, **Phase 6 (dashboard) complete**
- All quality gates green: typecheck, lint, build, tests (163 tests / 27 files), 97.33% stmts coverage, no circular deps, prettier clean
- **Remaining**: Hermes wiring, CLI, Prime-Agent depth, graphify integration

## Target State

- Glide as Hermes-native MCP tool, callable from any session
- Layer 0 = Hermes skill (CTO interpreter), not a daemon
- Layer 1 = Headroom/Meeting Room owned by CTO
- Layer 2 = Program Management
- Layer 3 = Execution Teams
- Tool names: glide__, not ceo__
- No delegate_task; MCP stdio as CLI control plane
- Prime-Agent patterns for session durability
- Open-source components only, no reinventing
- TypeScript monorepo, strict mode, fully tested

## Tech Stack

- Language: TypeScript (strict mode)
- Runtime: Node.js >= 20
- Package manager: pnpm workspaces
- MCP: `@modelcontextprotocol/sdk`
- Validation: Zod
- Testing: Vitest + coverage
- Linting: ESLint + Prettier
- Git tracing: `simple-git`

## Repo Structure

```
~/Projects/Glide/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── packages/
│   ├── core/
│   ├── mcp-server/
│   ├── headroom/
│   ├── executor/
│   ├── tracer/
│   ├── permissions/
│   ├── plugin-api/
│   └── dashboard/
├── plugins/
│   └── example-plugin/
├── skills/
│   └── glide-cto/
├── test/
└── Plan/
```

## Phases

### Phase 0: Repo Scaffold — COMPLETED

- [x] Create `~/Projects/Glide/` canonical structure
- [x] Setup TypeScript monorepo with pnpm workspaces
- [x] Create all package scaffolding
- [x] Update `Plan/Architecture.md` with TypeScript/modular/production-grade directives
- [x] Add package-specific tsconfig files
- [x] Install dependencies and verify build
- [x] Add ESLint flat config + TypeScript ESLint plugin
- [x] Add smoke tests and verify `pnpm test` passes
- [x] Verify `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass

### Phase 1: Layer 0 + MCP Surface — COMPLETED

- [x] Draft `skills/glide-cto/SKILL.md` (Hermes CTO interpreter)
- [x] Implement idea extraction dialogue in skill
- [x] Write `GOAL.md`, `NON_GOALS.md`, `ASSUMPTIONS.md` generation
- [x] Approval gate before passing to MCP
- [x] Wire skill to `glide_headroom` MCP call
- [x] Scaffold TypeScript MCP server tool stubs: `glide_status`, `glide_goal_set`, `glide_goal_get`, `glide_headroom`
- [x] Verify MCP server starts and responds to stdio

### Phase 2: Layer 1 — Headroom MCP — COMPLETED

- [x] Implement `glide_headroom` with CTO + role prompts
- [x] Add drift detection
- [x] Output: Risk Log + Architecture + Todo Registry
- [x] Test with simple objective

### Phase 3: Layer 2 — Program Management — COMPLETED

- [x] Add `glide_plan`, `glide_build`, `glide_test`, `glide_review`, `glide_ship`
- [x] Epic → Team → Agent tree
- [x] Parent sees only child summaries

### Phase 4: Layer 3 — Execution + Permissions — COMPLETED

- [x] Agent file contract: PERSONALITY.md, GOAL.md, NOTES.md, TODO.md, REJECTED.md
- [x] Permission request/approval protocol
- [x] `glide_indepth` and `glide_trace` tools

### Phase 5: Native Bridge + Plugins — COMPLETED

- [x] Prime-Agent session durability
- [x] OpenCode/Hermes Agent plugin loader
- [x] MCP plugin registry

### Phase 6: Virtual Office Surface — COMPLETED

- [x] Web UI or Hermes skill dashboard
- [x] Real-time session/task view

## Quality Gates

- Every package must have tests before moving to next phase
- No production code without type coverage
- No circular dependencies between packages
- All public APIs must be documented
- Coverage threshold: 80% for core packages
- Per-phase verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Remaining Work

1. **Hermes wiring** — integrate Glide as a native Hermes MCP plugin so it is callable from any session
2. **CLI** — ship a `glide` CLI wrapper around the MCP stdio control plane
3. **Prime-Agent depth** — extend session durability beyond basic scaffolding
4. **graphify integration** — hook the knowledge-graph layer into Glide's trace and program-management tools

## Immediate Next Steps

1. Wire Glide into Hermes as a native MCP plugin
2. Implement the `glide` CLI entry point
3. Extend Prime-Agent session durability
4. Integrate graphify for knowledge-graph-backed trace and program views
