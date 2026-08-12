# Glide MCP Tool Interface Specification

## Status
Proposed — exact tool surface for the external Glide MCP server.

## Principle
Hermes talks to Glide through **one MCP stdio server**. The MCP server is the only entrypoint. All Glide internals (process spawning, state, routing) are hidden behind this interface.

---

## 1. Server Configuration

```yaml
# ~/.hermes/config.yaml
mcp_servers:
  glide:
    command: /home/gfardad/.glide/venv/bin/python
    args:
      - /home/gfardad/.glide/mcp/server.py
    env:
      GLIDE_STATE_DIR: /home/gfardad/.glide/state
      GLIDE_RUNTIME_DIR: /media/Storage/home-gfardad/projects/glide/runtime
      GLIDE_LOG_LEVEL: INFO
    enabled: true
    connect_timeout: 120
```

**Security:**
- Hermes never directly accesses agent processes or state files
- All paths are resolved inside the MCP server
- Environment variables are injected by the MCP server, not inherited from Hermes

---

## 2. Tools

### 2.1 `glide_status`
**Purpose:** Quick health check and active session inventory.

**Input:**
```json
{}
```

**Output:**
```json
{
  "status": "healthy | degraded | down",
  "active_sessions": 3,
  "active_agents": 47,
  "uptime_seconds": 86400,
  "version": "0.1.0",
  "sessions": [
    {
      "session_id": "abc123",
      "objective": "Build auth module",
      "status": "running | paused | completed | failed",
      "teams_active": 4,
      "agents_active": 18,
      "started_at": "2026-08-05T00:00:00Z"
    }
  ]
}
```

---

### 2.2 `glide_run`
**Purpose:** Start a new Glide session for a user objective.

**Input:**
```json
{
  "objective": "Build a REST auth module with JWT",
  "context": "Existing API uses FastAPI. Must support mobile clients.",
  "priority": "P0",
  "max_teams": 5,
  "max_parallel_agents": 20,
  "approval_policy": "hybrid"
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "status": "started",
  "meeting_room": {
    "status": "in_progress",
    "current_round": 1,
    "total_rounds_expected": 3
  },
  "artifacts": {
    "plan": "/glide/sessions/abc123/artifacts/plan.md",
    "architecture": "/glide/sessions/abc123/artifacts/architecture.md",
    "todos": "/glide/sessions/abc123/artifacts/todos.json"
  }
}
```

**Behavior:**
1. Creates session directory with isolated state
2. Spawns CTO Assistant + Meeting Room agents
3. Runs meeting rounds until consensus or CTO intervention
4. On approval, spawns Orchestrator + Teams
5. Returns immediately with session_id for polling

---

### 2.3 `glide_session_status`
**Purpose:** Detailed status for a specific session.

**Input:**
```json
{
  "session_id": "abc123"
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "objective": "Build a REST auth module with JWT",
  "status": "running | paused | completed | failed",
  "phase": "meeting | execution | review | completed",
  "progress": {
    "meeting_round": 2,
    "teams_active": 3,
    "todos_completed": 12,
    "todos_total": 25
  },
  "agents": [
    {
      "agent_id": "eng-042",
      "role": "Engineer",
      "team": "Engineering",
      "status": "active | stuck | idle | completed",
      "current_todo": "Implement JWT endpoint",
      "last_active": "2026-08-05T00:15:00Z"
    }
  ],
  "logs_url": "glide://logs/abc123"
}
```

---

### 2.4 `glide_stop`
**Purpose:** Stop a running session gracefully.

**Input:**
```json
{
  "session_id": "abc123",
  "reason": "User cancelled",
  "preserve_state": true
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "status": "stopped",
  "agents_killed": 18,
  "state_preserved": true
}
```

**Behavior:**
- Sends SIGTERM to all agents in session process group
- Waits up to 30s for graceful shutdown
- SIGKILL if still alive
- Archives session state if `preserve_state=true`

---

### 2.5 `glide_brain`
**Purpose:** Retrieve the "brain" of a session — all planning artifacts, meeting minutes, and decisions.

**Input:**
```json
{
  "session_id": "abc123",
  "artifact": "plan | architecture | minutes | todos | all"
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "plan": "# Plan: ...\n...",
  "architecture": "# Architecture: ...\n...",
  "minutes": "# Meeting Minutes: ...\n...",
  "todos": [
    {
      "id": "todo-001",
      "text": "Implement JWT endpoint",
      "status": "in_progress",
      "assignee": "eng-042"
    }
  ]
}
```

---

### 2.6 `glide_agent_artifacts`
**Purpose:** Read an agent's persistent files.

**Input:**
```json
{
  "session_id": "abc123",
  "agent_id": "eng-042",
  "files": ["PERSONALITY.md", "GOAL.md", "TODO.md", "NOTES.md", "REJECTED.md"]
}
```

**Output:**
```json
{
  "agent_id": "eng-042",
  "files": {
    "PERSONALITY.md": "# Role: Engineer\n...",
    "GOAL.md": "# Goal: ...\n...",
    "TODO.md": "# Todo List\n...",
    "NOTES.md": "# Notes\n...",
    "REJECTED.md": "# Rejected Items\n..."
  }
}
```

---

### 2.7 `glide_stream_logs`
**Purpose:** Bounded log tail for an agent or session.

**Input:**
```json
{
  "session_id": "abc123",
  "agent_id": "eng-042",
  "tail": 50,
  "since": "2026-08-05T00:10:00Z"
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "agent_id": "eng-042",
  "logs": [
    {"timestamp": "2026-08-05T00:12:00Z", "level": "INFO", "message": "..."},
    {"timestamp": "2026-08-05T00:12:05Z", "level": "DEBUG", "message": "..."}
  ],
  "cursor": "2026-08-05T00:12:05Z"
}
```

**Rules:**
- Max 200 lines per call
- Returns cursor for next call
- If no new logs since cursor, returns empty array + same cursor

---

### 2.8 `glide_list_teams`
**Purpose:** List available teams and their activation status.

**Input:**
```json
{}
```

**Output:**
```json
{
  "teams": [
    {
      "team_id": "engineering",
      "name": "Engineering",
      "description": "Implementation, refactoring, bug fixes",
      "active": true,
      "current_agents": 5,
      "max_agents": 5
    }
  ]
}
```

---

### 2.9 `glide_approve_plan`
**Purpose:** User/CTO approves a meeting room plan.

**Input:**
```json
{
  "session_id": "abc123",
  "approved": true,
  "modifications": "Add QA review gate before deployment",
  "approver": "user | cto"
}
```

**Output:**
```json
{
  "session_id": "abc123",
  "status": "approved",
  "phase": "execution",
  "modifications_applied": true
}
```

**Behavior:**
- If `approved=true`: plan is locked, Orchestrator spawns teams
- If `approved=false`: meeting room returns to revision phase
- `modifications` are injected as new todos for CTO Assistant to reconcile

---

### 2.10 `glide_meta_status`
**Purpose:** Status of the two self-improvement loops.

**Input:**
```json
{}
```

**Output:**
```json
{
  "loop_a": {
    "last_run": "2026-08-04T00:00:00Z",
    "next_run": "2026-08-11T00:00:00Z",
    "pending_candidates": 3,
    "last_promotion": "2026-07-28T00:00:00Z"
  },
  "loop_b": {
    "last_run": "2026-08-05T00:00:00Z",
    "next_run": "2026-08-05T00:15:00Z",
    "interventions_today": 7,
    "patterns_learned": 12
  }
}
```

---

## 3. Resources

### 3.1 `glide://agents/<agent_id>/artifacts/<file>`
Read an agent's file. Files: `PERSONALITY.md`, `GOAL.md`, `NOTES.md`, `TODO.md`, `REJECTED.md`.

### 3.2 `glide://logs/<session_id>/<agent_id>`
Bounded log segments. Use `tail` and `since` query params.

### 3.3 `glide://sessions/<session_id>/state`
Session-scoped state JSON.

### 3.4 `glide://meeting/<session_id>/minutes`
Meeting minutes for a session.

---

## 4. Error Handling

| Error | Code | Meaning |
|-------|------|---------|
| `SESSION_NOT_FOUND` | 404 | Session ID does not exist |
| `AGENT_NOT_FOUND` | 404 | Agent ID does not exist in session |
| `SESSION_ALREADY_RUNNING` | 409 | Cannot start duplicate session |
| `APPROVAL_REQUIRED` | 412 | Plan requires CTO/user approval before execution |
| `LOOP_B_DISABLED` | 423 | Loop B is disabled for this session |
| `INTERNAL_ERROR` | 500 | MCP server error; check logs |

---

## 5. Rate Limits

| Tool | Limit | Window |
|------|-------|--------|
| `glide_stream_logs` | 60 calls | 1 minute |
| `glide_agent_artifacts` | 120 calls | 1 minute |
| All other tools | 30 calls | 1 minute |

---

## 6. Validation

```bash
# Syntax check
python3 -m py_compile /home/gfardad/.glide/mcp/server.py

# Tool smoke test
hermes mcp test glide --tool glide_status

# List registered tools
hermes mcp list
```

---

*This spec is locked. All future MCP implementations must conform to this interface.*
