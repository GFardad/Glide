/** Unique identifier for an agent instance. */
export type AgentId = string;
/** Unique identifier for a session. */
export type SessionId = string;
/** Unique identifier for a campaign. */
export type CampaignId = string;
/** Unique identifier for a team. */
export type TeamId = string;
/** Persistent campaign metadata used across execution artifacts. */
export interface Campaign {
    /** Stable identifier for the campaign. */
    id: CampaignId;
    /** Root directory containing campaign artifacts. */
    root: string;
    /** High-level objective the campaign is trying to achieve. */
    goal: string;
    /** Explicitly excluded objectives to keep scope bounded. */
    nonGoals: string[];
    /** Assumptions the campaign depends on. */
    assumptions: string[];
    /** Timestamp when the campaign was created. */
    createdAt: Date;
    /** Timestamp of the most recent campaign update. */
    updatedAt: Date;
}
/** Execution context describing an agent's current state and constraints. */
export interface Agent {
    /** Unique agent identifier. */
    id: AgentId;
    /** Logical role assigned to the agent. */
    role: string;
    /** Identifier of the parent agent, if any. */
    parentId: AgentId | null;
    /** Session identifier for the agent's current run. */
    sessionId: SessionId;
    /** Personality or behavioral prompt for the agent. */
    personality: string;
    /** Goal assigned to the agent. */
    goal: string;
    /** Freeform notes captured during execution. */
    notes: string[];
    /** Outstanding work items for the agent. */
    todos: string[];
    /** Proposals the agent has rejected. */
    rejected: string[];
    /** Capabilities granted to the agent. */
    permissions: string[];
}
/** Structured artifact produced during campaign execution. */
export interface Artifact {
    /** Artifact kind for storage and rendering. */
    type: "risk_log" | "architecture" | "todo_registry" | "plan" | "code" | "test" | "review" | "ship";
    /** Relative path within the campaign artifacts directory. */
    path: string;
    /** Serialized artifact contents. */
    content: string;
    /** Agent that produced the artifact, if any. */
    agentId: AgentId | null;
    /** Timestamp when the artifact was created. */
    createdAt: Date;
}
//# sourceMappingURL=index.d.ts.map