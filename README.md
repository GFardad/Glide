# Glide — Dynamic Multi-Agent Office System

## Status
Executable MVP published to GitHub. Tests passing. Dev/production runtime wired.

## Core Concept
Glide is a self-organizing multi-agent office where:
- The user talks to a CTO agent inside Hermes
- The CTO runs a "meeting room" with personality-driven roles
- An Orchestrator breaks approved plans into teams/agents
- Every agent carries its own goal document + todo list
- A RAG-backed Todo Registry deduplicates and routes todos
- External agents run under controlled supervision via an MCP tool
- A separate meta-loop improves the system itself over time
- Production CTO controls dev CTO via `runtime/dev_env.py`
- Structured JSONL logging + observability counters cover full runtime

## Key Constraints
1. Every agent (main + sub) must have at least 2 `.md` files:
   - `GOAL.md`: the assigned objective from parent/CTO/Orchestrator
   - `TODO.md`: mutable checklist agreed in routing
2. No Hermes subagents as workers — we replicate the logic externally
3. Mid-tier models only (unlimited tokens) — needs heavy context management, review, and remembering
4. Everything written in files, persisted
5. Fixed team/agent structures, dynamically activated per objective

## Directory Layout
```
/glide
/docs/           # Architecture, ADRs, specs
/plans/          # Current and historical plans
/meeting-room/   # CTO + personalities + minutes
/teams/          # Team definitions and state
/agents/         # Agent runtime (prompts, memory, todos)
/runtime/        # Process runner, MCP server, queue
/registry/       # Global todo RAG + dedup store
/research/       # Mega-Research outputs
/skills/         # Hermes skill definition
```

## Quickstart

### Run tests
```bash
PYTHONPATH=$(pwd) python3 -m pytest -q
```

### Production CTO
```bash
bash scripts/run_production_cto.sh
```

### Dev CTO
```bash
bash scripts/run_dev_cto.sh
```

### Promote release
```bash
git checkout dev
bash scripts/promote_release.sh
```

## Remote
GitHub: https://github.com/GFardad/glide
Branches: `main` (production), `dev` (development)

## Phase Status
See `docs/implementation-roadmap.md` for locked execution order and phase status.
