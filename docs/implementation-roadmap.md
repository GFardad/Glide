# Glideloop — Implementation Roadmap

## Status
Locked — execution order, phases, and first artifacts.

## Principle
Build in vertical slices. Each slice produces a runnable artifact. No big-bang integration.

---

## Phase 0: Rename and Bootstrap
**Goal:** preserve existing stable loop, establish Glideloop identity.

- [x] `system/intelligent_loop.py` → `system/glideloop.py` (backward-compat shim retained temporarily)
- [ ] `mythus5-intelligent-loop.service` → `mythus5-glideloop.service`
- [ ] Systemd unit reload + restart verification
- [ ] `runtime/` scaffold: `workspace/`, `sessions/`, `meta/`, `state/`
- [ ] `pyproject.toml` for Glideloop runtime package

---

## Phase 1: CTO Skill + Meeting Room Prototype (Priority A)
**Goal:** prove the top-layer UX on Hermes side only. No external execution yet.

### Tickets
1. **CTO Skill Core** — `skills/glideloop-cto/SKILL.md`
   - Detects Glideloop objective from user message
   - Captures raw Minutes
   - Invokes meeting room roles as Hermes subagents or structured prompts
   - Produces Plan + Architecture + Todos

2. **Meeting Room Roles** — `skills/glideloop-cto/roles/*.md`
   - 10 role personality files
   - Each role has mandate, constraints, output schema, perspective

3. **Drift Detection** — `skills/glideloop-cto/scripts/drift.py`
   - Compares current proposal to original Minutes
   - Returns drift score 0-1
   - Triggers realignment if > threshold

4. **Minutes Format** — `skills/glideloop-cto/templates/minutes.md`
   - Locked schema for meeting minutes
   - Append-only audit trail

5. **Smoke Test** — run CTO skill against a sample objective, verify Plan + Architecture + Todos output

### Success Criteria
- User submits idea → CTO produces Plan + Architecture + Todos without execution
- All 10 roles produce output
- Drift detection catches intentional drift injection
- Minutes are persisted and readable

---

## Phase 2: External Orchestrator Skeleton (Priority B)
**Goal:** external process that can spawn/manage agents, but no real agents yet.

### Tickets
1. **Package Structure** — `runtime/glideloop_orchestrator/`
   - `__init__.py`, `main.py`, `config.py`, `state.py`

2. **SQLite State** — `runtime/glideloop_orchestrator/state.py`
   - Initialize `sessions`, `agents`, `jobs`, `events` tables
   - WAL mode, busy timeout, `INSERT OR REPLACE`

3. **Process Manager** — `runtime/glideloop_orchestrator/processes.py`
   - `subprocess.Popen` with scoped `cwd`, env allowlist, process groups
   - In-memory registry + on-disk manifest

4. **MCP Server Stub** — `runtime/mcp/server.py`
   - 10 tool stubs returning static responses
   - `glideloop_status`, `glideloop_run`, `glideloop_stop`, etc.
   - Hermes wiring in `~/.hermes/config.yaml`

5. **Session Scaffold** — `runtime/glideloop_orchestrator/session.py`
   - Create/stop/pause session
   - Session directory layout under `runtime/workspace/`

6. **Smoke Test** — start session, verify directories, verify SQLite, stop session

### Success Criteria
- `glideloop_run` creates session with directories + SQLite rows
- `glideloop_status` returns active session
- `glideloop_stop` kills process group cleanly
- MCP server passes `hermes mcp test glideloop`

---

## Phase 3: Todo Registry + RAG Dedup (Priority C)
**Goal:** agents can propose todos, Registry deduplicates and routes.

### Tickets
1. **Registry Schema** — `runtime/registry/schema.py`
   - SQLite tables: `todos`, `events`, `agents`, `sessions`
   - Indexes, WAL, busy timeout

2. **Embedding Pipeline** — `runtime/registry/embeddings.py`
   - `text-embedding-3-small` or `all-MiniLM-L6-v2`
   - Embed and store in SQLite or Chroma

3. **Dedup Engine** — `runtime/registry/dedup.py`
   - Exact hash → Jaccard → cosine → cross-encoder
   - Merge proposal format
   - State machine transitions

4. **Registry Agent** — `runtime/registry/agent.py`
   - Receives todo proposals
   - Runs dedup pipeline
   - Writes to `todos` + `events`
   - Returns merge/create decision

5. **Integration Test** — propose duplicate todo, verify merge; propose novel todo, verify creation

### Success Criteria
- Duplicate todo is caught at >0.92 cosine similarity
- Novel todo is created with PENDING status
- Merge proposal includes reason + improvement path
- All transitions logged in `events`

---

## Phase 4: Meta-Loops (Priority D)
**Goal:** Loop B (daily runtime) and Loop A (weekly system) are operational.

### Tickets
1. **Loop B Monitor** — `runtime/meta/loop_b/monitor.py`
   - Scans NOTES.md, TODO.md, REJECTED.md for stuck/quality signals
   - 15-minute scan cadence

2. **Loop B Intervention** — `runtime/meta/loop_b/intervention.py`
   - Context reframe, decomposition, example injection, role reminder
   - Writes hints to NOTES.md/TODO.md
   - Bounded 1 hint/15min per agent

3. **Loop B Learning** — `runtime/meta/loop_b/learning.py`
   - Experience replay buffer
   - Pattern extraction
   - Ranked hindsight per task family

4. **Loop A Observer** — `runtime/meta/loop_a/observer.py`
   - Scans all session artifacts
   - Produces weekly system health report

5. **Loop A Validator** — `runtime/meta/loop_a/validator.py`
   - Replays held-out episodes
   - Monotone non-regression check

6. **Loop A Promoter** — `runtime/meta/loop_a/promoter.py`
   - Atomic promotion via symlink swap
   - Rollback capability

7. **Integration Test** — Loop B detects stuck agent, injects hint, verifies unstuck; Loop A proposes candidate, validates, promotes

### Success Criteria
- Loop B unstucks ≥70% of stuck agents within 2 hints
- Loop A never regresses on held-out episodes
- Rollback is instant and logged
- CTO can disable either loop per session

---

## Phase 5: Team Execution (Post-Prototype)
**Goal:** real teams + agents execute approved plans.

### Tickets
1. **Team Definitions** — `teams/*.yaml`
   - 12 team configs with roles, activation rules, max agents

2. **Agent Runtime** — `runtime/agents/runner.py`
   - Spawns external agent process per agent_id
   - Injects GOAL.md + TODO.md + personality
   - Reads NOTES.md + REJECTED.md
   - Enforces file contract

3. **Subagent Spawning** — `runtime/agents/subagent.py`
   - Parent agent spawns up to 5 subagents
   - Subagent gets scoped context from parent

4. **Quality Gates** — `runtime/quality/gates.py`
   - Every parallel branch passes same acceptance criteria
   - Merge validation before promoting to global store

5. **End-to-End Test** — full session from user objective to completed todos

---

## Execution Order Summary

```
Phase 0: Rename + Bootstrap
    ↓
Phase 1: CTO Skill + Meeting Room (Priority A)
    ↓
Phase 2: Orchestrator Skeleton (Priority B)
    ↓
Phase 3: Todo Registry (Priority C)
    ↓
Phase 4: Meta-Loops (Priority D)
    ↓
Phase 5: Team Execution
```

Each phase produces a **verifiable artifact**. No phase starts until the previous phase passes its smoke test.

---

## Current State

| Phase | Status | Next Action |
|-------|--------|-------------|
| 0 | Completed | Bootstrap verified |
| 1 | Completed | CTO skill + meeting room smoke tested |
| 2 | Completed | Orchestrator skeleton + MCP stubs verified |
| 3 | Completed | Registry + dedup + integration tests passing |
| 4 | Completed | Loop A/B implemented and verified |
| 5 | Completed | Team roster, agent runner, quality gates verified |
| 6 | Completed | Test suite + Loop A/B wiring + real MCP tools verified |

---

## Phase 7: Production Hardening & Observability

**Status:** Completed
**Goal:** add metrics, retries, structured logging, and production wiring for Hermes/systemd.

### Tickets
1. **Observability Counters** — `runtime/observability/counters.py`
   - Track sessions started, todos created, loop B hints injected, loop A promotions
   - Expose via `glideloop_status`

2. **Retry Budgets** — `runtime/agents/runner.py`
   - Configurable retry count + backoff for transient subprocess failures
   - Surface retry count in agent NOTES.md

3. **Structured Logging** — `runtime/logging.py`
   - JSON logs for all MCP tool calls, session transitions, loop interventions
   - Rotate daily, keep 7 days

4. **Systemd Timer** — `~/.config/systemd/user/glideloop-loop-a.{service,timer}`
   - Weekly trigger for Loop A observer/validator/promoter
   - Logs to journal with `StandardOutput=journal`

5. **Smoke Test** — verify `glideloop_status` returns counters, verify timer unit syntax

---

## Phase 6: Real MCP Toolchain, Tests, and Loop Wiring

**Goal:** replace MCP stubs with real behavior, add canonical tests, and wire Loop A/B into the session lifecycle.

### Tickets
1. **Real MCP Tools** — `runtime/mcp/server.py`
   - `glideloop_run` creates a session and seeds todos
   - `glideloop_todos` lists/creates via registry
   - `glideloop_stop` stops active session process
   - `glideloop_meeting` runs meeting room roles
   - `glideloop_quality` runs quality gates

2. **Test Suite** — `tests/`
   - `tests/test_teams.py`
   - `tests/test_runner.py`
   - `tests/test_registry.py`
   - `tests/test_loop_a.py`
   - `tests/test_loop_b.py`
   - `tests/test_mcp_server.py`

3. **Loop Wiring**
   - Loop B monitor hooks into agent lifecycle after each turn
   - Loop A weekly trigger via `omniforge` / systemd timer
   - Both loops write to shared event stream under `runtime/meta/`

4. **Smoke Test** — end-to-end from objective to completed todos with real MCP tool calls

### Success Criteria
- `pytest` passes with >20 tests
- `glideloop_run` creates todos in SQLite
- Loop B injects hint for stuck agent within 1 scan
- Loop A promotes candidate without regression

---

*This roadmap is locked. Phases are executed in order. No skipping.*
