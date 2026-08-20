import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFileSync } from "../io/atomic-write.js";
import { AgentSchemaError } from "../errors/index.js";
const REQUIRED_AGENT_FILES = [
    "PERSONALITY.md",
    "GOAL.md",
    "NOTES.md",
    "TODO.md",
    "REJECTED.md",
    "contract.json",
];
export function agentDir(workspace, agentId) {
    return join(workspace, "teams", agentId, "agents", agentId);
}
export function agentFilePath(workspace, agentId, file) {
    return join(agentDir(workspace, agentId), file);
}
export function validateAgentDirectory(workspace, agentId) {
    const dir = agentDir(workspace, agentId);
    const missing = [];
    const incomplete = [];
    for (const file of REQUIRED_AGENT_FILES) {
        const path = join(dir, file);
        if (!existsSync(path)) {
            missing.push(file);
            continue;
        }
        const content = readFileSync(path, "utf8");
        if (file === "contract.json") {
            try {
                z.object({
                    agentId: z.string().min(1),
                    teamId: z.string().optional(),
                    sessionId: z.string().min(1),
                    createdAt: z.string().datetime(),
                    updatedAt: z.string().datetime(),
                }).parse(JSON.parse(content));
            }
            catch (error) {
                incomplete.push(`contract.json: ${error.message}`);
            }
        }
    }
    if (missing.length > 0 || incomplete.length > 0) {
        throw new AgentSchemaError(`Agent directory invalid: missing=[${missing.join(", ")}] incomplete=[${incomplete.join(", ")}]`, missing.length > 0 ? new Error("missing files") : undefined);
    }
}
export function ensureAgentFiles(workspace, agent) {
    const dir = agentDir(workspace, agent.agentId);
    mkdirSync(dir, { recursive: true });
    const files = REQUIRED_AGENT_FILES;
    for (const file of files) {
        const path = join(dir, file);
        if (!existsSync(path)) {
            writeFileSync(path, defaultFileContent(file, agent));
        }
    }
}
export function loadAgentDirectory(workspace, agentId) {
    const dir = agentDir(workspace, agentId);
    const files = {
        personality: readFileSync(join(dir, "PERSONALITY.md"), "utf8"),
        goal: readFileSync(join(dir, "GOAL.md"), "utf8"),
        notes: readFileSync(join(dir, "NOTES.md"), "utf8"),
        todos: readFileSync(join(dir, "TODO.md"), "utf8"),
        rejected: readFileSync(join(dir, "REJECTED.md"), "utf8"),
        contract: readFileSync(join(dir, "contract.json"), "utf8"),
    };
    return { path: dir, files };
}
export function createAgentFileContract(workspace, agent) {
    ensureAgentFiles(workspace, agent);
    const dir = agentDir(workspace, agent.agentId);
    const contract = {
        agentId: agent.agentId,
        teamId: agent.teamId,
        sessionId: agent.sessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    atomicWriteFileSync(join(dir, "contract.json"), JSON.stringify(contract, null, 2));
    return loadAgentDirectory(workspace, agent.agentId).files;
}
export function listAgentDirectories(workspace) {
    const teamsDir = join(workspace, "teams");
    if (!existsSync(teamsDir))
        return [];
    return readdirSync(teamsDir).flatMap((team) => {
        const agentsDir = join(teamsDir, team, "agents");
        if (!existsSync(agentsDir))
            return [];
        return readdirSync(agentsDir).filter((entry) => {
            const full = join(agentsDir, entry);
            return existsSync(full) && REQUIRED_AGENT_FILES.every((file) => existsSync(join(full, file)));
        });
    });
}
export function cleanupAgentDirectory(workspace, agentId) {
    const dir = agentDir(workspace, agentId);
    if (existsSync(dir))
        rmSync(dir, { recursive: true, force: true });
}
function defaultFileContent(file, agent) {
    switch (file) {
        case "PERSONALITY.md":
            return `# Personality\n\nAgent: ${agent.agentId}\nSession: ${agent.sessionId}\nTeam: ${agent.teamId ?? "none"}\nParent: ${agent.parentId ?? "none"}\n\n## Behavior\n- Produce concise, actionable outputs.\n- Write failures and blockers to NOTES.md.\n- Append completed todos with timestamps.\n`;
        case "GOAL.md":
            return `# Goal\n\nAgent: ${agent.agentId}\nSession: ${agent.sessionId}\nTeam: ${agent.teamId ?? "none"}\nParent: ${agent.parentId ?? "none"}\n\n## Objective\nTBD\n\n## Acceptance Criteria\n- Deliver notes and todos through runtime interfaces.\n- Do not access internal state of other agents.\n`;
        case "NOTES.md":
            return "# Notes\n\n";
        case "TODO.md":
            return "# TODO\n\n";
        case "REJECTED.md":
            return "# Rejected\n\n";
        case "contract.json":
            return JSON.stringify({
                agentId: agent.agentId,
                teamId: agent.teamId,
                sessionId: agent.sessionId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }, null, 2);
        default:
            return "";
    }
}
//# sourceMappingURL=agent-fs.js.map