export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool" | "error";
  content: string;
  timestamp: string;
  metadata?: Record<string, string> | undefined;
}
