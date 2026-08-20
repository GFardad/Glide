import { z } from "zod";
/* ------------------------------------------------------------------ */
/*  Campaign directories                                               */
/* ------------------------------------------------------------------ */
export const CampaignDirectorySchema = z.object({
    root: z.string().min(1),
    constitution: z.object({
        path: z.string().min(1),
        goal: z.string().min(1),
        nonGoals: z.array(z.string()),
        assumptions: z.array(z.string()),
    }),
    sessions: z.string().min(1),
    artifacts: z.string().min(1),
});
/* ------------------------------------------------------------------ */
/*  Markdown helpers / file schemas                                    */
/* ------------------------------------------------------------------ */
export const GoalMarkdownSchema = z.object({
    title: z.literal("Goal"),
    body: z.string().min(1),
});
export const NonGoalsMarkdownSchema = z.object({
    title: z.literal("Non-Goals"),
    body: z.string().min(1),
});
export const AssumptionsMarkdownSchema = z.object({
    title: z.literal("Assumptions"),
    body: z.string().min(1),
});
export const ConstitutionJsonSchema = z.object({
    campaign: z.object({
        id: z.string().min(1),
        goal: z.string().min(1),
        nonGoals: z.array(z.string()),
        assumptions: z.array(z.string()),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    }),
    teams: z.array(z.string()).optional(),
});
/* ------------------------------------------------------------------ */
/*  Team/agent directories                                             */
/* ------------------------------------------------------------------ */
export const TeamDirectorySchema = z.object({
    path: z.string().min(1),
});
export const AgentDirectorySchema = z.object({
    path: z.string().min(1),
    files: z.object({
        personality: z.string().min(1),
        goal: z.string().min(1),
        notes: z.string().min(1),
        todos: z.string().min(1),
        rejected: z.string().min(1),
        contract: z.string().min(1),
    }),
});
/* ------------------------------------------------------------------ */
/*  Root metadata                                                     */
/* ------------------------------------------------------------------ */
export const CampaignRootSummarySchema = z.object({
    id: z.string().min(1),
    root: z.string().min(1),
    goal: z.string().min(1),
    nonGoals: z.array(z.string()),
    assumptions: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    constitution: ConstitutionJsonSchema.optional(),
    teams: z.array(z.string()).default([]),
    agentCount: z.number().int().nonnegative().default(0),
});
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
export function parseGoalMarkdown(content) {
    const trimmed = content.trim();
    const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
    const title = (titleMatch?.[1] ?? "").trim();
    const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
    return GoalMarkdownSchema.parse({ title, body });
}
export function parseNonGoalsMarkdown(content) {
    const trimmed = content.trim();
    const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
    const title = (titleMatch?.[1] ?? "").trim();
    const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
    return NonGoalsMarkdownSchema.parse({ title, body });
}
export function parseAssumptionsMarkdown(content) {
    const trimmed = content.trim();
    const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
    const title = (titleMatch?.[1] ?? "").trim();
    const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
    return AssumptionsMarkdownSchema.parse({ title, body });
}
//# sourceMappingURL=schemas.js.map