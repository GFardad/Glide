export class GlideError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "GlideError";
  }
}

export class CampaignNotFoundError extends GlideError {
  constructor(campaignId: string) {
    super(`Campaign not found: ${campaignId}`, "CAMPAIGN_NOT_FOUND");
  }
}

export class PermissionDeniedError extends GlideError {
  constructor(agentId: string, permission: string) {
    super(
      `Agent ${agentId} denied permission: ${permission}`,
      "PERMISSION_DENIED"
    );
  }
}

export class AgentNotFoundError extends GlideError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, "AGENT_NOT_FOUND");
  }
}
