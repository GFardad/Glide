import { describe, it, expect } from "vitest";
import {
  createSubject,
  authorize,
} from "../packages/permissions/src/runtime.js";

describe("permissions runtime", () => {
  it("authorizes supported actions", () => {
    const subject = createSubject("Engineer", ["read", "write"]);
    expect(
      authorize(subject, { action: "write", resource: "artifact" }).ok
    ).toBe(true);
  });

  it("rejects actions without matching scope", () => {
    const subject = createSubject("Engineer", ["read"]);
    expect(
      authorize(subject, { action: "review", resource: "artifact" }).ok
    ).toBe(false);
  });

  it("rejects malformed actions", () => {
    const subject = createSubject("Engineer", ["read"]);
    expect(authorize(subject, { action: "", resource: "" }).ok).toBe(false);
  });

  it("requires secrets scope for secret resources", () => {
    const subject = createSubject("Operator", ["read"]);
    expect(authorize(subject, { action: "read", resource: "secrets" }).ok).toBe(
      false
    );
  });

  it("rejects subjects with empty scopes", () => {
    const subject = createSubject("Guest", []);
    expect(
      authorize(subject, { action: "read", resource: "artifact" }).ok
    ).toBe(false);
  });
});
