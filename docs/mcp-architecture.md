# Glide MCP Architecture (Best-Practices Refinement)

## Status
Proposed — refined based on research findings.

## Topology
- **External harness** lives outside `~/.hermes/` (e.g., `~/.glide/`)
- Hermes talks to Glide only via **one MCP stdio server**
- Glide manages external agent processes itself; it does **not** shell out to `hermes delegate_task` from the MCP server

## MCP Server Surface

### Tools
| Tool | Purpose | Bounds |
|------|---------|--------|
| `start_agent(agent_id, command, cwd, env, isolation_profile)` | Spawn external agent | cwd scoped, env allowlist |
| `stop_agent(agent_id)` | Graceful stop | Process group kill |
| `agent_status(agent_id)` | Current state | PID, status, uptime |
| `stream_agent_logs(agent_id, tail, since)` | Bounded log tail | Max 200 lines, cursor-based |
| `list_agents()` | Inventory | Active + recently stopped |
| `run_agent_job(agent_id, job_spec)` | Execute task | Timeout, resource limits |
| `agent_artifacts(agent_id)` | Read agent files | GOAL.md, TODO.md, NOTES.md, REJECTED.md |

### Resources
- `glide://agents/<agent_id>/artifacts/<file>` — read agent files
- `glide://logs/<agent_id>/<date>` — bounded log segments
- `glide://sessions/<session_id>/state` — session-scoped state

## Process Spawning Best Practices
- Use `subprocess.Popen` with:
  - `cwd` scoped to agent workspace
  - `env` restricted to allowlist
  - process group or `setpgrp` for easier kill
  - stdout/stderr piped to ring buffers or files
- Maintain an in-memory registry plus on-disk manifest for PID, status, ports, and paths

## State Persistence
- Store state in a **durable SQLite DB** under `~/.glide/state/glide.sqlite`
- Tables: `agents`, `jobs`, `events`
- Use `INSERT OR REPLACE`, WAL mode, and bounded busy timeout

## Streaming Best Practices
- MCP tools return structured results, but streaming is best delivered through **polling tools + bounded payloads**
- `stream_agent_logs` returns up to N lines and a cursor/timestamp
- For richer event streams, add **server-sent event style resources** or write logs to files and expose `read_resource` URIs
- Keep each response bounded; never return full unbounded logs in one tool call

## Security/Isolation Best Practices
- Run each agent in a **dedicated working directory** and restricted env
- Use Linux namespaces only if truly needed; otherwise rely on:
  - `cwd` confinement
  - env allowlist
  - file permission scoping
  - separate process groups for signal delivery
- Do not let Glide inherit arbitrary Hermes env vars; inject only required values explicitly
- Consider adding per-agent `timeout` and `max_memory` guard via `resource` limits if available

## Hermes Wiring
```yaml
mcp_servers:
  glide:
    command: /home/gfardad/.glide/venv/bin/python
    args:
      - /home/gfardad/.glide/mcp/server.py
    enabled: true
    connect_timeout: 120
```

## Validation
```bash
python3 -m py_compile /home/gfardad/.glide/mcp/server.py
hermes mcp test glide
hermes mcp list
```
