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
export declare const CampaignSchema: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, string, string>;
    root: z.ZodString;
    goal: z.ZodString;
    nonGoals: z.ZodArray<z.ZodString, "many">;
    assumptions: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    root: string;
    goal: string;
    nonGoals: string[];
    assumptions: string[];
}>;
export declare const GoalStatusEnum: z.ZodEnum<["active", "scheduled", "completed", "abandoned"]>;
export declare const GoalRecordSchema: z.ZodObject<{
    id: z.ZodString;
    campaignId: z.ZodOptional<z.ZodString>;
    goal: z.ZodString;
    status: z.ZodEnum<["active", "scheduled", "completed", "abandoned"]>;
    source: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "scheduled" | "completed" | "abandoned";
    createdAt: string;
    updatedAt: string;
    goal: string;
    metadata?: Record<string, unknown> | undefined;
    campaignId?: string | undefined;
    source?: string | undefined;
}, {
    id: string;
    status: "active" | "scheduled" | "completed" | "abandoned";
    createdAt: string;
    updatedAt: string;
    goal: string;
    metadata?: Record<string, unknown> | undefined;
    campaignId?: string | undefined;
    source?: string | undefined;
}>;
export declare const AgentContextSchema: z.ZodObject<{
    sessionId: z.ZodEffects<z.ZodString, string, string>;
    agentId: z.ZodEffects<z.ZodString, string, string>;
    cwd: z.ZodString;
    teamId: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    sessionId: string;
    cwd: string;
    teamId?: string | undefined;
    parentId?: string | undefined;
    metadata?: Record<string, string> | undefined;
}, {
    agentId: string;
    sessionId: string;
    cwd: string;
    teamId?: string | undefined;
    parentId?: string | undefined;
    metadata?: Record<string, string> | undefined;
}>;
export declare const ToolCallSchema: z.ZodObject<{
    name: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    accessLevel: z.ZodDefault<z.ZodEnum<["cto", "agent"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    arguments: Record<string, unknown>;
    accessLevel: "cto" | "agent";
}, {
    name: string;
    arguments: Record<string, unknown>;
    accessLevel?: "cto" | "agent" | undefined;
}>;
export declare const TodoItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    owner: z.ZodEffects<z.ZodString, string, string>;
    status: z.ZodDefault<z.ZodEnum<["pending", "in_progress", "done", "rejected"]>>;
    priority: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "rejected" | "pending" | "in_progress" | "done";
    title: string;
    owner: string;
    priority: number;
}, {
    id: string;
    title: string;
    owner: string;
    status?: "rejected" | "pending" | "in_progress" | "done" | undefined;
    priority?: number | undefined;
}>;
export declare const GapKindEnum: z.ZodEnum<["missing", "incomplete", "divergent"]>;
export declare const ConvergeGapSchema: z.ZodObject<{
    kind: z.ZodEnum<["missing", "incomplete", "divergent"]>;
    planItem: z.ZodString;
    actual: z.ZodOptional<z.ZodString>;
    detail: z.ZodString;
    suggestion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "missing" | "incomplete" | "divergent";
    planItem: string;
    detail: string;
    suggestion: string;
    actual?: string | undefined;
}, {
    kind: "missing" | "incomplete" | "divergent";
    planItem: string;
    detail: string;
    suggestion: string;
    actual?: string | undefined;
}>;
export declare const ConvergeReportSchema: z.ZodObject<{
    generatedAt: z.ZodString;
    planDir: z.ZodString;
    totalGaps: z.ZodNumber;
    gapsByKind: z.ZodObject<{
        missing: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["missing", "incomplete", "divergent"]>;
            planItem: z.ZodString;
            actual: z.ZodOptional<z.ZodString>;
            detail: z.ZodString;
            suggestion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }>, "many">;
        incomplete: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["missing", "incomplete", "divergent"]>;
            planItem: z.ZodString;
            actual: z.ZodOptional<z.ZodString>;
            detail: z.ZodString;
            suggestion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }>, "many">;
        divergent: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["missing", "incomplete", "divergent"]>;
            planItem: z.ZodString;
            actual: z.ZodOptional<z.ZodString>;
            detail: z.ZodString;
            suggestion: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }, {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        missing: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        incomplete: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        divergent: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
    }, {
        missing: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        incomplete: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        divergent: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
    }>;
    actionableTasks: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    generatedAt: string;
    planDir: string;
    totalGaps: number;
    gapsByKind: {
        missing: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        incomplete: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        divergent: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
    };
    actionableTasks: string[];
}, {
    generatedAt: string;
    planDir: string;
    totalGaps: number;
    gapsByKind: {
        missing: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        incomplete: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
        divergent: {
            kind: "missing" | "incomplete" | "divergent";
            planItem: string;
            detail: string;
            suggestion: string;
            actual?: string | undefined;
        }[];
    };
    actionableTasks: string[];
}>;
export declare const HeadroomDeltaOperationKindEnum: z.ZodEnum<["add", "update", "delete"]>;
export declare const HeadroomDeltaOperationSchema: z.ZodObject<{
    kind: z.ZodEnum<["add", "update", "delete"]>;
    goalId: z.ZodString;
    goal: z.ZodOptional<z.ZodString>;
    previousGoal: z.ZodOptional<z.ZodString>;
    campaignId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    kind: "add" | "update" | "delete";
    goalId: string;
    metadata?: Record<string, unknown> | undefined;
    goal?: string | undefined;
    campaignId?: string | undefined;
    previousGoal?: string | undefined;
}, {
    kind: "add" | "update" | "delete";
    goalId: string;
    metadata?: Record<string, unknown> | undefined;
    goal?: string | undefined;
    campaignId?: string | undefined;
    previousGoal?: string | undefined;
}>;
export declare const HeadroomDeltaSchema: z.ZodObject<{
    timestamp: z.ZodString;
    evidence: z.ZodString;
    operations: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["add", "update", "delete"]>;
        goalId: z.ZodString;
        goal: z.ZodOptional<z.ZodString>;
        previousGoal: z.ZodOptional<z.ZodString>;
        campaignId: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        kind: "add" | "update" | "delete";
        goalId: string;
        metadata?: Record<string, unknown> | undefined;
        goal?: string | undefined;
        campaignId?: string | undefined;
        previousGoal?: string | undefined;
    }, {
        kind: "add" | "update" | "delete";
        goalId: string;
        metadata?: Record<string, unknown> | undefined;
        goal?: string | undefined;
        campaignId?: string | undefined;
        previousGoal?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    evidence: string;
    operations: {
        kind: "add" | "update" | "delete";
        goalId: string;
        metadata?: Record<string, unknown> | undefined;
        goal?: string | undefined;
        campaignId?: string | undefined;
        previousGoal?: string | undefined;
    }[];
}, {
    timestamp: string;
    evidence: string;
    operations: {
        kind: "add" | "update" | "delete";
        goalId: string;
        metadata?: Record<string, unknown> | undefined;
        goal?: string | undefined;
        campaignId?: string | undefined;
        previousGoal?: string | undefined;
    }[];
}>;
export declare const GoalRecordSnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    campaignId: z.ZodOptional<z.ZodString>;
    goal: z.ZodString;
    status: z.ZodEnum<["active", "scheduled", "completed", "abandoned"]>;
    source: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
} & {
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "scheduled" | "completed" | "abandoned";
    createdAt: string;
    updatedAt: string;
    goal: string;
    metadata?: Record<string, unknown> | undefined;
    campaignId?: string | undefined;
    source?: string | undefined;
}, {
    id: string;
    status: "active" | "scheduled" | "completed" | "abandoned";
    createdAt: string;
    updatedAt: string;
    goal: string;
    metadata?: Record<string, unknown> | undefined;
    campaignId?: string | undefined;
    source?: string | undefined;
}>;
export declare const HeadroomSnapshotSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    state: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        campaignId: z.ZodOptional<z.ZodString>;
        goal: z.ZodString;
        status: z.ZodEnum<["active", "scheduled", "completed", "abandoned"]>;
        source: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    } & {
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "scheduled" | "completed" | "abandoned";
        createdAt: string;
        updatedAt: string;
        goal: string;
        metadata?: Record<string, unknown> | undefined;
        campaignId?: string | undefined;
        source?: string | undefined;
    }, {
        id: string;
        status: "active" | "scheduled" | "completed" | "abandoned";
        createdAt: string;
        updatedAt: string;
        goal: string;
        metadata?: Record<string, unknown> | undefined;
        campaignId?: string | undefined;
        source?: string | undefined;
    }>, "many">;
    deltaHistory: z.ZodArray<z.ZodObject<{
        timestamp: z.ZodString;
        evidence: z.ZodString;
        operations: z.ZodArray<z.ZodObject<{
            kind: z.ZodEnum<["add", "update", "delete"]>;
            goalId: z.ZodString;
            goal: z.ZodOptional<z.ZodString>;
            previousGoal: z.ZodOptional<z.ZodString>;
            campaignId: z.ZodOptional<z.ZodString>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }, {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        evidence: string;
        operations: {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }[];
    }, {
        timestamp: string;
        evidence: string;
        operations: {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: string;
    state: {
        id: string;
        status: "active" | "scheduled" | "completed" | "abandoned";
        createdAt: string;
        updatedAt: string;
        goal: string;
        metadata?: Record<string, unknown> | undefined;
        campaignId?: string | undefined;
        source?: string | undefined;
    }[];
    deltaHistory: {
        timestamp: string;
        evidence: string;
        operations: {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }[];
    }[];
}, {
    id: string;
    timestamp: string;
    state: {
        id: string;
        status: "active" | "scheduled" | "completed" | "abandoned";
        createdAt: string;
        updatedAt: string;
        goal: string;
        metadata?: Record<string, unknown> | undefined;
        campaignId?: string | undefined;
        source?: string | undefined;
    }[];
    deltaHistory: {
        timestamp: string;
        evidence: string;
        operations: {
            kind: "add" | "update" | "delete";
            goalId: string;
            metadata?: Record<string, unknown> | undefined;
            goal?: string | undefined;
            campaignId?: string | undefined;
            previousGoal?: string | undefined;
        }[];
    }[];
}>;
export declare const CodebaseInventorySchema: z.ZodObject<{
    packages: z.ZodArray<z.ZodString, "many">;
    sourceFiles: z.ZodArray<z.ZodString, "many">;
    testFiles: z.ZodArray<z.ZodString, "many">;
    exportedSymbols: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    packages: string[];
    sourceFiles: string[];
    testFiles: string[];
    exportedSymbols: string[];
}, {
    packages: string[];
    sourceFiles: string[];
    testFiles: string[];
    exportedSymbols: string[];
}>;
export declare const AgentStatusEnum: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
export declare const AgentMessageSchema: z.ZodObject<{
    role: z.ZodEnum<["system", "user", "assistant", "tool", "error"]>;
    content: z.ZodString;
    timestamp: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    role: "system" | "user" | "assistant" | "tool" | "error";
    timestamp: string;
    content: string;
    metadata?: Record<string, string> | undefined;
}, {
    role: "system" | "user" | "assistant" | "tool" | "error";
    timestamp: string;
    content: string;
    metadata?: Record<string, string> | undefined;
}>;
export declare const AgentHandleSchema: z.ZodObject<{
    id: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
    createdAt: z.ZodString;
    completedAt: z.ZodOptional<z.ZodString>;
    ipcPath: z.ZodOptional<z.ZodString>;
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["system", "user", "assistant", "tool", "error"]>;
        content: z.ZodString;
        timestamp: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        role: "system" | "user" | "assistant" | "tool" | "error";
        timestamp: string;
        content: string;
        metadata?: Record<string, string> | undefined;
    }, {
        role: "system" | "user" | "assistant" | "tool" | "error";
        timestamp: string;
        content: string;
        metadata?: Record<string, string> | undefined;
    }>, "many">;
    returnCode: z.ZodOptional<z.ZodNumber>;
    traceId: z.ZodOptional<z.ZodString>;
    spanId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "completed" | "pending" | "running" | "failed" | "cancelled";
    createdAt: string;
    messages: {
        role: "system" | "user" | "assistant" | "tool" | "error";
        timestamp: string;
        content: string;
        metadata?: Record<string, string> | undefined;
    }[];
    sessionId?: string | undefined;
    parentId?: string | undefined;
    completedAt?: string | undefined;
    ipcPath?: string | undefined;
    returnCode?: number | undefined;
    traceId?: string | undefined;
    spanId?: string | undefined;
}, {
    id: string;
    status: "completed" | "pending" | "running" | "failed" | "cancelled";
    createdAt: string;
    messages: {
        role: "system" | "user" | "assistant" | "tool" | "error";
        timestamp: string;
        content: string;
        metadata?: Record<string, string> | undefined;
    }[];
    sessionId?: string | undefined;
    parentId?: string | undefined;
    completedAt?: string | undefined;
    ipcPath?: string | undefined;
    returnCode?: number | undefined;
    traceId?: string | undefined;
    spanId?: string | undefined;
}>;
export declare const SessionEventTypeEnum: z.ZodEnum<["session_created", "session_resumed", "session_event", "session_completed", "session_failed", "session_cancelled", "session_removed"]>;
export declare const SessionEventSchema: z.ZodObject<{
    type: z.ZodEnum<["session_created", "session_resumed", "session_event", "session_completed", "session_failed", "session_cancelled", "session_removed"]>;
    handle: z.ZodString;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    traceId: z.ZodOptional<z.ZodString>;
    spanId: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    type: "session_created" | "session_resumed" | "session_event" | "session_completed" | "session_failed" | "session_cancelled" | "session_removed";
    timestamp: string;
    handle: string;
    traceId?: string | undefined;
    spanId?: string | undefined;
    payload?: Record<string, unknown> | undefined;
}, {
    sessionId: string;
    type: "session_created" | "session_resumed" | "session_event" | "session_completed" | "session_failed" | "session_cancelled" | "session_removed";
    timestamp: string;
    handle: string;
    traceId?: string | undefined;
    spanId?: string | undefined;
    payload?: Record<string, unknown> | undefined;
}>;
export declare const PluginManifestPermissionsSchema: z.ZodObject<{
    network: z.ZodOptional<z.ZodBoolean>;
    filesystem: z.ZodOptional<z.ZodBoolean>;
    env: z.ZodOptional<z.ZodBoolean>;
    shell: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    filesystem?: boolean | undefined;
    network?: boolean | undefined;
    env?: boolean | undefined;
    shell?: boolean | undefined;
}, {
    filesystem?: boolean | undefined;
    network?: boolean | undefined;
    env?: boolean | undefined;
    shell?: boolean | undefined;
}>;
export declare const PluginManifestResourceLimitsSchema: z.ZodObject<{
    maxMemoryMb: z.ZodOptional<z.ZodNumber>;
    maxCpuPercent: z.ZodOptional<z.ZodNumber>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxMemoryMb?: number | undefined;
    maxCpuPercent?: number | undefined;
    timeoutMs?: number | undefined;
}, {
    maxMemoryMb?: number | undefined;
    maxCpuPercent?: number | undefined;
    timeoutMs?: number | undefined;
}>;
export declare const PluginManifestSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    homepage: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    mcpEndpoint: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    kind: z.ZodEnum<["mcp", "agent-hook", "skill"]>;
    sessionDurable: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    entrypoint: z.ZodObject<{
        module: z.ZodString;
        exportName: z.ZodString;
        stateSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    }, {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    }>;
    permissions: z.ZodOptional<z.ZodObject<{
        network: z.ZodOptional<z.ZodBoolean>;
        filesystem: z.ZodOptional<z.ZodBoolean>;
        env: z.ZodOptional<z.ZodBoolean>;
        shell: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        filesystem?: boolean | undefined;
        network?: boolean | undefined;
        env?: boolean | undefined;
        shell?: boolean | undefined;
    }, {
        filesystem?: boolean | undefined;
        network?: boolean | undefined;
        env?: boolean | undefined;
        shell?: boolean | undefined;
    }>>;
    resourceLimits: z.ZodOptional<z.ZodObject<{
        maxMemoryMb: z.ZodOptional<z.ZodNumber>;
        maxCpuPercent: z.ZodOptional<z.ZodNumber>;
        timeoutMs: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxMemoryMb?: number | undefined;
        maxCpuPercent?: number | undefined;
        timeoutMs?: number | undefined;
    }, {
        maxMemoryMb?: number | undefined;
        maxCpuPercent?: number | undefined;
        timeoutMs?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    version: string;
    entrypoint: {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    };
    kind: "mcp" | "agent-hook" | "skill";
    description?: string | undefined;
    permissions?: {
        filesystem?: boolean | undefined;
        network?: boolean | undefined;
        env?: boolean | undefined;
        shell?: boolean | undefined;
    } | undefined;
    author?: string | undefined;
    homepage?: string | undefined;
    mcpEndpoint?: string | undefined;
    sessionDurable?: boolean | undefined;
    tags?: string[] | undefined;
    resourceLimits?: {
        maxMemoryMb?: number | undefined;
        maxCpuPercent?: number | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
}, {
    id: string;
    name: string;
    version: string;
    entrypoint: {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    };
    kind: "mcp" | "agent-hook" | "skill";
    description?: string | undefined;
    permissions?: {
        filesystem?: boolean | undefined;
        network?: boolean | undefined;
        env?: boolean | undefined;
        shell?: boolean | undefined;
    } | undefined;
    author?: string | undefined;
    homepage?: string | undefined;
    mcpEndpoint?: string | undefined;
    sessionDurable?: boolean | undefined;
    tags?: string[] | undefined;
    resourceLimits?: {
        maxMemoryMb?: number | undefined;
        maxCpuPercent?: number | undefined;
        timeoutMs?: number | undefined;
    } | undefined;
}>;
export declare const PluginDescriptorSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodString>;
    homepage: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    mcpEndpoint: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    kind: z.ZodEnum<["mcp", "agent-hook", "skill"]>;
    sessionDurable: z.ZodOptional<z.ZodBoolean>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    entrypoint: z.ZodObject<{
        module: z.ZodString;
        exportName: z.ZodString;
        stateSchema: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    }, {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    }>;
    manifest: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    version: string;
    entrypoint: {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    };
    kind: "mcp" | "agent-hook" | "skill";
    description?: string | undefined;
    author?: string | undefined;
    homepage?: string | undefined;
    mcpEndpoint?: string | undefined;
    sessionDurable?: boolean | undefined;
    tags?: string[] | undefined;
    manifest?: any;
}, {
    id: string;
    name: string;
    version: string;
    entrypoint: {
        module: string;
        exportName: string;
        stateSchema?: Record<string, unknown> | undefined;
    };
    kind: "mcp" | "agent-hook" | "skill";
    description?: string | undefined;
    author?: string | undefined;
    homepage?: string | undefined;
    mcpEndpoint?: string | undefined;
    sessionDurable?: boolean | undefined;
    tags?: string[] | undefined;
    manifest?: any;
}>;
export declare const SessionDurabilityEventSchema: z.ZodObject<{
    type: z.ZodEnum<["state_persisted", "state_restored", "state_removed", "state_cleared"]>;
    pluginId: z.ZodString;
    timestamp: z.ZodString;
    size: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "state_persisted" | "state_restored" | "state_removed" | "state_cleared";
    timestamp: string;
    pluginId: string;
    size?: number | undefined;
}, {
    type: "state_persisted" | "state_restored" | "state_removed" | "state_cleared";
    timestamp: string;
    pluginId: string;
    size?: number | undefined;
}>;
export declare const SessionRecordSchema: z.ZodObject<{
    handle: z.ZodString;
    sessionId: z.ZodString;
    campaignId: z.ZodOptional<z.ZodString>;
    agentId: z.ZodOptional<z.ZodString>;
    parentHandle: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["pending", "running", "completed", "failed", "cancelled"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "pending" | "running" | "failed" | "cancelled";
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    handle: string;
    agentId?: string | undefined;
    metadata?: Record<string, string> | undefined;
    campaignId?: string | undefined;
    parentHandle?: string | undefined;
}, {
    status: "completed" | "pending" | "running" | "failed" | "cancelled";
    sessionId: string;
    createdAt: string;
    updatedAt: string;
    handle: string;
    agentId?: string | undefined;
    metadata?: Record<string, string> | undefined;
    campaignId?: string | undefined;
    parentHandle?: string | undefined;
}>;
export declare const TraceEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    action: z.ZodString;
    status: z.ZodString;
    detail: z.ZodOptional<z.ZodString>;
    _seq: z.ZodOptional<z.ZodNumber>;
    _ts: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: string;
    agentId: string;
    action: string;
    detail?: string | undefined;
    _seq?: number | undefined;
    _ts?: string | undefined;
}, {
    status: string;
    agentId: string;
    action: string;
    detail?: string | undefined;
    _seq?: number | undefined;
    _ts?: string | undefined;
}>;
export declare const JsonlRecordSchema: z.ZodObject<{
    _seq: z.ZodOptional<z.ZodNumber>;
    _ts: z.ZodOptional<z.ZodString>;
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id?: string | undefined;
    _seq?: number | undefined;
    _ts?: string | undefined;
}, {
    id?: string | undefined;
    _seq?: number | undefined;
    _ts?: string | undefined;
}>;
export declare const GraphifyNodeSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    norm_label: z.ZodString;
    file_type: z.ZodOptional<z.ZodString>;
    source_file: z.ZodOptional<z.ZodString>;
    source_location: z.ZodOptional<z.ZodString>;
    community: z.ZodOptional<z.ZodNumber>;
    community_name: z.ZodOptional<z.ZodString>;
    _origin: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    norm_label: string;
    file_type?: string | undefined;
    source_file?: string | undefined;
    source_location?: string | undefined;
    community?: number | undefined;
    community_name?: string | undefined;
    _origin?: string | undefined;
}, {
    id: string;
    label: string;
    norm_label: string;
    file_type?: string | undefined;
    source_file?: string | undefined;
    source_location?: string | undefined;
    community?: number | undefined;
    community_name?: string | undefined;
    _origin?: string | undefined;
}>;
export declare const GraphifyLinkSchema: z.ZodObject<{
    source: z.ZodString;
    target: z.ZodString;
    relation: z.ZodString;
    confidence: z.ZodOptional<z.ZodString>;
    confidence_score: z.ZodOptional<z.ZodNumber>;
    weight: z.ZodOptional<z.ZodNumber>;
    source_file: z.ZodOptional<z.ZodString>;
    source_location: z.ZodOptional<z.ZodString>;
    _origin: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: string;
    target: string;
    relation: string;
    source_file?: string | undefined;
    source_location?: string | undefined;
    _origin?: string | undefined;
    confidence?: string | undefined;
    confidence_score?: number | undefined;
    weight?: number | undefined;
}, {
    source: string;
    target: string;
    relation: string;
    source_file?: string | undefined;
    source_location?: string | undefined;
    _origin?: string | undefined;
    confidence?: string | undefined;
    confidence_score?: number | undefined;
    weight?: number | undefined;
}>;
export declare const GraphifyDataSchema: z.ZodObject<{
    directed: z.ZodOptional<z.ZodBoolean>;
    multigraph: z.ZodOptional<z.ZodBoolean>;
    nodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        norm_label: z.ZodString;
        file_type: z.ZodOptional<z.ZodString>;
        source_file: z.ZodOptional<z.ZodString>;
        source_location: z.ZodOptional<z.ZodString>;
        community: z.ZodOptional<z.ZodNumber>;
        community_name: z.ZodOptional<z.ZodString>;
        _origin: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        norm_label: string;
        file_type?: string | undefined;
        source_file?: string | undefined;
        source_location?: string | undefined;
        community?: number | undefined;
        community_name?: string | undefined;
        _origin?: string | undefined;
    }, {
        id: string;
        label: string;
        norm_label: string;
        file_type?: string | undefined;
        source_file?: string | undefined;
        source_location?: string | undefined;
        community?: number | undefined;
        community_name?: string | undefined;
        _origin?: string | undefined;
    }>, "many">;
    links: z.ZodArray<z.ZodObject<{
        source: z.ZodString;
        target: z.ZodString;
        relation: z.ZodString;
        confidence: z.ZodOptional<z.ZodString>;
        confidence_score: z.ZodOptional<z.ZodNumber>;
        weight: z.ZodOptional<z.ZodNumber>;
        source_file: z.ZodOptional<z.ZodString>;
        source_location: z.ZodOptional<z.ZodString>;
        _origin: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        source: string;
        target: string;
        relation: string;
        source_file?: string | undefined;
        source_location?: string | undefined;
        _origin?: string | undefined;
        confidence?: string | undefined;
        confidence_score?: number | undefined;
        weight?: number | undefined;
    }, {
        source: string;
        target: string;
        relation: string;
        source_file?: string | undefined;
        source_location?: string | undefined;
        _origin?: string | undefined;
        confidence?: string | undefined;
        confidence_score?: number | undefined;
        weight?: number | undefined;
    }>, "many">;
    hyperedges: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, "strip", z.ZodTypeAny, {
    nodes: {
        id: string;
        label: string;
        norm_label: string;
        file_type?: string | undefined;
        source_file?: string | undefined;
        source_location?: string | undefined;
        community?: number | undefined;
        community_name?: string | undefined;
        _origin?: string | undefined;
    }[];
    links: {
        source: string;
        target: string;
        relation: string;
        source_file?: string | undefined;
        source_location?: string | undefined;
        _origin?: string | undefined;
        confidence?: string | undefined;
        confidence_score?: number | undefined;
        weight?: number | undefined;
    }[];
    directed?: boolean | undefined;
    multigraph?: boolean | undefined;
    hyperedges?: unknown[] | undefined;
}, {
    nodes: {
        id: string;
        label: string;
        norm_label: string;
        file_type?: string | undefined;
        source_file?: string | undefined;
        source_location?: string | undefined;
        community?: number | undefined;
        community_name?: string | undefined;
        _origin?: string | undefined;
    }[];
    links: {
        source: string;
        target: string;
        relation: string;
        source_file?: string | undefined;
        source_location?: string | undefined;
        _origin?: string | undefined;
        confidence?: string | undefined;
        confidence_score?: number | undefined;
        weight?: number | undefined;
    }[];
    directed?: boolean | undefined;
    multigraph?: boolean | undefined;
    hyperedges?: unknown[] | undefined;
}>;
export declare const PermissionRequestSchema: z.ZodObject<{
    id: z.ZodString;
    agentId: z.ZodString;
    action: z.ZodString;
    reason: z.ZodString;
    status: z.ZodEnum<["pending", "approved", "rejected"]>;
    createdAt: z.ZodString;
    decidedAt: z.ZodOptional<z.ZodString>;
    decidedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "rejected" | "pending" | "approved";
    agentId: string;
    createdAt: string;
    action: string;
    reason: string;
    decidedAt?: string | undefined;
    decidedBy?: string | undefined;
}, {
    id: string;
    status: "rejected" | "pending" | "approved";
    agentId: string;
    createdAt: string;
    action: string;
    reason: string;
    decidedAt?: string | undefined;
    decidedBy?: string | undefined;
}>;
export declare const PermissionPolicySchema: z.ZodObject<{
    allowedActions: z.ZodArray<z.ZodString, "many">;
    blockedActions: z.ZodArray<z.ZodString, "many">;
    requireApproval: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    allowedActions: string[];
    blockedActions: string[];
    requireApproval: string[];
}, {
    allowedActions: string[];
    blockedActions: string[];
    requireApproval: string[];
}>;
export declare const CapabilityTokenPayloadSchema: z.ZodObject<{
    iss: z.ZodString;
    sub: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
    nbf: z.ZodNumber;
    exp: z.ZodNumber;
    jti: z.ZodString;
    nonce: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    sub: string;
    iss: string;
    scopes: string[];
    nbf: number;
    exp: number;
    jti: string;
    nonce?: string | undefined;
}, {
    sub: string;
    iss: string;
    scopes: string[];
    nbf: number;
    exp: number;
    jti: string;
    nonce?: string | undefined;
}>;
export declare const GateResultSchema: z.ZodObject<{
    name: z.ZodString;
    passed: z.ZodBoolean;
    detail: z.ZodString;
    severity: z.ZodEnum<["error", "warn", "info"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    detail: string;
    passed: boolean;
    severity: "error" | "warn" | "info";
}, {
    name: string;
    detail: string;
    passed: boolean;
    severity: "error" | "warn" | "info";
}>;
export declare const GateReportSchema: z.ZodObject<{
    workspace: z.ZodString;
    passed: z.ZodBoolean;
    results: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        passed: z.ZodBoolean;
        detail: z.ZodString;
        severity: z.ZodEnum<["error", "warn", "info"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        detail: string;
        passed: boolean;
        severity: "error" | "warn" | "info";
    }, {
        name: string;
        detail: string;
        passed: boolean;
        severity: "error" | "warn" | "info";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    passed: boolean;
    workspace: string;
    results: {
        name: string;
        detail: string;
        passed: boolean;
        severity: "error" | "warn" | "info";
    }[];
}, {
    passed: boolean;
    workspace: string;
    results: {
        name: string;
        detail: string;
        passed: boolean;
        severity: "error" | "warn" | "info";
    }[];
}>;
//# sourceMappingURL=index.d.ts.map