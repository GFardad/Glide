# Glideloop Orchestrator Design

## Status
Proposed — based on 7 research agents' findings.

## Topology
```
User <-> Hermes CTO Skill <-> CTO Assistant + Meeting Room
                                       |
                               Approved Plan
                                       |
                        Glideloop Orchestrator (external)
                        /       |       \       \
                  Team A    Team B    Team C   ... (up to 20)
                  /    \     /    \     /    \
               Agent  Agent ... (5 per team, 5 subagents each)
```

## Key Design Decisions (from research)

### 1. Orchestrator Pattern
**Recommendation: Hybrid LangGraph + Codex CLI**
- LangGraph-style state machine for durable workflow control
- Codex CLI-style depth limits and concurrency controls
- Fresh-agent-per-task model (OpenCode pattern) for context isolation
- Explicit approval checkpoints (LangGraph `interrupt` pattern)

### 2. Context Isolation
**Recommendation: Cluster-scoped contexts with deterministic IDs**
- Cluster = logical work unit (e.g., `feature-auth`, `bugfix-payment`)
- Context ID = `hash(cluster_id, role, agent_id, step)`
- Workers see: GOAL.md + TODO.md + immediate parent output
- Orchestrator sees: cluster goal + team summaries + registry summaries
- CTO sees: all cluster summaries + meeting minutes
- Only finalized artifacts promote to global store

### 3. Recursive Delegation Limits
**Recommendation: Hard depth cap + concurrency control**
- Max depth: 3 levels (CTO → Orchestrator → Team → Agent → Subagent)
- Max concurrent children per parent: 5
- Global kill switch in config
- Heartbeat-based liveness + hard timeout with diagnostics

### 4. Human-in-the-Loop
**Recommendation: Tiered approval gates**
- Tier 0: Routine todos auto-route (no approval)
- Tier 1: Team-level plans require Orchestrator approval
- Tier 2: Architectural changes require CTO confirmation
- Tier 3: Scope changes require user confirmation
- All decisions logged in meeting Minutes with rationale

### 5. Memory/State Sharing
**Recommendation: Event-sourced registry with bounded sharing**
- Single source of truth: SQLite + JSONL event stream
- Agents write events, never mutate others' state directly
- Summaries promote to global store; raw context stays cluster-local
- Versioned artifacts with rollback capability

### 6. Self-Improvement Loop (Separate)
**Recommendation: Two-timescale meta-loop**
- Fast timescale (daily): prompt refinement per role
- Slow timescale (weekly): workflow/strategy rewrites
- Held-out validation gate before any promotion
- Separate from test/critic loop; different cadence and purpose

## Implementation Roadmap

### Phase 1: CTO Skill + Meeting Room (Brainstorm)
- Hermes skill that activates CTO role
- Meeting room with 10 personality files
- Minutes format + drift detection
- Mega-Research tool integration

### Phase 2: External Orchestrator (Execute)
- MCP server for external agent control
- Team/agent dispatch logic
- Process lifecycle management
- Log streaming back to Hermes

### Phase 3: Todo Registry + RAG (Workflow)
- SQLite schema for todos/agents/events
- Embedding pipeline for dedup
- State machine for todo lifecycle
- Routing logic with dedup gates

### Phase 4: Meta-Loop (Improve)
- Meta-agent that observes trajectories
- Prompt refinement pipeline
- Validation gates + rollback
- Versioned playbook store

## Dependencies
- Research docs in `/home/gfardad/glideloop-*.md`
- ADR-001: Context Isolation
- Meeting Room Architecture doc
