export class GlideError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "GlideError";
    }
}
export class CampaignNotFoundError extends GlideError {
    constructor(campaignId) {
        super(`Campaign not found: ${campaignId}`, "CAMPAIGN_NOT_FOUND");
    }
}
export class PermissionDeniedError extends GlideError {
    constructor(agentId, permission) {
        super(`Agent ${agentId} denied permission: ${permission}`, "PERMISSION_DENIED");
    }
}
export class AgentNotFoundError extends GlideError {
    constructor(agentId) {
        super(`Agent not found: ${agentId}`, "AGENT_NOT_FOUND");
    }
}
export class PathTraversalError extends GlideError {
    constructor(requested, root) {
        super(`Path traversal detected: requested="${requested}" is outside root="${root}"`, "PATH_TRAVERSAL");
    }
}
export class CampaignSchemaError extends GlideError {
    constructor(message, cause) {
        super(message, "CAMPAIGN_SCHEMA_ERROR");
        this.cause = cause;
    }
}
export class TeamSchemaError extends GlideError {
    constructor(message, cause) {
        super(message, "TEAM_SCHEMA_ERROR");
        this.cause = cause;
    }
}
export class AgentSchemaError extends GlideError {
    constructor(message, cause) {
        super(message, "AGENT_SCHEMA_ERROR");
        this.cause = cause;
    }
}
export class ConstitutionSchemaError extends GlideError {
    constructor(message, cause) {
        super(message, "CONSTITUTION_SCHEMA_ERROR");
        this.cause = cause;
    }
}
//# sourceMappingURL=index.js.map