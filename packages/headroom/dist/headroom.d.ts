import type { HeadroomDelta } from "./delta.js";
/** Raised when headroom input is invalid (e.g. missing objective). */
export declare class HeadroomInputError extends Error {
    constructor(message: string);
}
/** Raised when writing a headroom artifact to disk fails. Carries the target path. */
export declare class HeadroomIOError extends Error {
    readonly path: string;
    constructor(message: string, path: string);
}
export interface HeadroomInput {
    campaignDir: string;
    objective: string;
    roles: string[];
}
export interface HeadroomResult {
    campaign: {
        id: string;
        root: string;
        goal: string;
        nonGoals: string[];
        assumptions: string[];
        createdAt: Date;
        updatedAt: Date;
    };
    riskLog: string;
    architecture: string;
    todoRegistry: string;
    driftDetected: boolean;
    roleSignals: Record<string, string[]>;
    appliedDelta: HeadroomDelta | null;
}
export declare function runHeadroom(input: HeadroomInput): Promise<HeadroomResult>;
//# sourceMappingURL=headroom.d.ts.map