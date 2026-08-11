import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProgramTree,
  summarizeProgram,
  renderProgramMarkdown,
  loadTodoRegistry,
  loadRoleAnalysis,
} from "../packages/executor/src/program.js";

const TODO_REGISTRY = [
  "# Todo Registry",
  "",
  "## Epic",
  "",
  "- Deliver the headroom platform",
  "",
  "## Tasks",
  "",
  "- [ ] Architect: Finalize package boundary map",
  "- [ ] Architect: Review dependency graph",
  "- [ ] Engineer: Wire retry/backoff in execution backend",
  "- [ ] QA: Add regression tests for drift detection",
  "- [x] Engineer: Add process lifecycle tests",
  "",
].join("\n");

const ROLE_ANALYSIS = {
  Architect: {
    assessment: "Accepted",
    signals: ["architecture"],
    risks: [],
    improvements: [],
    todos: ["Finalize package boundary map"],
  },
  Engineer: {
    assessment: "Accepted",
    signals: ["runtime"],
    risks: [],
    improvements: [],
    todos: ["Wire retry/backoff in execution backend"],
  },
  QA: {
    assessment: "Accepted",
    signals: ["test"],
    risks: [],
    improvements: [],
    todos: ["Add regression tests for drift detection"],
  },
};

function writeArtifacts(campaignDir: string): void {
  const artifactsDir = join(campaignDir, "artifacts");
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(join(artifactsDir, "todo_registry.md"), TODO_REGISTRY, "utf8");
  writeFileSync(
    join(artifactsDir, "role_analysis.json"),
    JSON.stringify(ROLE_ANALYSIS, null, 2),
    "utf8"
  );
}

describe("program tree (Epic -> Team -> Agent)", () => {
  const tmpRoot = "/tmp/glide-program-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("parses headroom artifacts", () => {
    const root = join(tmpRoot, "a1");
    writeArtifacts(root);

    const registry = loadTodoRegistry(root);
    expect(registry.epicName).toBe("Deliver the headroom platform");
    expect(registry.tasks).toHaveLength(5);
    expect(registry.tasks[0]).toMatchObject({
      id: "task-1",
      role: "Architect",
      title: "Finalize package boundary map",
      status: "open",
    });
    expect(registry.tasks[4]).toMatchObject({ status: "done" });

    const analysis = loadRoleAnalysis(root);
    expect(Object.keys(analysis).sort()).toEqual([
      "Architect",
      "Engineer",
      "QA",
    ]);
  });

  it("builds a tree with one team per role and parent-child links", () => {
    const root = join(tmpRoot, "a2");
    writeArtifacts(root);

    const tree = buildProgramTree({ campaignDir: root });

    expect(tree.epic.kind).toBe("epic");
    expect(tree.epic.name).toBe("Deliver the headroom platform");
    expect(tree.epic.parentId).toBeNull();

    const teamNames = tree.epic.teams.map((team) => team.name);
    expect(teamNames).toEqual(["Architect Team", "Engineer Team", "QA Team"]);

    const engineer = tree.epic.teams.find(
      (t) => t.id === "team-engineer-team"
    )!;
    expect(engineer.parentId).toBe(tree.epic.id);
    expect(engineer.lead).toBe("agent-engineer-team-lead");
    // Lead + one worker per Engineer task.
    expect(engineer.agents).toHaveLength(3);

    // Every agent points at its team; leads carry no tasks, workers carry one.
    for (const team of tree.epic.teams) {
      for (const agent of team.agents) {
        expect(agent.parentId).toBe(team.id);
        expect(agent.teamId).toBe(team.id);
      }
    }
    const lead = engineer.agents.find((a) => a.id === engineer.lead)!;
    expect(lead.tasks).toEqual([]);

    const worker = engineer.agents.find(
      (a) => a.id === "agent-engineer-team-1"
    )!;
    expect(worker.tasks).toHaveLength(1);
    expect(worker.tasks[0].title).toBe(
      "Wire retry/backoff in execution backend"
    );
  });

  it("assigns every task to exactly one agent", () => {
    const root = join(tmpRoot, "a3");
    writeArtifacts(root);

    const tree = buildProgramTree({ campaignDir: root });
    const allTasks = tree.nodes.flatMap((node) =>
      node.kind === "agent" ? node.tasks : []
    );
    expect(allTasks).toHaveLength(5);
    const ids = allTasks.map((task) => task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("parent-only summary hides task details", () => {
    const root = join(tmpRoot, "a4");
    writeArtifacts(root);

    const tree = buildProgramTree({ campaignDir: root });
    const summary = summarizeProgram(tree.epic);

    // Epic-level view: team summaries only, no agents, no tasks.
    expect(summary.epic.team_count).toBe(3);
    for (const teamView of summary.epic.teams) {
      expect(teamView).not.toHaveProperty("agents");
      expect(teamView).not.toHaveProperty("tasks");
      expect(Object.keys(teamView).sort()).toEqual([
        "agent_count",
        "id",
        "lead",
        "name",
        "summary",
      ]);
    }
    expect(JSON.stringify(summary)).not.toContain("Finalize package");

    // Team-level view: agent summaries only, no task bodies.
    const engineerView = summary.teams.find(
      (t) => t.id === "team-engineer-team"
    )!;
    expect(engineerView.agent_count).toBe(3);
    for (const agentView of engineerView.agents) {
      expect(Object.keys(agentView).sort()).toEqual([
        "id",
        "name",
        "role",
        "summary",
      ]);
    }
    expect(JSON.stringify(summary)).not.toContain("retry/backoff");

    // The full tree still carries task details.
    expect(JSON.stringify(tree)).toContain("Finalize package boundary map");
    expect(JSON.stringify(tree)).toContain("retry/backoff");
  });

  it("supports explicit team and agent names", () => {
    const root = join(tmpRoot, "a5");
    writeArtifacts(root);

    const tree = buildProgramTree({
      campaignDir: root,
      teams: ["Platform", "Execution"],
      agents: ["Ada", "Grace", "Linus"],
    });

    // First two role-teams get explicit names; third keeps the default.
    expect(tree.epic.teams.map((t) => t.name)).toEqual([
      "Platform",
      "Execution",
      "QA Team",
    ]);

    // Agents are bound to teams round-robin (Ada->Platform, Grace->Execution,
    // Linus->QA Team); each team's tasks go to its own agents.
    const ada = tree.nodes.find(
      (n) => n.kind === "agent" && n.id === "agent-ada"
    ) as
      { kind: "agent"; teamId: string; tasks: { title: string }[] } | undefined;
    expect(ada?.teamId).toBe("team-platform");
    expect(ada?.tasks.map((t) => t.title)).toEqual([
      "Finalize package boundary map",
      "Review dependency graph",
    ]);

    const grace = tree.nodes.find(
      (n) => n.kind === "agent" && n.id === "agent-grace"
    ) as
      { kind: "agent"; teamId: string; tasks: { title: string }[] } | undefined;
    expect(grace?.teamId).toBe("team-execution");
    expect(grace?.tasks.map((t) => t.title)).toEqual([
      "Wire retry/backoff in execution backend",
      "Add process lifecycle tests",
    ]);

    const linus = tree.nodes.find(
      (n) => n.kind === "agent" && n.id === "agent-linus"
    ) as
      { kind: "agent"; teamId: string; tasks: { title: string }[] } | undefined;
    expect(linus?.teamId).toBe("team-qa-team");
    expect(linus?.tasks.map((t) => t.title)).toEqual([
      "Add regression tests for drift detection",
    ]);

    // No agent is duplicated across teams.
    const ids = tree.nodes.filter((n) => n.kind === "agent").map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds an empty tree when artifacts are missing", () => {
    const root = join(tmpRoot, "a6");
    mkdirSync(root, { recursive: true });

    const tree = buildProgramTree({
      campaignDir: root,
      epicName: "Fallback Epic",
    });
    expect(tree.epic.name).toBe("Fallback Epic");
    expect(tree.epic.teams).toEqual([]);
    expect(tree.summary.epic.team_count).toBe(0);
  });

  it("renders full tree plus parent summary view as markdown", () => {
    const root = join(tmpRoot, "a7");
    writeArtifacts(root);

    const tree = buildProgramTree({ campaignDir: root });
    const md = renderProgramMarkdown(tree);

    expect(md).toContain("# Plan");
    expect(md).toContain("## Epic");
    expect(md).toContain("## Teams & Agents");
    expect(md).toContain("## Parent Summary View");
    // Full tree includes task details.
    expect(md).toContain("Finalize package boundary map");
    expect(md).toContain("## Parent Summary View");
    // Summary section contains only summaries, not task lines.
    const summarySection = md.split("## Parent Summary View")[1]!;
    expect(summarySection).not.toContain("[ ]");
    expect(summarySection).toContain("sees team summaries only");
    expect(summarySection).toContain("sees agent summaries only");
  });
});
