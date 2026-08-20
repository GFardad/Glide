import { z } from "zod";
export declare const PrincipleSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    immutable: z.ZodBoolean;
    rationale: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    description: string;
    immutable: boolean;
    rationale?: string | undefined;
}, {
    id: string;
    title: string;
    description: string;
    immutable: boolean;
    rationale?: string | undefined;
}>;
export type Principle = z.infer<typeof PrincipleSchema>;
export declare const ConstitutionAmendmentStatusEnum: z.ZodEnum<["proposed", "review", "ratified", "rejected", "superseded"]>;
export declare const ConstitutionAmendmentSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    targetPrincipleIds: z.ZodArray<z.ZodString, "many">;
    proposedChanges: z.ZodArray<z.ZodString, "many">;
    status: z.ZodEnum<["proposed", "review", "ratified", "rejected", "superseded"]>;
    proposedBy: z.ZodString;
    proposedAt: z.ZodString;
    reviewNotes: z.ZodOptional<z.ZodString>;
    backwardsCompatibility: z.ZodOptional<z.ZodObject<{
        compatible: z.ZodBoolean;
        breakingChanges: z.ZodArray<z.ZodString, "many">;
        migrationPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        compatible: boolean;
        breakingChanges: string[];
        migrationPath?: string | undefined;
    }, {
        compatible: boolean;
        breakingChanges: string[];
        migrationPath?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
    proposedAt: string;
    title: string;
    description: string;
    targetPrincipleIds: string[];
    proposedChanges: string[];
    proposedBy: string;
    reviewNotes?: string | undefined;
    backwardsCompatibility?: {
        compatible: boolean;
        breakingChanges: string[];
        migrationPath?: string | undefined;
    } | undefined;
}, {
    id: string;
    status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
    proposedAt: string;
    title: string;
    description: string;
    targetPrincipleIds: string[];
    proposedChanges: string[];
    proposedBy: string;
    reviewNotes?: string | undefined;
    backwardsCompatibility?: {
        compatible: boolean;
        breakingChanges: string[];
        migrationPath?: string | undefined;
    } | undefined;
}>;
export type ConstitutionAmendment = z.infer<typeof ConstitutionAmendmentSchema>;
export declare const ConstitutionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    principles: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        immutable: z.ZodBoolean;
        rationale: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        description: string;
        immutable: boolean;
        rationale?: string | undefined;
    }, {
        id: string;
        title: string;
        description: string;
        immutable: boolean;
        rationale?: string | undefined;
    }>, "many">;
    amendments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        targetPrincipleIds: z.ZodArray<z.ZodString, "many">;
        proposedChanges: z.ZodArray<z.ZodString, "many">;
        status: z.ZodEnum<["proposed", "review", "ratified", "rejected", "superseded"]>;
        proposedBy: z.ZodString;
        proposedAt: z.ZodString;
        reviewNotes: z.ZodOptional<z.ZodString>;
        backwardsCompatibility: z.ZodOptional<z.ZodObject<{
            compatible: z.ZodBoolean;
            breakingChanges: z.ZodArray<z.ZodString, "many">;
            migrationPath: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        }, {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
        proposedAt: string;
        title: string;
        description: string;
        targetPrincipleIds: string[];
        proposedChanges: string[];
        proposedBy: string;
        reviewNotes?: string | undefined;
        backwardsCompatibility?: {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        } | undefined;
    }, {
        id: string;
        status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
        proposedAt: string;
        title: string;
        description: string;
        targetPrincipleIds: string[];
        proposedChanges: string[];
        proposedBy: string;
        reviewNotes?: string | undefined;
        backwardsCompatibility?: {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        } | undefined;
    }>, "many">;
    owner: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    version: string;
    principles: {
        id: string;
        title: string;
        description: string;
        immutable: boolean;
        rationale?: string | undefined;
    }[];
    amendments: {
        id: string;
        status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
        proposedAt: string;
        title: string;
        description: string;
        targetPrincipleIds: string[];
        proposedChanges: string[];
        proposedBy: string;
        reviewNotes?: string | undefined;
        backwardsCompatibility?: {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        } | undefined;
    }[];
    owner: string;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    version: string;
    principles: {
        id: string;
        title: string;
        description: string;
        immutable: boolean;
        rationale?: string | undefined;
    }[];
    amendments: {
        id: string;
        status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
        proposedAt: string;
        title: string;
        description: string;
        targetPrincipleIds: string[];
        proposedChanges: string[];
        proposedBy: string;
        reviewNotes?: string | undefined;
        backwardsCompatibility?: {
            compatible: boolean;
            breakingChanges: string[];
            migrationPath?: string | undefined;
        } | undefined;
    }[];
    owner: string;
}>;
export type Constitution = z.infer<typeof ConstitutionSchema>;
export declare const CampaignMarkdownFileSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    body: string;
}, {
    title: string;
    body: string;
}>;
export type CampaignMarkdownFile = z.infer<typeof CampaignMarkdownFileSchema>;
export declare const TeamStatusEnum: z.ZodEnum<["active", "paused", "completed", "abandoned"]>;
export declare const TeamSchema: z.ZodObject<{
    id: z.ZodString;
    campaignId: z.ZodString;
    name: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["active", "paused", "completed", "abandoned"]>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "completed" | "abandoned" | "paused";
    createdAt: string;
    updatedAt: string;
    name: string;
    campaignId: string;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    campaignId: string;
    status?: "active" | "completed" | "abandoned" | "paused" | undefined;
}>;
export type Team = z.infer<typeof TeamSchema>;
export declare const AgentRoleEnum: z.ZodEnum<["architect", "engineer", "security", "qa", "product", "runtime", "custom"]>;
export declare const AgentSchema: z.ZodObject<{
    id: z.ZodString;
    teamId: z.ZodString;
    role: z.ZodEnum<["architect", "engineer", "security", "qa", "product", "runtime", "custom"]>;
    parentId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodString;
    personality: z.ZodString;
    goal: z.ZodString;
    notes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    todos: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    rejected: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    permissions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    rejected: string[];
    id: string;
    teamId: string;
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    goal: string;
    personality: string;
    notes: string[];
    todos: string[];
    permissions: string[];
    role: "custom" | "architect" | "engineer" | "security" | "qa" | "product" | "runtime";
    parentId?: string | undefined;
}, {
    id: string;
    teamId: string;
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    goal: string;
    personality: string;
    role: "custom" | "architect" | "engineer" | "security" | "qa" | "product" | "runtime";
    rejected?: string[] | undefined;
    parentId?: string | undefined;
    notes?: string[] | undefined;
    todos?: string[] | undefined;
    permissions?: string[] | undefined;
}>;
export type Agent = z.infer<typeof AgentSchema>;
export declare const REQUIRED_AGENT_FILES: readonly ["PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md"];
export type RequiredAgentFile = (typeof REQUIRED_AGENT_FILES)[number];
export declare const AgentFileContractSchema: z.ZodObject<{
    agentId: z.ZodString;
    teamId: z.ZodOptional<z.ZodString>;
    generatedAt: z.ZodString;
    files: z.ZodArray<z.ZodObject<{
        name: z.ZodEnum<["PERSONALITY.md", "GOAL.md", "NOTES.md", "TODO.md", "REJECTED.md"]>;
        expectedSection: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        current: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: "GOAL.md" | "PERSONALITY.md" | "NOTES.md" | "TODO.md" | "REJECTED.md";
        expectedSection: string;
        description?: string | undefined;
        current?: string | undefined;
    }, {
        name: "GOAL.md" | "PERSONALITY.md" | "NOTES.md" | "TODO.md" | "REJECTED.md";
        expectedSection: string;
        description?: string | undefined;
        current?: string | undefined;
    }>, "many">;
    schemaVersion: z.ZodLiteral<"1.0.0">;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    files: {
        name: "GOAL.md" | "PERSONALITY.md" | "NOTES.md" | "TODO.md" | "REJECTED.md";
        expectedSection: string;
        description?: string | undefined;
        current?: string | undefined;
    }[];
    generatedAt: string;
    schemaVersion: "1.0.0";
    teamId?: string | undefined;
}, {
    agentId: string;
    files: {
        name: "GOAL.md" | "PERSONALITY.md" | "NOTES.md" | "TODO.md" | "REJECTED.md";
        expectedSection: string;
        description?: string | undefined;
        current?: string | undefined;
    }[];
    generatedAt: string;
    schemaVersion: "1.0.0";
    teamId?: string | undefined;
}>;
export type AgentFileContract = z.infer<typeof AgentFileContractSchema>;
export declare const CampaignRootSummarySchema: z.ZodObject<{
    id: z.ZodString;
    root: z.ZodString;
    goal: z.ZodString;
    nonGoals: z.ZodArray<z.ZodString, "many">;
    assumptions: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    constitution: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        version: z.ZodString;
        principles: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            immutable: z.ZodBoolean;
            rationale: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }, {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }>, "many">;
        amendments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            targetPrincipleIds: z.ZodArray<z.ZodString, "many">;
            proposedChanges: z.ZodArray<z.ZodString, "many">;
            status: z.ZodEnum<["proposed", "review", "ratified", "rejected", "superseded"]>;
            proposedBy: z.ZodString;
            proposedAt: z.ZodString;
            reviewNotes: z.ZodOptional<z.ZodString>;
            backwardsCompatibility: z.ZodOptional<z.ZodObject<{
                compatible: z.ZodBoolean;
                breakingChanges: z.ZodArray<z.ZodString, "many">;
                migrationPath: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            }, {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }, {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }>, "many">;
        owner: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        version: string;
        principles: {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }[];
        amendments: {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }[];
        owner: string;
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        version: string;
        principles: {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }[];
        amendments: {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }[];
        owner: string;
    }>>;
    teams: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        campaignId: z.ZodString;
        name: z.ZodString;
        status: z.ZodDefault<z.ZodEnum<["active", "paused", "completed", "abandoned"]>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "completed" | "abandoned" | "paused";
        createdAt: string;
        updatedAt: string;
        name: string;
        campaignId: string;
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        campaignId: string;
        status?: "active" | "completed" | "abandoned" | "paused" | undefined;
    }>, "many">>;
    agentCount: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    teams: {
        id: string;
        status: "active" | "completed" | "abandoned" | "paused";
        createdAt: string;
        updatedAt: string;
        name: string;
        campaignId: string;
    }[];
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    agentCount: number;
    constitution?: {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        version: string;
        principles: {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }[];
        amendments: {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }[];
        owner: string;
    } | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
    teams?: {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        campaignId: string;
        status?: "active" | "completed" | "abandoned" | "paused" | undefined;
    }[] | undefined;
    constitution?: {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        version: string;
        principles: {
            id: string;
            title: string;
            description: string;
            immutable: boolean;
            rationale?: string | undefined;
        }[];
        amendments: {
            id: string;
            status: "proposed" | "review" | "ratified" | "rejected" | "superseded";
            proposedAt: string;
            title: string;
            description: string;
            targetPrincipleIds: string[];
            proposedChanges: string[];
            proposedBy: string;
            reviewNotes?: string | undefined;
            backwardsCompatibility?: {
                compatible: boolean;
                breakingChanges: string[];
                migrationPath?: string | undefined;
            } | undefined;
        }[];
        owner: string;
    } | undefined;
    agentCount?: number | undefined;
}>;
export type CampaignRootSummary = z.infer<typeof CampaignRootSummarySchema>;
//# sourceMappingURL=schemas.d.ts.map