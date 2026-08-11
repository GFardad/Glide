import { describe, it, expect, beforeEach } from "vitest";
import {
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createCampaign } from "../packages/core/src/campaign/index.js";
import { glidePlanTool } from "../packages/mcp-server/src/tools/glide-plan.js";

describe("glide_plan tool", () => {
  const tmpRoot = "/tmp/glide-plan-test";

  beforeEach(() => {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true });
    mkdirSync(tmpRoot, { recursive: true });
  });

  it("creates a plan artifact inside the campaign plan dir", async () => {
    const root = join(tmpRoot, "campaign");
    createCampaign(root, "Plan CLI", [], []);
    const result = await glidePlanTool.handler({
      campaign_dir: root,
      epic: "Epic One",
      summary: "Build a CLI",
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tool).toBe("glide_plan");
    expect(existsSync(parsed.path)).toBe(true);
    expect(parsed.path).toContain(join(root, "plan"));
  });

  it("rejects missing required fields", async () => {
    await expect(() =>
      glidePlanTool.handler({ campaign_dir: "", epic: "" })
    ).rejects.toThrow("campaign_dir and epic are required");
  });

  it("builds the program tree from headroom artifacts and returns tree + parent-only summary", async () => {
    const root = join(tmpRoot, "campaign-tree");
    createCampaign(root, "Plan CLI", [], []);
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeFileSync(
      join(root, "artifacts", "todo_registry.md"),
      [
        "# Todo Registry",
        "",
        "## Epic",
        "",
        "- Ship the CLI",
        "",
        "## Tasks",
        "",
        "- [ ] Architect: Finalize package boundary map",
        "- [ ] Engineer: Wire retry/backoff in execution backend",
        "",
      ].join("\n"),
      "utf8"
    );
    writeFileSync(
      join(root, "artifacts", "role_analysis.json"),
      JSON.stringify({
        Architect: {
          assessment: "Accepted",
          signals: [],
          risks: [],
          improvements: [],
          todos: ["Finalize package boundary map"],
        },
        Engineer: {
          assessment: "Accepted",
          signals: [],
          risks: [],
          improvements: [],
          todos: ["Wire retry/backoff in execution backend"],
        },
      }),
      "utf8"
    );

    const result = await glidePlanTool.handler({
      campaign_dir: root,
      epic: "Epic CLI",
      summary: "Deliver the CLI",
      teams: ["Architecture", "Backend"],
      agents: ["Ada", "Grace"],
    });
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);

    expect(parsed.ok).toBe(true);
    expect(parsed.tree.epic.name).toBe("Epic CLI");
    expect(parsed.tree.epic.teams.map((t: { name: string }) => t.name)).toEqual(
      ["Architecture", "Backend"]
    );
    // Every task is assigned to an agent in the full tree.
    const agents = parsed.tree.epic.teams.flatMap(
      (t: { agents: { tasks: { title: string }[] }[] }) => t.agents
    );
    const tasks = agents.flatMap(
      (a: { tasks: { title: string }[] }) => a.tasks
    );
    expect(tasks.map((t: { title: string }) => t.title)).toContain(
      "Finalize package boundary map"
    );

    // Parent-only summary: epic-level team views carry no agents; team views
    // carry agent summaries only (no task details anywhere).
    expect(parsed.summary.epic.team_count).toBe(2);
    const summaryText = JSON.stringify(parsed.summary);
    expect(summaryText).not.toContain("Finalize package boundary map");
    expect(summaryText).not.toContain("retry/backoff");
    expect(parsed.summary.epic.teams[0]).not.toHaveProperty("agents");
    expect(parsed.summary.epic.teams[0]).not.toHaveProperty("tasks");
    expect(parsed.summary.teams[0].agents[0]).not.toHaveProperty("tasks");

    // The structured plan artifact contains the full tree and summary view.
    expect(existsSync(parsed.path)).toBe(true);
    const artifact = readFileSync(parsed.path, "utf8");
    expect(artifact).toContain("## Teams & Agents");
    expect(artifact).toContain("## Parent Summary View");
    expect(artifact).toContain("Finalize package boundary map");
  });
});
