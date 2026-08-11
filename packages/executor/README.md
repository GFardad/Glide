# @glide/executor

Agent execution runtime: file contracts and the program tree.

## Public API

### Agent file contract (`runtime.ts`)

- `ensureAgentContract(workspace, agent)` — creates `agents/<id>/{PERSONALITY,GOAL,NOTES,TODO,REJECTED}.md`
- `loadAgentContract(workspace, agentId)` — read the five files
- `appendNote / markTodoDone / recordRejection / listAgents / cleanupAgentWorkspace`

### Contract validation (`contract.ts`)

- `validateAgentContract(workspace, agentId)` — presence + content checks for the five required files
- `REQUIRED_AGENT_FILES` — canonical file list

### Program management (`program.ts`)

- `buildProgramTree({ campaignDir, epic, teams?, agents? })` — read headroom artifacts, decompose into Epic → Team → Agent tree with deterministic `parentId`/`teamId` links
- `summarizeProgram(epic)` — **parent-only summary**: epic sees team summaries only, teams see agent summaries only; task bodies exist only in the full tree
- `renderProgramMarkdown(tree)` — structured plan artifact markdown

## Usage

```ts
import {
  ensureAgentContract,
  buildProgramTree,
  summarizeProgram,
} from "@glide/executor";

ensureAgentContract(ws, { sessionId: "s1", agentId: "a1", cwd: ws });
const tree = buildProgramTree({ campaignDir: "/tmp/c", epic: "login" });
const summary = summarizeProgram(tree.epic); // no task bodies leak
```
