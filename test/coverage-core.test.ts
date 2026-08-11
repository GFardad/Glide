import { describe, it, expect } from "vitest";
import {
  GlideError,
  CampaignNotFoundError,
  PermissionDeniedError,
  AgentNotFoundError,
} from "../packages/core/src/errors/index.js";
// Importing the barrel executes the re-export chain so v8 coverage sees it.
import * as coreIndex from "../packages/core/src/index.js";

/**
 * Coverage gap tests for packages/core/src/errors and the package barrel.
 */
describe("core errors", () => {
  it("GlideError carries a code and name", () => {
    const error = new GlideError("something failed", "GLIDE_FAIL");
    expect(error.message).toBe("something failed");
    expect(error.code).toBe("GLIDE_FAIL");
    expect(error.name).toBe("GlideError");
    expect(error instanceof Error).toBe(true);
  });

  it("CampaignNotFoundError formats message and code", () => {
    const error = new CampaignNotFoundError("camp-123");
    expect(error.message).toBe("Campaign not found: camp-123");
    expect(error.code).toBe("CAMPAIGN_NOT_FOUND");
    expect(error).toBeInstanceOf(GlideError);
  });

  it("PermissionDeniedError formats message and code", () => {
    const error = new PermissionDeniedError("agent-9", "exec");
    expect(error.message).toBe("Agent agent-9 denied permission: exec");
    expect(error.code).toBe("PERMISSION_DENIED");
    expect(error).toBeInstanceOf(GlideError);
  });

  it("AgentNotFoundError formats message and code", () => {
    const error = new AgentNotFoundError("ghost");
    expect(error.message).toBe("Agent not found: ghost");
    expect(error.code).toBe("AGENT_NOT_FOUND");
    expect(error).toBeInstanceOf(GlideError);
  });
});

describe("core barrel", () => {
  it("exposes errors and campaign APIs", () => {
    expect(coreIndex.GlideError).toBeDefined();
    expect(coreIndex.CampaignNotFoundError).toBeDefined();
    expect(coreIndex.createCampaign).toBeDefined();
    expect(coreIndex.loadCampaign).toBeDefined();
  });
});
