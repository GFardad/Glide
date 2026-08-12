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

export type CampaignDirectory = z.infer<typeof CampaignDirectorySchema>;

/* ------------------------------------------------------------------ */
/*  Markdown helpers / file schemas                                    */
/* ------------------------------------------------------------------ */

export const GoalMarkdownSchema = z.object({
  title: z.literal("Goal"),
  body: z.string().min(1),
});

export type GoalMarkdown = z.infer<typeof GoalMarkdownSchema>;

export const NonGoalsMarkdownSchema = z.object({
  title: z.literal("Non-Goals"),
  body: z.string().min(1),
});

export type NonGoalsMarkdown = z.infer<typeof NonGoalsMarkdownSchema>;

export const AssumptionsMarkdownSchema = z.object({
  title: z.literal("Assumptions"),
  body: z.string().min(1),
});

export type AssumptionsMarkdown = z.infer<typeof AssumptionsMarkdownSchema>;

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

export type ConstitutionJson = z.infer<typeof ConstitutionJsonSchema>;

/* ------------------------------------------------------------------ */
/*  Team/agent directories                                             */
/* ------------------------------------------------------------------ */

export const TeamDirectorySchema = z.object({
  path: z.string().min(1),
});

export type TeamDirectory = z.infer<typeof TeamDirectorySchema>;

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

export type AgentDirectory = z.infer<typeof AgentDirectorySchema>;

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

export type CampaignRootSummary = z.infer<typeof CampaignRootSummarySchema>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function parseGoalMarkdown(content: string): GoalMarkdown {
  const trimmed = content.trim();
  const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
  const title = (titleMatch?.[1] ?? "").trim();
  const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
  return GoalMarkdownSchema.parse({ title, body });
}

export function parseNonGoalsMarkdown(content: string): NonGoalsMarkdown {
  const trimmed = content.trim();
  const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
  const title = (titleMatch?.[1] ?? "").trim();
  const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
  return NonGoalsMarkdownSchema.parse({ title, body });
}

export function parseAssumptionsMarkdown(content: string): AssumptionsMarkdown {
  const trimmed = content.trim();
  const titleMatch = trimmed.match(/^#\s*(.+?)\s*$/m);
  const title = (titleMatch?.[1] ?? "").trim();
  const body = trimmed.replace(/^#\s*.+?\s*$/m, "").trim();
  return AssumptionsMarkdownSchema.parse({ title, body });
}
