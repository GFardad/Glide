export class GlideError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
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

export class PathTraversalError extends GlideError {
  constructor(requested: string, root: string) {
    super(
      `Path traversal detected: requested="${requested}" is outside root="${root}"`,
      "PATH_TRAVERSAL"
    );
  }
}

export class CampaignSchemaError extends GlideError {
  constructor(message: string, cause?: Error) {
    super(message, "CAMPAIGN_SCHEMA_ERROR");
    this.cause = cause;
  }
}

export class TeamSchemaError extends GlideError {
  constructor(message: string, cause?: Error) {
    super(message, "TEAM_SCHEMA_ERROR");
    this.cause = cause;
  }
}

export class AgentSchemaError extends GlideError {
  constructor(message: string, cause?: Error) {
    super(message, "AGENT_SCHEMA_ERROR");
    this.cause = cause;
  }
}

export class ConstitutionSchemaError extends GlideError {
  constructor(message: string, cause?: Error) {
    super(message, "CONSTITUTION_SCHEMA_ERROR");
    this.cause = cause;
  }
}
