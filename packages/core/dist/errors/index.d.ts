export declare class GlideError extends Error {
    code: string;
    cause?: Error | undefined;
    constructor(message: string, code: string, cause?: Error | undefined);
}
export declare class CampaignNotFoundError extends GlideError {
    constructor(campaignId: string);
}
export declare class PermissionDeniedError extends GlideError {
    constructor(agentId: string, permission: string);
}
export declare class AgentNotFoundError extends GlideError {
    constructor(agentId: string);
}
export declare class PathTraversalError extends GlideError {
    constructor(requested: string, root: string);
}
export declare class CampaignSchemaError extends GlideError {
    constructor(message: string, cause?: Error);
}
export declare class TeamSchemaError extends GlideError {
    constructor(message: string, cause?: Error);
}
export declare class AgentSchemaError extends GlideError {
    constructor(message: string, cause?: Error);
}
export declare class ConstitutionSchemaError extends GlideError {
    constructor(message: string, cause?: Error);
}
//# sourceMappingURL=index.d.ts.map