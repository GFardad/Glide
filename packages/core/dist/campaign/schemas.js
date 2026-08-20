import { z } from "zod";
/* ------------------------------------------------------------------ */
/*  Governance / constitution                                          */
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
/* ------------------------------------------------------------------ */
/*  Campaign root files                                                */
/* ------------------------------------------------------------------ */
export const CampaignMarkdownFileSchema = z.object({
    title: z.string().min(1),
    body: z.string(),
});
/* ------------------------------------------------------------------ */
/*  Teams / Agents                                                     */
/* ------------------------------------------------------------------ */
export const TeamStatusEnum = z.enum([
    "active",
    "paused",
    "completed",
    "abandoned",
]);
export const TeamSchema = z.object({
    id: z.string().min(1),
    campaignId: z.string().min(1),
    name: z.string().min(1),
    status: TeamStatusEnum.default("active"),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const AgentRoleEnum = z.enum([
    "architect",
    "engineer",
    "security",
    "qa",
    "product",
    "runtime",
    "custom",
]);
export const AgentSchema = z.object({
    id: z.string().min(1),
    teamId: z.string().min(1),
    role: AgentRoleEnum,
    parentId: z.string().optional(),
    sessionId: z.string().min(1),
    personality: z.string().min(1),
    goal: z.string().min(1),
    notes: z.array(z.string()).default([]),
    todos: z.array(z.string()).default([]),
    rejected: z.array(z.string()).default([]),
    permissions: z.array(z.string()).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const REQUIRED_AGENT_FILES = [
    "PERSONALITY.md",
    "GOAL.md",
    "NOTES.md",
    "TODO.md",
    "REJECTED.md",
];
export const AgentFileContractSchema = z.object({
    agentId: z.string().min(1),
    teamId: z.string().optional(),
    generatedAt: z.string().datetime(),
    files: z.array(z.object({
        name: z.enum(REQUIRED_AGENT_FILES),
        expectedSection: z.string().min(1),
        description: z.string().optional(),
        current: z.string().optional(),
    })),
    schemaVersion: z.literal("1.0.0"),
});
/* ------------------------------------------------------------------ */
/*  Campaign root (summary shape)                                      */
/* ------------------------------------------------------------------ */
export const CampaignRootSummarySchema = z.object({
    id: z.string().min(1),
    root: z.string().min(1),
    goal: z.string().min(1),
    nonGoals: z.array(z.string()),
    assumptions: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    constitution: ConstitutionSchema.optional(),
    teams: z.array(TeamSchema).default([]),
    agentCount: z.number().int().nonnegative().default(0),
});
//# sourceMappingURL=schemas.js.map