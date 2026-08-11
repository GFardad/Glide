# Glide — Technical Specification (TypeScript)

## Stack

- Language: TypeScript (strict mode)
- Runtime: Node.js 20+ (primary), Bun compatibility target
- Package manager: pnpm workspaces
- State: SQLite (`better-sqlite3`) + JSONL event stream
- MCP: stdio JSON-RPC, manual implementation for full control
- Testing: Vitest
- Lint/Format: ESLint + Prettier
- Build: tsc + esbuild for binaries

## Monorepo Structure

```
~/Projects/Glide/
├── packages/
│   ├── core/                 # Types, interfaces, errors, utilities
│   ├── mcp/                  # MCP server + tool contracts
│   ├── runtime/              # Agent runtime, session manager
│   ├── meeting-room/         # Headroom logic, role prompts
│   ├── governor/             # Permission/MCP access control
│   ├── trace/                # glide_indepth, glide_trace
│   └── cli/                  # CLI entrypoint
├── skills/                   # Hermes skills (TS/JS)
├── docs/
├── Plan/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
└── README.md
```

## Core Type Contracts (v1)

```ts
// packages/core/src/types.ts
export interface AgentId {
  readonly id: string;
}
export interface SessionId {
  readonly id: string;
}
export interface ToolName {
  readonly name: string;
}

export interface AgentContext {
  agentId: AgentId;
  parentId?: AgentId;
  role: string;
  objective: string;
  personalityPath: string;
  goalPath: string;
  notesPath: string;
  todoPath: string;
  rejectedPath: string;
  sessionPath: string;
  tokenBudget: number;
  allowedMcp: string[];
}

export interface ToolCall<T = unknown> {
  name: ToolName;
  arguments: Record<string, unknown>;
  accessLevel: "cto" | "agent";
}

export interface MeetingRoomOutput {
  riskLog: string[];
  architecture: string[];
  todoRegistry: TodoItem[];
  driftScore: number;
  decision: "approved" | "revise" | "rejected";
}

export interface TodoItem {
  id: string;
  title: string;
  owner: AgentId;
  status: "pending" | "in_progress" | "done" | "rejected";
  priority: number;
}
```

## MCP Tool Registry Pattern

```ts
// packages/mcp/src/tools/registry.ts
export const TOOLS = {
  glide_status: { accessLevel: "cto" | "agent", schema: z.object({}) },
  glide_headroom: {
    accessLevel: "cto",
    schema: z.object({ objective: z.string() }),
  },
  glide_indepth: {
    accessLevel: "agent",
    schema: z.object({ agentId: z.string() }),
  },
  // ...
} as const;
```

## Plugin Manifest

```json
{
  "name": "glide-plugin-opencode",
  "version": "1.0.0",
  "entry": "./dist/index.js",
  "capabilities": ["shell", "file-read", "file-write"],
  "allowedRoles": ["engineer", "devops"],
  "tokenCost": "low"
}
```

## Quality Gates

- `tsc --noEmit` passes on every package
- `vitest run` passes on every PR
- `eslint --max-warnings 0`
- `prettier --check .`
- MCP contract tests: every tool has schema test + happy-path test
- E2E test: Layer 0 → Headroom → Plan → Build → Test → Ship with mock agents
