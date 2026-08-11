# @glide/tracer

Agent state tracing and indepth context generation.

## Public API

- `traceAgent(workspace, agentId)` — walk an agent's contract upward: goal, notes, todos, children, chain to Headroom
- `indepthAgent({ workspace, agentId })` — full-context markdown dump (personality, goal, notes, todos, rejected)
- `TraceResult` / `IndepthResult` types

## Usage

```ts
import { traceAgent, indepthAgent } from "@glide/tracer";

const trace = traceAgent(ws, "a1"); // chain + notes + todos
const md = indepthAgent({ workspace: ws, agentId: "a1" }); // full dump
```
