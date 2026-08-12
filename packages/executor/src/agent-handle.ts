import type { AgentStatus } from "./agent-status.js";
import type { AgentMessage } from "./agent-message.js";

export interface AgentHandle {
  /** Unique identifier for this agent execution. */
  id: string;
  /** ID of the parent handle that spawned this agent, if any. */
  parentId?: string | undefined;
  /** Session identifier this handle belongs to, if any. */
  sessionId?: string | undefined;
  /** Current lifecycle status. */
  status: AgentStatus;
  /** ISO-8601 timestamp when the agent was spawned. */
  createdAt: string;
  /** ISO-8601 timestamp when the agent reached a terminal status, if any. */
  completedAt?: string | undefined;
  /** Optional filesystem path used as an IPC message pipe. */
  ipcPath?: string | undefined;
  /** Live stream of messages emitted by the child agent. */
  messages: AgentMessage[];
  /** Exit code of the child process when status is terminal. */
  returnCode?: number | null;
  /** Trace ID for correlation across events. */
  traceId?: string | undefined;
  /** Span ID for this agent execution. */
  spanId?: string | undefined;
}
