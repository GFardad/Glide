# Glideloop — Deep Planning Document

## Executive Summary
Glideloop is a **dynamic multi-agent office system** where you talk to one CTO agent in Hermes, and it runs a personality-driven meeting room that produces real execution through an external orchestrator. Every agent gets persistent `.md` artifacts. Todos flow through a RAG registry that deduplicates and routes work. Two separate meta-loops improve the system itself and runtime outputs over time.

**This is a planning document, not implementation.** All architecture decisions are recorded here before any code is written.

---

## 1. Research Findings (Consolidated)

We ran 7 parallel research agents on:
1. Hermes delegation internals → replicate externally via fresh-agent-per-task + thread pool + depth limits
2. Orchestration frameworks → LangGraph for state, Codex CLI for depth/concurrency controls, OpenCode for isolation
3. RAG todo dedup → hybrid pipeline: exact hash → Jaccard → embedding cosine → cross-encoder re-rank
4. Meeting room personalities → Camel/ChatDev/MetaGPT patterns; Superpowers repo not found publicly
5. MCP control plane → external stdio harness, SQLite state, bounded log streaming
6. Meta-learning → two-timescale evolution, held-out gating, versioned artifacts
7. Context isolation → cluster-scoped contexts, deterministic IDs, progressive summarization

Full reports saved in `/home/gfardad/glideloop-*.md`.

---

## 2. Architecture Decisions

### 2.1 Topology
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

**Key**: The CTO Skill + Meeting Room are **part of the Glideloop Orchestrator**, not separate. They are the **top planning layer**. The Orchestrator includes:
- Planning/Architecture layer (CTO + Meeting Room)
- Execution layer (Teams + Agents + Subagents)
- Registry layer (Todo RAG + Dedup)
- Meta layer (Self-improvement loops)

### 2.2 Key Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Current loop | Side-by-side | Keep `mythus5-intelligent-loop.service` running; Glideloop is separate |
| Teams | Fixed roster, dynamic activation | 12 predefined teams, activate 2-10 per objective |
| State format | SQLite + JSONL | SQLite for registry queries; JSONL for append-only event stream |
| Execution | Plans + controlled execution | Orchestrator can write files and run commands in `/glideloop/runtime/workspace/` |
| Approval | Hybrid gates | Routine auto-route; architectural changes require CTO confirmation |
| Self-improvement | Two separate loops | Loop A: improve Glideloop itself. Loop B: runtime output improvement for user tasks |
| Parallelism | Session-isolated, context-isolated | Different sessions, different contexts, same quality or better |

### 2.3 Agent File Contract (Non-negotiable)
Every agent (main + sub) gets **at least 4 `.md` files**:
1. `PERSONALITY.md` — role definition, mandate, constraints, perspective
2. `GOAL.md` — objective from parent/CTO/Orchestrator
3. `NOTES.md` — scratch space, observations, context, things tried
4. `TODO.md` — mutable checklist agreed during routing

**Rejection Policy (Non-negotiable):**
- **Nothing gets JUST rejected.** Every rejection must be saved with:
  - **Reason**: why it was rejected
  - **What it must do** to not be rejected (acceptance criteria)
  - **Who rejected it** and when
  - **Current status**: rejected / needs-revision / accepted
- Rejected items go to `REJECTED.md` or a `REJECTED/` section in the agent's folder
- The parent/CTO/Orchestrator can revisit rejected items with new context

**Todo Routing Flow:**
1. Agent proposes new todo in `TODO.md`
2. It goes to **Todo Registry Agent** with RAG store of all existing todos
3. If duplicate → merged or rejected with reason + improvement path
4. If novel → parent/CTO/Orchestrator decides priority
5. Agent receives approved todo in `TODO.md`
6. Orchestrator decides: stays with that agent, or re-routes to another

---

## 3. First Use of Top Layer

The CTO + Meeting Room are not just for making todos. Their first output is:
1. **Plan** — step-by-step execution plan
2. **Architecture** — structural decisions, boundaries, interfaces, ADRs
3. **Todos** — actionable items with owners, priorities, and acceptance criteria

All three are produced together, reviewed together, and approved together.

---

## 4. Fixed Teams

1. **Engineering** — implementation, refactoring, bug fixes
2. **Research** — Mega-Research, validation, alternatives
3. **QA** — tests, acceptance criteria, rollback plans
4. **Security** — threat model, permissions, isolation review
5. **Docs** — documentation, READMEs, changelogs
6. **Data** — metrics, observability, logging schema
7. **Infra** — deployment, environment, process management
8. **Product** — scope, priorities, user impact
9. **Design** — UX, workflow ergonomics, flow diagrams
10. **Architecture** — structural decisions, boundaries, ADRs
11. **Meta** — self-improvement, prompt evolution, strategy updates
12. **Registry** — todo dedup, routing, lifecycle tracking

---

## 5. Meeting Room Design

### 5.1 Roles
- **CTO (Hermes skill)** — final decision, idea approval, drift correction
- **CTO Assistant** — refine ideas, check drift, coordinate meeting
- **10 role-specific agents** — Architect, Engineer, Researcher, QA, Security, Docs, Data, Infra, Product, Design

### 5.2 Flow
1. User submits idea → CTO captures as raw Minutes
2. CTO Assistant reviews against recent history; if drift > threshold, flag to CTO
3. Round-table: each role produces a 1-page perspective in parallel
4. Synthesis: CTO Assistant merges perspectives, highlights conflicts
5. CTO review: CTO checks alignment with user intent; requests revisions if needed
6. Consensus: if all roles approve, plan is locked and sent to Orchestrator

### 5.3 Drift Detection
- Every 5 steps, CTO Assistant compares current proposal to original user Minutes
- Drift score = semantic similarity between current proposal and original intent
- If drift > threshold: CTO is alerted; meeting returns to alignment phase
- All additions/deletions are logged with rationale in Minutes

### 5.4 Personality Format
Each role is defined in `/glideloop/meeting-room/roles/<role>.md`:
```
# Role: <Name>
## Mandate
## Constraints
## Output Schema
## Perspective
```

Note: Superpowers project was not found in public repos. We'll design our own personality format inspired by Camel/ChatDev/MetaGPT, with hot-swappable personality files for future import.

---

## 6. Context Isolation

### 6.1 Strategy
- **Cluster-scoped contexts** with deterministic IDs
- Cluster ID = `hash(cluster_id, role, agent_id, step)`
- Workers see: GOAL.md + TODO.md + immediate parent output
- Orchestrator sees: cluster goal + team summaries + registry summaries
- CTO sees: all cluster summaries + meeting minutes
- Only finalized artifacts promote to global store

### 6.2 Rationale
Mid-tier models have limited context. Sharing one big context across 20 teams and 100 agents causes:
- Context pollution
- Higher cost per iteration
- Increased hallucination risk
- Difficulty attributing reasoning

### 6.3 Alternatives Considered
- Single shared context: rejected
- Fully isolated per agent: rejected
- Hybrid (shared core + private scratch): **selected**

See `docs/adr-001-context-isolation.md` for full details.

---

## 7. Self-Improvement Loops (Two Separate Loops)

### 7.1 Loop A: System Self-Improvement (Glideloop improves itself)
- **Purpose**: improve prompts, strategies, routing rules, personality files
- **Cadence**: weekly (slow timescale)
- **Scope**: operational config, workflow logic, agent prompts, team definitions
- **Gate**: held-out validation; candidate must not regress on disjoint validation episodes
- **Persistence**: versioned artifacts with rollback; textual gradient log
- **Safety**: never overwrite current stable in place; write candidate → validate → promote

### 7.2 Loop B: Runtime Output Improvement (Improve user-facing outputs)
- **Purpose**: improve quality of plans, code, reports delivered to user
- **Cadence**: daily (fast timescale)
- **Scope**: prompt refinement per role, summarization quality, dedup thresholds
- **Gate**: A/B testing on held-out tasks; user feedback correlation
- **Persistence**: experience replay buffer + ranked hindsight per task family
- **Safety**: separate from Loop A; runtime loop cannot modify system config without Loop A approval

### 7.3 Why Two Loops?
- Mixing system improvements with output improvements causes unsafe mutations
- System changes need stronger validation (weekly gate)
- Output improvements can iterate faster (daily) with lighter validation
- Clear ownership: Loop A = Meta-agent, Loop B = Orchestrator + CTO Assistant

See `docs/self-improvement-loops.md` for full design.

---

## 8. MCP Control Plane (Best-Practices Refinement)

### 8.1 Topology
- **External harness** lives outside `~/.hermes/` (e.g., `~/.glideloop/`)
- Hermes talks to Glideloop only via **one MCP stdio server**
- Glideloop manages external agent processes itself; it does **not** shell out to `hermes delegate_task` from the MCP server

### 8.2 Process Spawning
- Use `subprocess.Popen` with:
  - `cwd` scoped to agent workspace
  - `env` restricted to allowlist
  - process group or `setpgrp` for easier kill
  - stdout/stderr piped to ring buffers or files
- Maintain an in-memory registry plus on-disk manifest for PID, status, ports, and paths

### 8.3 State Persistence
- Store state in a **durable SQLite DB** under `~/.glideloop/state/glideloop.sqlite`
- Tables: `agents`, `jobs`, `events`
- Use `INSERT OR REPLACE`, WAL mode, and bounded busy timeout

### 8.4 Streaming Logs/Events
- MCP tools return structured results, but streaming is best delivered through **polling tools + bounded payloads**
- `stream_agent_logs` returns up to N lines and a cursor/timestamp
- For richer event streams, add **server-sent event style resources** or write logs to files and expose `read_resource` URIs
- Keep each response bounded; never return full unbounded logs in one tool call

### 8.5 Security/Isolation
- Run each agent in a **dedicated working directory** and restricted env
- Use Linux namespaces only if truly needed; otherwise rely on:
  - `cwd` confinement
  - env allowlist
  - file permission scoping
  - separate process groups for signal delivery
- Do not let Glideloop inherit arbitrary Hermes env vars; inject only required values explicitly

See `docs/mcp-architecture.md` for full design.

---

## 9. Parallel Scalability (Non-Negotiable)

### 9.1 Requirements
- Everything must be scalable as parallel tests (different sessions, different contexts)
- Parallelism must not lower quality
- Parallelism must improve quality over time

### 9.2 Architecture Principles
1. **Session isolation**: each objective gets its own session ID, state directory, and context namespace
2. **Context isolation**: each agent gets its own context scope (see ADR-001)
3. **Parallel by default**: teams and agents run concurrently unless explicitly sequenced
4. **Quality gates**: every parallel branch must pass the same acceptance criteria as serial execution
5. **Merge semantics**: parallel outputs are merged by the Orchestrator using conflict resolution rules

### 9.3 Implementation Strategy
- Use `session_id` as the top-level isolation key
- All state files, logs, and artifacts are namespaced by `session_id`
- Parallel sessions do not share mutable state
- Read-only references (personalities, templates) can be shared
- All writes go through the Todo Registry with optimistic concurrency

---

## 10. Todo Registry + RAG Dedup

### 10.1 Flow
1. Agent proposes new todo
2. Registry does semantic search + fuzzy pre-filter
3. If match > threshold: propose merge; if accepted, update state machine and deprecate duplicate
4. If no match: create new todo with PENDING state, embedding stored

### 10.2 Stack
- Embeddings: `text-embedding-3-small` or local `all-MiniLM-L6-v2`
- Vector DB: Chroma or Weaviate
- Metadata store: PostgreSQL + pgvector or SQLite
- Dedup pipeline: exact hash → Jaccard → embedding cosine → cross-encoder re-rank

### 10.3 State Machine
```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
                ↘ BLOCKED ↗
```

### 10.4 Key Invariant
Every todo creation goes through the registry agent first. No agent creates todos directly.

---

## 11. Open Questions (Resolved by Default)

| # | Question | Default |
|---|----------|---------|
| 1 | Superpowers project | Proceed with our own personality format; make hot-swappable for future import |
| 2 | First prototype | **A) Meeting room + CTO skill** (brainstorm → plan → present) |
| 3 | Team naming | Keep the 12 names defined above |
| 4 | Approval strictness | **Hybrid** — routine auto-route; architectural changes require CTO confirmation |
| 5 | Persistence location | **`/media/Storage/home-gfardad/projects/glideloop/`** for now; design for `~/.glideloop/` migration later |

---

## 12. Next Steps (No Code Yet)

1. **Lock ADRs** in `/glideloop/docs/`
2. **Define exact schemas** for PERSONALITY.md, GOAL.md, NOTES.md, TODO.md, REJECTED.md, Minutes
3. **Spec the MCP tool interface** (`glideloop_mcp.py`) with best-practice isolation
4. **Prototype the CTO skill** (Hermes side only, no execution)
5. **Design the Todo Registry schema** (SQLite + embedding strategy)
6. **Design the two self-improvement loops** in detail
7. **Design parallel session architecture** with session isolation

---

*This document is the source of truth. All future decisions must reference or update it.*
