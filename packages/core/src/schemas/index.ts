import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Core domain types                                                  */
/* ------------------------------------------------------------------ */

export const PrincipleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  immutable: z.boolean(),
  rationale: z.string().optional(),
});

export const ConstitutionAmendmentStatusEnum = z.enum([
  "proposed",
  "review",
  "ratified",
  "rejected",
  "superseded",
]);

export const ConstitutionAmendmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  targetPrincipleIds: z.array(z.string().min(1)),
  proposedChanges: z.array(z.string().min(1)),
  status: ConstitutionAmendmentStatusEnum,
  proposedBy: z.string().min(1),
  proposedAt: z.string().datetime(),
  reviewNotes: z.string().optional(),
  backwardsCompatibility: z
    .object({
      compatible: z.boolean(),
      breakingChanges: z.array(z.string()),
      migrationPath: z.string().optional(),
    })
    .optional(),
});

export const ConstitutionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  principles: z.array(PrincipleSchema),
  amendments: z.array(ConstitutionAmendmentSchema),
  owner: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CampaignSchema = z.object({
  id: z.string().refine((v) => /^campaign_[A-Za-z0-9]{22}$/.test(v), {
    message: "Campaign ID must match pattern campaign_<22 chars>",
  }),
  root: z.string().min(1),
  goal: z.string().min(1),
  nonGoals: z.array(z.string()),
  assumptions: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GoalStatusEnum = z.enum([
  "active",
  "scheduled",
  "completed",
  "abandoned",
]);

export const GoalRecordSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().optional(),
  goal: z.string().min(1),
  status: GoalStatusEnum,
  source: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentContextSchema = z.object({
  sessionId: z.string().refine((v) => /^session_[A-Za-z0-9_-]{22}$/.test(v), {
    message: "Session ID must match pattern session_<22 chars>",
  }),
  agentId: z.string().refine((v) => /^agent_[A-Za-z0-9_-]{22}$/.test(v), {
    message: "Agent ID must match pattern agent_<22 chars>",
  }),
  cwd: z.string().min(1),
  teamId: z.string().optional(),
  parentId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const ToolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.unknown()),
  accessLevel: z.enum(["cto", "agent"]).default("agent"),
});

export const TodoItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().refine((v) => /^agent_[A-Za-z0-9_-]{22}$/.test(v), {
    message: "Todo owner must be a valid agent ID",
  }),
  status: z.enum(["pending", "in_progress", "done", "rejected"]).default("pending"),
  priority: z.number().int().nonnegative().default(0),
});

/* ------------------------------------------------------------------ */
/*  Headroom types                                                      */
/* ------------------------------------------------------------------ */

export const GapKindEnum = z.enum(["missing", "incomplete", "divergent"]);

export const ConvergeGapSchema = z.object({
  kind: GapKindEnum,
  planItem: z.string().min(1),
  actual: z.string().optional(),
  detail: z.string().min(1),
  suggestion: z.string().min(1),
});

export const ConvergeReportSchema = z.object({
  generatedAt: z.string().min(1),
  planDir: z.string().min(1),
  totalGaps: z.number().int().nonnegative(),
  gapsByKind: z.object({
    missing: z.array(ConvergeGapSchema),
    incomplete: z.array(ConvergeGapSchema),
    divergent: z.array(ConvergeGapSchema),
  }),
  actionableTasks: z.array(z.string()),
});

export const HeadroomDeltaOperationKindEnum = z.enum(["add", "update", "delete"]);

export const HeadroomDeltaOperationSchema = z.object({
  kind: HeadroomDeltaOperationKindEnum,
  goalId: z.string().min(1),
  goal: z.string().optional(),
  previousGoal: z.string().optional(),
  campaignId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const HeadroomDeltaSchema = z.object({
  timestamp: z.string().min(1),
  evidence: z.string().min(1),
  operations: z.array(HeadroomDeltaOperationSchema),
});

export const GoalRecordSnapshotSchema = GoalRecordSchema.extend({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const HeadroomSnapshotSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  state: z.array(GoalRecordSnapshotSchema),
  deltaHistory: z.array(HeadroomDeltaSchema),
});

export const CodebaseInventorySchema = z.object({
  packages: z.array(z.string()),
  sourceFiles: z.array(z.string()),
  testFiles: z.array(z.string()),
  exportedSymbols: z.array(z.string()),
});

/* ------------------------------------------------------------------ */
/*  Executor types                                                     */
/* ------------------------------------------------------------------ */

export const AgentStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const AgentMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "error"]),
  content: z.string().min(1),
  timestamp: z.string().min(1),
  metadata: z.record(z.string()).optional(),
});

export const AgentHandleSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().optional(),
  sessionId: z.string().optional(),
  status: AgentStatusEnum,
  createdAt: z.string().min(1),
  completedAt: z.string().optional(),
  ipcPath: z.string().optional(),
  messages: z.array(AgentMessageSchema),
  returnCode: z.number().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});

export const SessionEventTypeEnum = z.enum([
  "session_created",
  "session_resumed",
  "session_event",
  "session_completed",
  "session_failed",
  "session_cancelled",
  "session_removed",
]);

export const SessionEventSchema = z.object({
  type: SessionEventTypeEnum,
  handle: z.string().min(1),
  sessionId: z.string().min(1),
  timestamp: z.string().min(1),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Plugin API types                                                   */
/* ------------------------------------------------------------------ */

export const PluginManifestPermissionsSchema = z.object({
  network: z.boolean().optional(),
  filesystem: z.boolean().optional(),
  env: z.boolean().optional(),
  shell: z.boolean().optional(),
});

export const PluginManifestResourceLimitsSchema = z.object({
  maxMemoryMb: z.number().int().positive().optional(),
  maxCpuPercent: z.number().positive().max(100).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const PluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().url().optional().or(z.literal("")),
  mcpEndpoint: z.string().url().optional().or(z.literal("")),
  kind: z.enum(["mcp", "agent-hook", "skill"]),
  sessionDurable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  entrypoint: z.object({
    module: z.string().min(1),
    exportName: z.string().min(1),
    stateSchema: z.record(z.unknown()).optional(),
  }),
  permissions: PluginManifestPermissionsSchema.optional(),
  resourceLimits: PluginManifestResourceLimitsSchema.optional(),
});

export const PluginDescriptorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  homepage: z.string().url().optional().or(z.literal("")),
  mcpEndpoint: z.string().url().optional().or(z.literal("")),
  kind: z.enum(["mcp", "agent-hook", "skill"]),
  sessionDurable: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  entrypoint: z.object({
    module: z.string().min(1),
    exportName: z.string().min(1),
    stateSchema: z.record(z.unknown()).optional(),
  }),
  manifest: z.any().optional(),
});

export const SessionDurabilityEventSchema = z.object({
  type: z.enum(["state_persisted", "state_restored", "state_removed", "state_cleared"]),
  pluginId: z.string().min(1),
  timestamp: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
});

export const SessionRecordSchema = z.object({
  handle: z.string().min(1),
  sessionId: z.string().min(1),
  campaignId: z.string().optional(),
  agentId: z.string().optional(),
  parentHandle: z.string().optional(),
  status: AgentStatusEnum,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  metadata: z.record(z.string()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Tracer types                                                       */
/* ------------------------------------------------------------------ */

export const TraceEventSchema = z.object({
  agentId: z.string().min(1),
  action: z.string().min(1),
  status: z.string().min(1),
  detail: z.string().optional(),
  _seq: z.number().int().nonnegative().optional(),
  _ts: z.string().optional(),
});

export const JsonlRecordSchema = z.object({
  _seq: z.number().int().nonnegative().optional(),
  _ts: z.string().optional(),
  id: z.string().optional(),
});

export const GraphifyNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  norm_label: z.string().min(1),
  file_type: z.string().optional(),
  source_file: z.string().optional(),
  source_location: z.string().optional(),
  community: z.number().optional(),
  community_name: z.string().optional(),
  _origin: z.string().optional(),
});

export const GraphifyLinkSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  relation: z.string().min(1),
  confidence: z.string().optional(),
  confidence_score: z.number().optional(),
  weight: z.number().optional(),
  source_file: z.string().optional(),
  source_location: z.string().optional(),
  _origin: z.string().optional(),
});

export const GraphifyDataSchema = z.object({
  directed: z.boolean().optional(),
  multigraph: z.boolean().optional(),
  nodes: z.array(GraphifyNodeSchema),
  links: z.array(GraphifyLinkSchema),
  hyperedges: z.array(z.unknown()).optional(),
});

/* ------------------------------------------------------------------ */
/*  Permissions types                                                  */
/* ------------------------------------------------------------------ */

export const PermissionRequestSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  action: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().optional(),
  decidedBy: z.string().optional(),
});

export const PermissionPolicySchema = z.object({
  allowedActions: z.array(z.string()),
  blockedActions: z.array(z.string()),
  requireApproval: z.array(z.string()),
});

export const CapabilityTokenPayloadSchema = z.object({
  iss: z.string().min(1),
  sub: z.string().min(1),
  scopes: z.array(z.string()),
  nbf: z.number(),
  exp: z.number(),
  jti: z.string().min(1),
  nonce: z.string().optional(),
});

export const GateResultSchema = z.object({
  name: z.string().min(1),
  passed: z.boolean(),
  detail: z.string().min(1),
  severity: z.enum(["error", "warn", "info"]),
});

export const GateReportSchema = z.object({
  workspace: z.string().min(1),
  passed: z.boolean(),
  results: z.array(GateResultSchema),
});
