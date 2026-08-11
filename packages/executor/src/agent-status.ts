export const AgentStatus = {
  Pending: "pending",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];
