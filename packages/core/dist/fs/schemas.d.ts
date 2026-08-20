import { z } from "zod";
export declare const CampaignDirectorySchema: z.ZodObject<{
    root: z.ZodString;
    constitution: z.ZodObject<{
        path: z.ZodString;
        goal: z.ZodString;
        nonGoals: z.ZodArray<z.ZodString, "many">;
        assumptions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        path: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    }, {
        path: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    }>;
    sessions: z.ZodString;
    artifacts: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessions: string;
    artifacts: string;
    root: string;
    constitution: {
        path: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    };
}, {
    sessions: string;
    artifacts: string;
    root: string;
    constitution: {
        path: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    };
}>;
export type CampaignDirectory = z.infer<typeof CampaignDirectorySchema>;
export declare const GoalMarkdownSchema: z.ZodObject<{
    title: z.ZodLiteral<"Goal">;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: "Goal";
    body: string;
}, {
    title: "Goal";
    body: string;
}>;
export type GoalMarkdown = z.infer<typeof GoalMarkdownSchema>;
export declare const NonGoalsMarkdownSchema: z.ZodObject<{
    title: z.ZodLiteral<"Non-Goals">;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: "Non-Goals";
    body: string;
}, {
    title: "Non-Goals";
    body: string;
}>;
export type NonGoalsMarkdown = z.infer<typeof NonGoalsMarkdownSchema>;
export declare const AssumptionsMarkdownSchema: z.ZodObject<{
    title: z.ZodLiteral<"Assumptions">;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: "Assumptions";
    body: string;
}, {
    title: "Assumptions";
    body: string;
}>;
export type AssumptionsMarkdown = z.infer<typeof AssumptionsMarkdownSchema>;
export declare const ConstitutionJsonSchema: z.ZodObject<{
    campaign: z.ZodObject<{
        id: z.ZodString;
        goal: z.ZodString;
        nonGoals: z.ZodArray<z.ZodString, "many">;
        assumptions: z.ZodArray<z.ZodString, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        updatedAt: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    }>;
    teams: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    campaign: {
        id: string;
        createdAt: string;
        updatedAt: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    };
    teams?: string[] | undefined;
}, {
    campaign: {
        id: string;
        createdAt: string;
        updatedAt: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
    };
    teams?: string[] | undefined;
}>;
export type ConstitutionJson = z.infer<typeof ConstitutionJsonSchema>;
export declare const TeamDirectorySchema: z.ZodObject<{
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
}, {
    path: string;
}>;
export type TeamDirectory = z.infer<typeof TeamDirectorySchema>;
export declare const AgentDirectorySchema: z.ZodObject<{
    path: z.ZodString;
    files: z.ZodObject<{
        personality: z.ZodString;
        goal: z.ZodString;
        notes: z.ZodString;
        todos: z.ZodString;
        rejected: z.ZodString;
        contract: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rejected: string;
        goal: string;
        personality: string;
        notes: string;
        todos: string;
        contract: string;
    }, {
        rejected: string;
        goal: string;
        personality: string;
        notes: string;
        todos: string;
        contract: string;
    }>;
}, "strip", z.ZodTypeAny, {
    path: string;
    files: {
        rejected: string;
        goal: string;
        personality: string;
        notes: string;
        todos: string;
        contract: string;
    };
}, {
    path: string;
    files: {
        rejected: string;
        goal: string;
        personality: string;
        notes: string;
        todos: string;
        contract: string;
    };
}>;
export type AgentDirectory = z.infer<typeof AgentDirectorySchema>;
export declare const CampaignRootSummarySchema: z.ZodObject<{
    id: z.ZodString;
    root: z.ZodString;
    goal: z.ZodString;
    nonGoals: z.ZodArray<z.ZodString, "many">;
    assumptions: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    constitution: z.ZodOptional<z.ZodObject<{
        campaign: z.ZodObject<{
            id: z.ZodString;
            goal: z.ZodString;
            nonGoals: z.ZodArray<z.ZodString, "many">;
            assumptions: z.ZodArray<z.ZodString, "many">;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        }, {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        }>;
        teams: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        campaign: {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        };
        teams?: string[] | undefined;
    }, {
        campaign: {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        };
        teams?: string[] | undefined;
    }>>;
    teams: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    agentCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    teams: string[];
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    agentCount: number;
    constitution?: {
        campaign: {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        };
        teams?: string[] | undefined;
    } | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    teams?: string[] | undefined;
    constitution?: {
        campaign: {
            id: string;
            createdAt: string;
            updatedAt: string;
            goal: string;
            nonGoals: string[];
            assumptions: string[];
        };
        teams?: string[] | undefined;
    } | undefined;
    agentCount?: number | undefined;
}>;
export type CampaignRootSummary = z.infer<typeof CampaignRootSummarySchema>;
export declare function parseGoalMarkdown(content: string): GoalMarkdown;
export declare function parseNonGoalsMarkdown(content: string): NonGoalsMarkdown;
export declare function parseAssumptionsMarkdown(content: string): AssumptionsMarkdown;
//# sourceMappingURL=schemas.d.ts.map