import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// ---------------------------------------------------------------------------
// Artifact loaders
// ---------------------------------------------------------------------------
export function loadTodoRegistry(campaignDir) {
    const path = join(campaignDir, "artifacts", "todo_registry.md");
    if (!existsSync(path))
        return { epicName: "", tasks: [] };
    const lines = readFileSync(path, "utf8").split("\n");
    let section = "";
    let epicName = "";
    const tasks = [];
    const taskRe = /^\s*-\s*\[([ xX])\]\s*([^:]+):\s*(.+)\s*$/;
    for (const raw of lines) {
        const line = raw.trim();
        const heading = line.match(/^##\s+(.+)$/);
        if (heading) {
            section = heading[1].toLowerCase();
            continue;
        }
        if (section === "epic" && line.startsWith("-") && epicName.length === 0) {
            epicName = line.replace(/^-\s*/, "").trim();
            continue;
        }
        if (section === "tasks" || section === "todo") {
            const match = line.match(taskRe);
            if (match) {
                tasks.push({
                    id: `task-${tasks.length + 1}`,
                    role: match[2].trim(),
                    title: match[3].trim(),
                    status: match[1].toLowerCase() === "x" ? "done" : "open",
                });
            }
        }
    }
    return { epicName, tasks };
}
export function loadRoleAnalysis(campaignDir) {
    const path = join(campaignDir, "artifacts", "role_analysis.json");
    if (!existsSync(path))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (parsed === null ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)) {
            return {};
        }
        return parsed;
    }
    catch {
        return {};
    }
}
// ---------------------------------------------------------------------------
// Summary helpers (parents see only these strings, never task details)
// ---------------------------------------------------------------------------
export function summarizeAgentTasks(tasks, isLead = false) {
    if (isLead)
        return "Team lead (coordinates the team)";
    if (tasks.length === 0)
        return "No tasks assigned";
    return `${tasks.length} task${tasks.length === 1 ? "" : "s"} assigned`;
}
export function summarizeTeam(agents) {
    const tasks = agents.reduce((count, agent) => count + agent.tasks.length, 0);
    return `${agents.length} agent${agents.length === 1 ? "" : "s"}, ${tasks} task${tasks === 1 ? "" : "s"} total`;
}
export function summarizeEpic(teams) {
    const agents = teams.reduce((count, team) => count + team.agents.length, 0);
    const tasks = teams.reduce((count, team) => count + team.agents.reduce((c, agent) => c + agent.tasks.length, 0), 0);
    return `${teams.length} team${teams.length === 1 ? "" : "s"}, ${agents} agent${agents === 1 ? "" : "s"}, ${tasks} task${tasks === 1 ? "" : "s"} total`;
}
// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------
function slugify(value) {
    const slug = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : "item";
}
export function buildProgramTree(options) {
    const { campaignDir } = options;
    const teamNames = (options.teams ?? []).map((name) => name.trim());
    const agentNames = (options.agents ?? [])
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
    const registry = loadTodoRegistry(campaignDir);
    const roleAnalysis = loadRoleAnalysis(campaignDir);
    const epicName = options.epicName?.trim() || registry.epicName || "Unnamed Epic";
    const epicId = `epic-${slugify(epicName)}`;
    // Role order: registry appearance first, then remaining analysis roles.
    const orderedRoles = [];
    for (const task of registry.tasks) {
        if (!orderedRoles.includes(task.role))
            orderedRoles.push(task.role);
    }
    for (const role of Object.keys(roleAnalysis)) {
        if (!orderedRoles.includes(role))
            orderedRoles.push(role);
    }
    const tasksByRole = new Map();
    for (const task of registry.tasks) {
        const list = tasksByRole.get(task.role) ?? [];
        list.push(task);
        tasksByRole.set(task.role, list);
    }
    // With explicit agent names, agents are bound to teams round-robin
    // (agent i -> team i % teamCount); each team's tasks are then distributed
    // round-robin across the agents assigned to that team. Every agent belongs
    // to exactly one team.
    const teamAgentNames = new Map();
    if (agentNames.length > 0 && orderedRoles.length > 0) {
        agentNames.forEach((name, index) => {
            const teamIndex = index % orderedRoles.length;
            const list = teamAgentNames.get(teamIndex) ?? [];
            list.push(name);
            teamAgentNames.set(teamIndex, list);
        });
    }
    const teams = [];
    for (let index = 0; index < orderedRoles.length; index++) {
        const role = orderedRoles[index];
        const fallbackName = `${role} Team`;
        const teamName = teamNames[index] ?? fallbackName;
        const teamId = `team-${slugify(teamName)}`;
        const roleTasks = tasksByRole.get(role) ?? [];
        const leadId = `agent-${slugify(teamName)}-lead`;
        const lead = {
            kind: "agent",
            id: leadId,
            name: `${role} Lead`,
            role,
            teamId,
            parentId: teamId,
            summary: summarizeAgentTasks([], true),
            tasks: [],
        };
        let workers;
        if (teamAgentNames.size > 0) {
            const names = teamAgentNames.get(index) ?? [];
            workers = names.map((name, workerIndex) => {
                const tasks = roleTasks.filter((_, taskIndex) => taskIndex % names.length === workerIndex);
                return {
                    kind: "agent",
                    id: `agent-${slugify(name)}`,
                    name,
                    role,
                    teamId,
                    parentId: teamId,
                    summary: summarizeAgentTasks(tasks),
                    tasks,
                };
            });
        }
        else {
            workers = roleTasks.map((task, workerIndex) => ({
                kind: "agent",
                id: `agent-${slugify(teamName)}-${workerIndex + 1}`,
                name: `${role} Agent ${workerIndex + 1}`,
                role,
                teamId,
                parentId: teamId,
                summary: summarizeAgentTasks([task]),
                tasks: [task],
            }));
        }
        const agents = [lead, ...workers];
        teams.push({
            kind: "team",
            id: teamId,
            name: teamName,
            lead: leadId,
            parentId: epicId,
            summary: summarizeTeam(agents),
            agents,
        });
    }
    const epic = {
        kind: "epic",
        id: epicId,
        name: epicName,
        parentId: null,
        summary: options.epicSummary?.trim() || summarizeEpic(teams),
        teams,
    };
    const nodes = [epic];
    for (const team of teams) {
        nodes.push(team);
        nodes.push(...team.agents);
    }
    return {
        epic,
        nodes,
        summary: summarizeProgram(epic),
    };
}
/**
 * Builds the parent-only summary view. Parents see child summaries only:
 * the epic view carries team summaries, team views carry agent summaries,
 * and no view contains task bodies.
 */
export function summarizeProgram(epic) {
    const teams = epic.teams.map((team) => ({
        id: team.id,
        name: team.name,
        lead: team.lead,
        summary: team.summary,
        agent_count: team.agents.length,
        agents: team.agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            summary: agent.summary,
        })),
    }));
    return {
        epic: {
            id: epic.id,
            name: epic.name,
            summary: epic.summary,
            team_count: epic.teams.length,
            teams: epic.teams.map((team) => ({
                id: team.id,
                name: team.name,
                lead: team.lead,
                summary: team.summary,
                agent_count: team.agents.length,
            })),
        },
        teams,
    };
}
// ---------------------------------------------------------------------------
// Markdown rendering (for the structured plan artifact)
// ---------------------------------------------------------------------------
/** Renders the full tree followed by the parent-only summary view. */
export function renderProgramMarkdown(tree) {
    const lines = ["# Plan"];
    lines.push("", "## Epic", "");
    lines.push(`- Name: ${tree.epic.name}`);
    lines.push(`- ID: ${tree.epic.id}`);
    lines.push(`- Summary: ${tree.epic.summary}`);
    lines.push("", "## Teams & Agents", "");
    if (tree.epic.teams.length === 0) {
        lines.push("- No teams assigned yet.");
    }
    for (const team of tree.epic.teams) {
        lines.push(`### ${team.name} (${team.id})`, "");
        lines.push(`- Lead: ${team.lead}`);
        lines.push(`- Summary: ${team.summary}`, "");
        for (const agent of team.agents) {
            lines.push(`#### ${agent.name} (${agent.id})`, "");
            lines.push(`- Role: ${agent.role}`);
            lines.push(`- Parent: ${agent.parentId}`);
            lines.push(`- Summary: ${agent.summary}`);
            if (agent.tasks.length > 0) {
                lines.push("- Tasks:");
                for (const task of agent.tasks) {
                    const marker = task.status === "done" ? "x" : " ";
                    lines.push(`  - [${marker}] ${task.title}`);
                }
            }
            lines.push("");
        }
    }
    lines.push("## Parent Summary View", "");
    lines.push(`### ${tree.epic.name} — sees team summaries only (${tree.epic.teams.length} team${tree.epic.teams.length === 1 ? "" : "s"})`, "");
    for (const teamView of tree.summary.epic.teams) {
        lines.push(`- ${teamView.name} (${teamView.id}): ${teamView.summary}`);
    }
    lines.push("");
    for (const team of tree.epic.teams) {
        lines.push(`### ${team.name} — sees agent summaries only (${team.agents.length} agent${team.agents.length === 1 ? "" : "s"})`, "");
        for (const agent of team.agents) {
            lines.push(`- ${agent.name}: ${agent.summary}`);
        }
        lines.push("");
    }
    return lines.join("\n");
}
//# sourceMappingURL=program.js.map