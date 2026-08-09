# GlideLoop MCP CEO/CTO Harness — Tool Surface + Migration Plan

## Concept
On-demand CEO/CTO agent harness exposed as MCP tools. Any Hermes session calls them. No daemons, no systemd, no infinite loops. Agents spawn, do work, exit. State in `runtime/state/`.

---

## MCP Tool Surface

### CEO Layer (strategic)
```
ceo_directive(objective: str, constraints: list[str] = []) -> dict
  - Decomposes objective into phases via meeting room
  - Returns: phases, risks, acceptance criteria, assigned CTO brief

ceo_meeting(participants: list[str], agenda: str) -> dict
  - Runs meeting room with PersonalityAgents (CEO, CTO, Architect, QA)
  - Returns: minutes, decisions, action items, owner mapping

ceo_review(artifact_path: str, review_type: str) -> dict
  - Reviews code/plan/doc via CEO lens
  - Returns: verdict (approve/revise/reject), rationale, required changes
```

### CTO Layer (tactical/execution)
```
cto_brief(phase: str, ceo_directive: dict) -> dict
  - Translates CEO phase into technical brief
  - Returns: tech stack, task breakdown, team structure, effort estimate

cto_team(team_size: int, skills: list[str]) -> dict
  - Spins up agent team with assigned roles
  - Returns: team_id, agent_ids, task assignments, communication protocol

cto_assign(team_id: str, tasks: list[dict]) -> dict
  - Distributes tasks to team agents via worker queue
  - Returns: assignment map, priorities, dependencies

cto_coordinate(team_id: str) -> dict
  - Syncs team progress, resolves blockers, rebalances load
  - Returns: status per agent, blockers, next actions
```

### Execution Layer (worker/agent)
```
agent_spawn(role: str, task: dict, context: dict = {}) -> dict
  - Spawns single agent session via Hermes MCP bridge
  - Returns: session_id, agent_id, status

agent_result(session_id: str) -> dict
  - Polls/returns agent output
  - Returns: stdout, artifacts, exit status

batch_run(tasks: list[dict], parallelism: int = 3) -> dict
  - Fan-out: runs N tasks in parallel via agent_spawn
  - Returns: results per task, failures, aggregate status
```

### Observability Layer
```
harness_status() -> dict
  - Returns: active agents, queued tasks, completed cycles, errors

harness_stop(team_id: str = None) -> dict
  - Graceful shutdown of specific team or all agents
  - Returns: stopped agents, cleanup status
```

---

## Agent Architecture

```
Hermes Session (caller)
    │
    ▼
[CEO Agent] ──meeting_room──► [CTO Agent]
    │                           │
    │                           ▼
    │                    [Team Agents] (N×)
    │                           │
    └──────── worker queue ◄──┘
         (task distribution)
```

**Roles:**
- **CEO** — `meeting_room` facilitator, objective decomposition, review authority
- **CTO** — technical brief generation, team formation, execution coordination
- **Team Agents** — individual executors (coder, reviewer, tester, etc.)

**Communication:**
- CEO ↔ CTO via `ceo_execute` / `meeting_room` (existing GlideLoop public APIs)
- CTO → Team via worker queue + `glideloop_run` MCP tool
- All artifacts in `runtime/workspace/agents/<agent_id>/`

---

## Migration Plan

### Phase 1: Tool Registry (no daemons)
1. Add tool schemas to `runtime/mcp/server.py` for all tools above
2. Implement handlers that call existing GlideLoop public interfaces:
   - `ceo_directive` → `meeting_room` + `ceo_execute`
   - `cto_team` → `runtime/worker.py` queue + `glideloop_run`
   - `agent_spawn` → Hermes `delegate_task` or subprocess wrapper
3. Disable systemd services: `glideloop-ceo-daemon`, `self-improvement-loop`, `horizon-supervisor`
4. Verify: `harness_status` returns 0 agents, 0 tasks (clean state)

### Phase 2: On-Demand Execution
1. Replace daemon loops with explicit tool calls from Hermes cron/sessions:
   - `cronjob` every 30m → calls `ceo_directive` + `cto_brief`
   - Watchdog → calls `batch_run` with stale session recovery tasks
2. State management: `runtime/state/harness.json` tracks active agents/teams
3. Logging: `runtime/state/logs/harness.jsonl` replaces daemon logs

### Phase 3: CEO/CTO Personality Hardening
1. Meeting room prompts tuned for CEO/CTO roles
2. CTO task decomposition validated against `tests/test_execution_backends.py`
3. `HermesMCPBackend` (already in `runtime/execution/backends.py`) used as default spawn path

### Phase 4: Observability + Self-Improvement
1. MCP middleware counts tool calls per agent role
2. `harness_status` surfaces trends: agent efficiency, task completion rate, CEO directive acceptance
3. Loop B (`runtime/meta/loop_b/`) monitors harness health via existing MCP tools

---

## File Changes

| File | Action |
|------|--------|
| `runtime/mcp/server.py` | Add 11 tool schemas + handlers |
| `runtime/harness/ceo.py` | New: CEO agent logic (meeting room wrapper) |
| `runtime/harness/cto.py` | New: CTO agent logic (team/task orchestration) |
| `runtime/harness/spawner.py` | New: `agent_spawn` via Hermes MCP bridge |
| `runtime/state/harness.json` | New: active agent/team state |
| `runtime/state/logs/harness.jsonl` | New: structured event log |
| `~/.config/systemd/user/glideloop-ceo-daemon.service` | Disable/remove |
| `~/.config/systemd/user/self-improvement-loop.service` | Disable/remove |
| `~/.config/systemd/user/horizon-supervisor.service` | Disable/remove |
| `.hermes/cron/` | Update cron jobs to call MCP tools instead of scripts |

---

## Verification
- `pytest` suite passes (currently 201)
- `systemctl --user list-units` shows no glideloop/horizon/self-improvement services
- `harness_status` returns clean state
- Manual probe: `ceo_directive` → `cto_brief` → `batch_run` → `harness_status` full cycle
