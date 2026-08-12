# Glide MCP API

The Glide control plane is an [MCP](https://modelcontextprotocol.io) stdio server
(`packages/mcp-server`) exposing 17 tools. Each tool returns a JSON string inside
`content[0].text`; failures return `isError: true` with an `error` code.

## Tools

### `glide_status`

Get overall Glide system status.

- Input: `{}`
- Output: `{ ok, tool, packages, plugins, version }`

### `glide_goal_set`

Set the primary goal for a Glide campaign.

- Input: `{ campaign_dir: string, goal: string }`
- Output: `{ ok, tool, path, goal }`

### `glide_goal_get`

Read the current goal of a campaign.

- Input: `{ campaign_dir: string }`
- Output: `{ ok, tool, goal }`

### `glide_headroom`

Run a Headroom meeting with the CTO and specialist agents (Architect, Engineer,
Security, QA, Product). **Approval gate:** rejects with `error: "approval_gate"` and
`missing_artifacts` unless `GOAL.md`, `NON_GOALS.md`, and `ASSUMPTIONS.md` exist in
the campaign dir.

- Input: `{ campaign_dir: string, objective: string, roles?: string[] }`
- Output: `{ ok, tool, campaign, artifacts: { risk_log, architecture, todo_registry,
role_analysis }, drift_detected, role_signals }`

### `glide_executor`

Execute agent-runtime operations against a workspace.

- Input: `{ workspace: string, agent_id: string, action: "ensure_contract" |
"append_note" | "mark_todo_done" | "record_rejection" | "list_agents",
payload?: object }`
- Output: `{ ok, tool, action, agent_id, ... }`

### `glide_tracer`

Trace or generate indepth markdown for a Glide agent.

- Input: `{ action: "trace" | "indepth", workspace: string, agent_id: string }`
- Output: `{ ok, tool, agent_id, path?, trace? }`

### `glide_permissions`

Check whether a subject is authorized for an action on a resource.

- Input: `{ action: string, resource: string, subject_id: string, subject_role: string }`
- Output: `{ subject_id, ok, allowed?, reason? }`

### `glide_indepth`

Dump a single agent's full context (goal, notes, todos, rejected) to
`<workspace>/runtime/workspace/indepth/<agent_id>.md`.

- Input: `{ workspace: string, agent_id: string, output_dir?: string }`
- Output: `{ ok, tool, agent_id, path }`

### `glide_trace`

Trace an agent chain upward toward Headroom.

- Input: `{ workspace: string, agent_id: string, file_path?: string, line?: number }`
- Output: `{ ok, tool, agent_id, file_path?, line?, trace: { goal, notes, todos,
children, chain } }`

### `glide_plan`

Build the Epic → Team → Agent program tree from headroom artifacts and write the
structured plan artifact.

- Input: `{ campaign_dir: string, epic?: string, summary?: string, teams?: string[],
agents?: string[] }`
- Output: `{ ok, tool, path, epic, tree, summary }` where `summary` is the
  parent-only view (teams/agents see summaries, not full task bodies).

### `glide_build`

Record a build artifact for a campaign.

- Input: `{ campaign_dir: string, status: "success" | "failed", detail?: string }`
- Output: `{ ok, tool, path }`

### `glide_test`

Record a test artifact for a campaign.

- Input: `{ campaign_dir: string, status: "success" | "failed", detail?: string }`
- Output: `{ ok, tool, path }`

### `glide_review`

Record a review artifact for a campaign.

- Input: `{ campaign_dir: string, status: "success" | "failed", detail?: string }`
- Output: `{ ok, tool, path }`
### `glide_ship`

Record a ship artifact for a campaign.
- Input: `{ campaign_dir: string, status: "success" | "failed", detail?: string }`
- Output: `{ ok, tool, path }`

### `glide_converge`

Run converge analysis across a campaign.
- Input: `{ campaign_dir: string }`
- Output: `{ ok, tool, path, converged }`

### `glide_gates`

Run the configured quality gates against a workspace.
- Input: `{ workspace: string, gates?: string[] }`
- Output: `{ ok, tool, report: { passed, results } }`

### `glide_graph`

Query the Graphify knowledge graph for trace/program context.
- Input: `{ action: "read" | "query" | "shortestPath" | "community" | "nodeDetails" | "prImpact", ... }`
- Output: `{ ok, tool, ... }` — graph payload varies by action.

## Program-management flow

1. `glide_goal_set` — establish the campaign goal.
2. Write `GOAL.md`, `NON_GOALS.md`, `ASSUMPTIONS.md` (approval gate).
3. `glide_headroom` — role analysis → artifacts.
4. `glide_plan` — Epic → Team → Agent tree with parent-only summaries.
5. `glide_executor` / `glide_tracer` / `glide_indepth` / `glide_trace` — execute and trace.
6. `glide_build` / `glide_test` / `glide_review` / `glide_ship` — record outcomes.
7. Dashboard (`packages/dashboard`) visualizes campaign/session/task state.

## Error handling

Tools return `{ content: [{ type: "text", text: '<json>' }], isError?: true }`.
Error codes: `approval_gate`, `missing_fields`, `campaign_not_found`,
`unknown_action`, `load_failed`, `INVALID_MANIFEST`, `DUPLICATE_ID`, `NOT_FOUND`.
