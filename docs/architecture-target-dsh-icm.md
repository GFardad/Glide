# Glide Architecture Target — DeepSeek Harness + ICM

## Source Architecture
- DeepSeek Harness: plugin-first, Cordis runtime, `dsh` CLI, Web UI at `:3080`.
- ICM: folder structure as agent architecture, numbered folders as sequencing, markdown as state, one librarian agent, walk-test validation.

## Current Glide Shape
- Monorepo: `core`, `executor`, `headroom`, `tracer`, `permissions`, `plugin-api`, `mcp-server`, `cli`, `dashboard`.
- MCP stdio server exposing 17 tools.
- Campaign concept already exists but is not strictly ICM-shaped.
- Roles exist in headroom but are metadata-only; no role-gated tool access.
- No single “CEO monitor” surface; status/graph/trace are separate.

## Target Architecture
1. **Plugin-first**: every Glide capability is a `dsh` plugin with manifest.
2. **ICM workspace**: campaigns are folders with numbered stages, contracts, state files.
3. **CEO role**: single tool `glide_dashboard` aggregates system health for a CEO-class agent.
4. **Walk test**: an agent with no memory can orient from the folder alone.

## Phase Plan
- P1: ICM campaign scaffold + CEO dashboard MCP tool.
- P2: Package each Glide capability as a Dsh plugin manifest.
- P3: Replace custom executor loop with Cordis-style plugin runtime.
- P4: Web UI dashboard at `:3080` using existing dashboard package.
