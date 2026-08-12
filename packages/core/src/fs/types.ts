export interface AgentContext {
  agentId: string;
  sessionId: string;
  cwd: string;
  teamId?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentFileContract {
  agentId: string;
  teamId?: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDirectory {
  path: string;
  files: {
    personality: string;
    goal: string;
    notes: string;
    todos: string;
    rejected: string;
    contract: string;
  };
}
