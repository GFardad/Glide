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
export type ConstitutionAmendmentStatus =
  | "proposed"
  | "review"
  | "ratified"
  | "rejected"
  | "superseded";

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

export class ConstitutionValidationError extends Error {
  constructor(
    public principleId: string,
    message: string
  ) {
    super(message);
    this.name = "ConstitutionValidationError";
  }
}

export class AmendmentRejectedError extends Error {
  constructor(
    public amendmentId: string,
    message: string
  ) {
    super(message);
    this.name = "AmendmentRejectedError";
  }
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CONSTITUTION_FILE = "constitution.json";

export function loadConstitution(root: string): Constitution {
  const path = join(root, CONSTITUTION_FILE);
  if (!existsSync(path)) {
    throw new Error(`Constitution not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Constitution;
}

export function ensureConstitutionDir(root: string): void {
  mkdirSync(root, { recursive: true });
}

export function writeConstitution(root: string, constitution: Constitution): void {
  ensureConstitutionDir(root);
  writeFileSync(
    join(root, CONSTITUTION_FILE),
    JSON.stringify(constitution, null, 2)
  );
}

export function proposeAmendment(
  constitution: Constitution,
  amendment: Omit<ConstitutionAmendment, "id" | "status" | "proposedAt">
): ConstitutionAmendment {
  const next: ConstitutionAmendment = {
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

export function transitionAmendmentStatus(
  amendment: ConstitutionAmendment,
  nextStatus: ConstitutionAmendmentStatus,
  options?: {
    reviewNotes?: string;
    backwardsCompatibility?: BackwardsCompatibilityAssessment;
  }
): ConstitutionAmendment {
  if (!isValidStatusTransition(amendment.status, nextStatus)) {
    throw new AmendmentRejectedError(
      amendment.id,
      `Invalid status transition: ${amendment.status} -> ${nextStatus}`
    );
  }

  const next: ConstitutionAmendment = {
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

export function validateChangeAgainstConstitution(
  constitution: Constitution,
  proposedChanges: { principleId: string; replacement: string }[]
): void {
  for (const change of proposedChanges) {
    const target = constitution.principles.find(
      (p) => p.id === change.principleId
    );
    if (!target) {
      throw new ConstitutionValidationError(
        change.principleId,
        `Unknown principle: ${change.principleId}`
      );
    }

    if (target.immutable) {
      throw new ConstitutionValidationError(
        target.id,
        `Amendment violates immutable principle: ${target.title}`
      );
    }
  }
}

function validateAmendmentAgainstImmutablePrinciples(
  constitution: Constitution,
  amendment: ConstitutionAmendment
): void {
  const immutablePrinciples = constitution.principles.filter(
    (p) => p.immutable && amendment.targetPrincipleIds.includes(p.id)
  );

  if (immutablePrinciples.length > 0) {
    throw new ConstitutionValidationError(
      immutablePrinciples.map((p) => p.id).join(","),
      `Amendment targets immutable principles: ${immutablePrinciples
        .map((p) => p.title)
        .join(", ")}`
    );
  }
}

function isValidStatusTransition(
  current: ConstitutionAmendmentStatus,
  next: ConstitutionAmendmentStatus
): boolean {
  const allowed: Record<ConstitutionAmendmentStatus, ConstitutionAmendmentStatus[]> = {
    proposed: ["review", "rejected"],
    review: ["ratified", "rejected", "proposed"],
    ratified: ["superseded"],
    rejected: ["superseded"],
    superseded: [],
  };

  return allowed[current]?.includes(next) ?? false;
}

function generateAmendmentId(): string {
  return `amendment_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
