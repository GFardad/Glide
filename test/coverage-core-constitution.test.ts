import { describe, it, expect, beforeEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  loadConstitution,
  ensureConstitutionDir,
  writeConstitution,
  proposeAmendment,
  transitionAmendmentStatus,
  validateChangeAgainstConstitution,
  type Constitution,
  type Principle,
} from "../packages/core/src/constitution.js";

/**
 * Coverage tests for packages/core/src/constitution.ts.
 * These exercises the load/write/amend/validate paths so v8 sees them.
 */

const TMP = "/tmp/glide-constitution-coverage-test";

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

function baseConstitution(overrides: Partial<Constitution> = {}): Constitution {
  const principles: Principle[] = [
    {
      id: "p1",
      title: "Be helpful",
      description: "Help users",
      immutable: false,
    },
    {
      id: "p2",
      title: "Stay safe",
      description: "Never harm",
      immutable: true,
    },
  ];
  return {
    id: "c1",
    name: "Test Constitution",
    version: "1.0.0",
    principles,
    amendments: [],
    owner: "system",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("constitution filesystem helpers", () => {
  it("loads a written constitution from disk", () => {
    const constitution = baseConstitution();
    writeConstitution(TMP, constitution);
    const loaded = loadConstitution(TMP);
    expect(loaded.id).toBe("c1");
    expect(loaded.principles).toHaveLength(2);
  });

  it("throws when the constitution file is missing", () => {
    expect(() => loadConstitution(join(TMP, "does-not-exist"))).toThrow(
      "Constitution not found:"
    );
  });

  it("ensures the constitution directory exists", () => {
    const nested = join(TMP, "nested", "dir");
    ensureConstitutionDir(nested);
    expect(existsSync(nested)).toBe(true);
  });
});

describe("constitution amendments", () => {
  it("proposes a new amendment against mutable principles", () => {
    const constitution = baseConstitution();
    const amendment = proposeAmendment(constitution, {
      title: "New rule",
      description: "Add a rule",
      targetPrincipleIds: ["p1"],
      proposedChanges: ["Be more helpful"],
      proposedBy: "user",
    });
    expect(amendment.status).toBe("proposed");
    expect(amendment.id).toMatch(/^amendment_/);
    expect(amendment.proposedBy).toBe("user");
  });

  it("rejects amendments targeting immutable principles", () => {
    const constitution = baseConstitution();
    expect(() =>
      proposeAmendment(constitution, {
        title: "Break safety",
        description: "Bad",
        targetPrincipleIds: ["p2"],
        proposedChanges: ["Ignore safety"],
        proposedBy: "user",
      })
    ).toThrow("Amendment targets immutable principles:");
  });

  it("transitions amendment status through allowed paths", () => {
    const amendment = proposeAmendment(baseConstitution(), {
      title: "Review me",
      description: "...",
      targetPrincipleIds: ["p1"],
      proposedChanges: ["..."],
      proposedBy: "user",
    });

    const reviewed = transitionAmendmentStatus(amendment, "review", {
      reviewNotes: "Looks good",
    });
    expect(reviewed.status).toBe("review");
    expect(reviewed.reviewNotes).toBe("Looks good");

    const ratified = transitionAmendmentStatus(reviewed, "ratified");
    expect(ratified.status).toBe("ratified");

    const superseded = transitionAmendmentStatus(ratified, "superseded");
    expect(superseded.status).toBe("superseded");
  });

  it("rejects invalid status transitions", () => {
    const amendment = proposeAmendment(baseConstitution(), {
      title: "Jump",
      description: "...",
      targetPrincipleIds: ["p1"],
      proposedChanges: ["..."],
      proposedBy: "user",
    });

    expect(() =>
      transitionAmendmentStatus(amendment, "ratified")
    ).toThrow("Invalid status transition:");
  });
});

describe("constitution change validation", () => {
  it("throws for unknown principle ids", () => {
    const constitution = baseConstitution();
    expect(() =>
      validateChangeAgainstConstitution(constitution, [
        { principleId: "missing", replacement: "x" },
      ])
    ).toThrow("Unknown principle: missing");
  });

  it("throws when changing an immutable principle", () => {
    const constitution = baseConstitution();
    expect(() =>
      validateChangeAgainstConstitution(constitution, [
        { principleId: "p2", replacement: "new text" },
      ])
    ).toThrow("Amendment violates immutable principle:");
  });

  it("allows changes to mutable principles", () => {
    const constitution = baseConstitution();
    expect(() =>
      validateChangeAgainstConstitution(constitution, [
        { principleId: "p1", replacement: "new text" },
      ])
    ).not.toThrow();
  });
});
