export interface GateResult {
    name: string;
    passed: boolean;
    detail: string;
    severity: "error" | "warn" | "info";
}
export interface GateReport {
    workspace: string;
    passed: boolean;
    results: GateResult[];
}
export interface Gate {
    name?: string;
    handler: (ctx: {
        workspace: string;
        plan?: string;
        tasks?: string[];
    }) => GateResult;
}
export declare class GateEngine {
    private readonly workspace;
    constructor(workspace: string);
    run(gates: Gate[]): GateReport;
}
export declare function runGates(workspace: string, gates: Gate[]): GateReport;
export declare function computeReport(workspace: string, results: GateResult[]): GateReport;
export declare const specPlanAlignmentGate: Gate;
export declare const planTaskCoverageGate: Gate;
export declare const testPresenceGate: Gate;
export declare const typecheckGate: Gate;
export declare const lintGate: Gate;
export declare const buildGate: Gate;
export declare const DEFAULT_GATES: Gate[];
export declare class GateLifecycle {
    private readonly engine;
    constructor(workspace: string);
    run(gates?: Gate[]): GateReport;
}
/**
 * @deprecated Prefer instantiating `new GateLifecycle(workspace)`.
 */
export declare function createDefaultGateEngine(workspace: string): GateLifecycle;
//# sourceMappingURL=gates.d.ts.map