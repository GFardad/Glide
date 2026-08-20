/** High-level governance principle that may be immutable or mutable. */
export interface Principle {
    /** Stable identifier for the principle. */
    id: string;
    /** Human-readable title. */
    title: string;
    /** Detailed explanation of the principle. */
    description: string;
    /** Whether the principle can be amended. Immutable principles block violating changes. */
    immutable: boolean;
    /** Optional rationale recorded at creation time. */
    rationale?: string;
}
/** Lifecycle stage of a constitution amendment. */
export type ConstitutionAmendmentStatus = "proposed" | "review" | "ratified" | "rejected" | "superseded";
/** Backwards-compatibility assessment for a proposed amendment. */
export interface BackwardsCompatibilityAssessment {
    /** Whether the amendment can be applied without breaking existing contracts/artifacts. */
    compatible: boolean;
    /** Breaking changes discovered, if any. */
    breakingChanges: string[];
    /** Suggested migration path or null if none required. */
    migrationPath?: string;
}
/** Proposed or applied change to the constitution. */
export interface ConstitutionAmendment {
    /** Stable identifier for the amendment. */
    id: string;
    /** Human-readable title. */
    title: string;
    /** Detailed description of the change. */
    description: string;
    /** Target principle IDs this amendment modifies. */
    targetPrincipleIds: string[];
    /** Proposed replacement text for affected principles. */
    proposedChanges: string[];
    /** Current lifecycle status. */
    status: ConstitutionAmendmentStatus;
    /** Who proposed the amendment. */
    proposedBy: string;
    /** Timestamp when proposed. */
    proposedAt: Date;
    /** Optional reviewer notes. */
    reviewNotes?: string;
    /** Backwards-compatibility assessment completed during review. */
    backwardsCompatibility?: BackwardsCompatibilityAssessment;
}
/** Governance document containing principles and amendment history. */
export interface Constitution {
    /** Stable identifier for the constitution. */
    id: string;
    /** Human-readable name. */
    name: string;
    /** Version string, e.g. `1.0.0`. */
    version: string;
    /** Active principles ordered by precedence. */
    principles: Principle[];
    /** Recorded amendments, including active and historical. */
    amendments: ConstitutionAmendment[];
    /** Owner role responsible for constitution upkeep. */
    owner: string;
    /** Timestamp created. */
    createdAt: Date;
    /** Timestamp of last update. */
    updatedAt: Date;
}
export declare class ConstitutionValidationError extends Error {
    principleId: string;
    constructor(principleId: string, message: string);
}
export declare class AmendmentRejectedError extends Error {
    amendmentId: string;
    constructor(amendmentId: string, message: string);
}
export declare function loadConstitution(root: string): Constitution;
export declare function ensureConstitutionDir(root: string): void;
export declare function writeConstitution(root: string, constitution: Constitution): void;
export declare function proposeAmendment(constitution: Constitution, amendment: Omit<ConstitutionAmendment, "id" | "status" | "proposedAt">): ConstitutionAmendment;
export declare function transitionAmendmentStatus(amendment: ConstitutionAmendment, nextStatus: ConstitutionAmendmentStatus, options?: {
    reviewNotes?: string;
    backwardsCompatibility?: BackwardsCompatibilityAssessment;
}): ConstitutionAmendment;
export declare function validateChangeAgainstConstitution(constitution: Constitution, proposedChanges: {
    principleId: string;
    replacement: string;
}[]): void;
//# sourceMappingURL=constitution.d.ts.map