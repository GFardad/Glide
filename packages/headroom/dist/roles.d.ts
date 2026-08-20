export interface RoleAnalysis {
    [role: string]: {
        assessment: string;
        signals: string[];
        risks: string[];
        improvements: string[];
        todos: string[];
    };
}
export declare function runRoleAnalysis(objective: string, roles: string[], campaignDir: string): Promise<RoleAnalysis>;
//# sourceMappingURL=roles.d.ts.map