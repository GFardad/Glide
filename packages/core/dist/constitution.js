export class ConstitutionValidationError extends Error {
    principleId;
    constructor(principleId, message) {
        super(message);
        this.principleId = principleId;
        this.name = "ConstitutionValidationError";
    }
}
export class AmendmentRejectedError extends Error {
    amendmentId;
    constructor(amendmentId, message) {
        super(message);
        this.amendmentId = amendmentId;
        this.name = "AmendmentRejectedError";
    }
}
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const CONSTITUTION_FILE = "constitution.json";
export function loadConstitution(root) {
    const path = join(root, CONSTITUTION_FILE);
    if (!existsSync(path)) {
        throw new Error(`Constitution not found: ${path}`);
    }
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch (error) {
        throw new Error(`Failed to parse constitution at ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export function ensureConstitutionDir(root) {
    mkdirSync(root, { recursive: true });
}
export function writeConstitution(root, constitution) {
    ensureConstitutionDir(root);
    writeFileSync(join(root, CONSTITUTION_FILE), JSON.stringify(constitution, null, 2));
}
export function proposeAmendment(constitution, amendment) {
    const next = {
        id: generateAmendmentId(),
        status: "proposed",
        proposedAt: new Date(),
        title: amendment.title,
        description: amendment.description,
        targetPrincipleIds: amendment.targetPrincipleIds,
        proposedChanges: amendment.proposedChanges,
        proposedBy: amendment.proposedBy,
        ...(amendment.reviewNotes !== undefined && { reviewNotes: amendment.reviewNotes }),
        ...(amendment.backwardsCompatibility !== undefined && {
            backwardsCompatibility: amendment.backwardsCompatibility,
        }),
    };
    validateAmendmentAgainstImmutablePrinciples(constitution, next);
    return next;
}
export function transitionAmendmentStatus(amendment, nextStatus, options) {
    if (!isValidStatusTransition(amendment.status, nextStatus)) {
        throw new AmendmentRejectedError(amendment.id, `Invalid status transition: ${amendment.status} -> ${nextStatus}`);
    }
    const next = {
        id: amendment.id,
        title: amendment.title,
        description: amendment.description,
        targetPrincipleIds: amendment.targetPrincipleIds,
        proposedChanges: amendment.proposedChanges,
        status: nextStatus,
        proposedBy: amendment.proposedBy,
        proposedAt: amendment.proposedAt,
        ...(options?.reviewNotes !== undefined && { reviewNotes: options.reviewNotes }),
        ...(options?.backwardsCompatibility !== undefined && {
            backwardsCompatibility: options.backwardsCompatibility,
        }),
    };
    return next;
}
export function validateChangeAgainstConstitution(constitution, proposedChanges) {
    for (const change of proposedChanges) {
        const target = constitution.principles.find((p) => p.id === change.principleId);
        if (!target) {
            throw new ConstitutionValidationError(change.principleId, `Unknown principle: ${change.principleId}`);
        }
        if (target.immutable) {
            throw new ConstitutionValidationError(target.id, `Amendment violates immutable principle: ${target.title}`);
        }
    }
}
function validateAmendmentAgainstImmutablePrinciples(constitution, amendment) {
    const immutablePrinciples = constitution.principles.filter((p) => p.immutable && amendment.targetPrincipleIds.includes(p.id));
    if (immutablePrinciples.length > 0) {
        throw new ConstitutionValidationError(immutablePrinciples.map((p) => p.id).join(","), `Amendment targets immutable principles: ${immutablePrinciples
            .map((p) => p.title)
            .join(", ")}`);
    }
}
function isValidStatusTransition(current, next) {
    const allowed = {
        proposed: ["review", "rejected"],
        review: ["ratified", "rejected", "proposed"],
        ratified: ["superseded"],
        rejected: ["superseded"],
        superseded: [],
    };
    return allowed[current]?.includes(next) ?? false;
}
function generateAmendmentId() {
    return `amendment_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}
//# sourceMappingURL=constitution.js.map