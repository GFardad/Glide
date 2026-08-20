/**
 * Program management tree: Epic -> Team -> Agent.
 *
 * Layer 2 of Glide (CTO-owned). The tree is built deterministically from
 * headroom artifacts:
 *   - <campaign_dir>/artifacts/todo_registry.md   (tasks, epic name)
 *   - <campaign_dir>/artifacts/role_analysis.json (roles, assessments)
 *
 * Decomposition rules:
 *   - One team per role (Architect team, Engineer team, ...).
 *   - Every team gets a lead agent (Team Lead).
 *   - Each task is assigned to exactly one agent; by default one worker
 *     agent per task, or distributed round-robin over explicit agent names.
 *   - Parent-child relationships: epic -> team -> agent.
 *
 * Summary semantics: parents see only child summaries. The epic never sees
 * task bodies; a team view only shows agent-level summaries.
 */
export type ProgramNodeKind = "epic" | "team" | "agent";
export interface ProgramTask {
    id: string;
    title: string;
    role: string;
    status: "open" | "done";
}
export interface ProgramAgent {
    kind: "agent";
    id: string;
    name: string;
    role: string;
    teamId: string;
    parentId: string;
    /** Terse summary of the agent's assigned work (not full context). */
    summary: string;
    tasks: ProgramTask[];
}
export interface ProgramTeam {
    kind: "team";
    id: string;
    name: string;
    lead: string;
    parentId: string;
    /** Terse summary of the team (member/task counts). */
    summary: string;
    agents: ProgramAgent[];
}
export interface ProgramEpic {
    kind: "epic";
    id: string;
    name: string;
    parentId: null;
    /** Terse summary of the epic (team/agent/task counts). */
    summary: string;
    teams: ProgramTeam[];
}
export type ProgramNode = ProgramEpic | ProgramTeam | ProgramAgent;
/** A parent-only view of an agent: identity + summary, no task details. */
export interface ProgramAgentSummaryView {
    id: string;
    name: string;
    role: string;
    summary: string;
}
/** A parent-only view of a team: identity + summary, no agent details. */
export interface ProgramTeamSummaryView {
    id: string;
    name: string;
    lead: string;
    summary: string;
    agent_count: number;
}
/** Parent-only summary over the whole tree. */
export interface ProgramSummary {
    epic: {
        id: string;
        name: string;
        summary: string;
        team_count: number;
        teams: ProgramTeamSummaryView[];
    };
    teams: Array<{
        id: string;
        name: string;
        lead: string;
        summary: string;
        agent_count: number;
        agents: ProgramAgentSummaryView[];
    }>;
}
export interface ProgramTree {
    epic: ProgramEpic;
    /** Flat list of every node, roots first. */
    nodes: ProgramNode[];
    /** Parent-only summary view (epic sees team summaries; teams see agent summaries). */
    summary: ProgramSummary;
}
export interface ProgramTreeOptions {
    /** Campaign directory containing artifacts/ (todo_registry.md, role_analysis.json). */
    campaignDir: string;
    /** Fallback epic name when the registry has no epic line. */
    epicName?: string;
    /** Free-form epic summary shown to parents. */
    epicSummary?: string;
    /** Optional team names; replaces generated "<Role> Team" names positionally. */
    teams?: string[];
    /** Optional agent names; tasks are distributed round-robin across them. */
    agents?: string[];
}
export interface RoleAnalysisEntry {
    assessment?: string;
    signals?: string[];
    risks?: string[];
    improvements?: string[];
    todos?: string[];
}
export type RoleAnalysis = Record<string, RoleAnalysisEntry>;
export interface TodoRegistryData {
    epicName: string;
    tasks: ProgramTask[];
}
export declare function loadTodoRegistry(campaignDir: string): TodoRegistryData;
export declare function loadRoleAnalysis(campaignDir: string): RoleAnalysis;
export declare function summarizeAgentTasks(tasks: ProgramTask[], isLead?: boolean): string;
export declare function summarizeTeam(agents: ProgramAgent[]): string;
export declare function summarizeEpic(teams: ProgramTeam[]): string;
export declare function buildProgramTree(options: ProgramTreeOptions): ProgramTree;
/**
 * Builds the parent-only summary view. Parents see child summaries only:
 * the epic view carries team summaries, team views carry agent summaries,
 * and no view contains task bodies.
 */
export declare function summarizeProgram(epic: ProgramEpic): ProgramSummary;
/** Renders the full tree followed by the parent-only summary view. */
export declare function renderProgramMarkdown(tree: ProgramTree): string;
//# sourceMappingURL=program.d.ts.map