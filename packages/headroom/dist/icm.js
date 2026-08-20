import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
const DEFAULT_STAGES = [10, 20, 30, 40, 50];
const STATE_FILES = ["status.json", "todos.json", "risks.json", "metrics.json"];
function normalizeStage(stage) {
    return String(stage).padStart(2, "0");
}
function writeTextFile(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
}
export function buildIcmCampaign(input) {
    const root = input.root;
    const id = input.id ?? `camp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const stages = input.stages ?? DEFAULT_STAGES;
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, "stages"), { recursive: true });
    mkdirSync(join(root, "contracts"), { recursive: true });
    mkdirSync(join(root, "state"), { recursive: true });
    mkdirSync(join(root, "artifacts"), { recursive: true });
    writeTextFile(join(root, "GOAL.md"), input.goal ? `# Goal\n\n${input.goal}\n` : "# Goal\n\n");
    writeTextFile(join(root, "NON_GOALS.md"), "# Non-Goals\n\n");
    writeTextFile(join(root, "ASSUMPTIONS.md"), "# Assumptions\n\n");
    writeTextFile(join(root, "README.md"), `# Campaign\n\nID: ${id}\n\nStages: ${stages.map(normalizeStage).join(", ")}\n`);
    const stageSummaries = [];
    for (const stage of stages) {
        const stageString = normalizeStage(stage);
        const stageDir = join(root, "stages", stageString);
        mkdirSync(stageDir, { recursive: true });
        writeTextFile(join(stageDir, "README.md"), `# Stage ${stage}\n\n`);
        writeTextFile(join(stageDir, "CONTRACT.md"), `# Stage ${stage} Contract\n\n`);
        writeTextFile(join(stageDir, "TASKS.md"), `# Stage ${stage} Tasks\n\n- [ ] \n`);
        stageSummaries.push({ stage: stageString, dir: stageDir });
    }
    writeTextFile(join(root, "contracts", "campaign.json"), JSON.stringify({
        id,
        stages: stageSummaries.map((item) => ({
            stage: item.stage,
            path: join("stages", item.stage),
            files: ["README.md", "CONTRACT.md", "TASKS.md"],
        })),
    }, null, 2));
    for (const file of STATE_FILES) {
        writeTextFile(join(root, "state", file), "{}");
    }
    const walkTest = runWalkTest(root);
    return { root, id, stages: stages.map(normalizeStage), walkTest };
}
export function runWalkTest(root) {
    const required = [
        "GOAL.md",
        "NON_GOALS.md",
        "ASSUMPTIONS.md",
        "README.md",
        "contracts/campaign.json",
        "state/status.json",
        "state/todos.json",
        "state/risks.json",
        "state/metrics.json",
    ];
    const missing = [];
    const readableStateFiles = [];
    for (const file of required) {
        const path = join(root, file);
        if (!existsSync(path)) {
            missing.push(file);
            continue;
        }
        try {
            const content = readFileSync(path, "utf8");
            if (file.startsWith("state/")) {
                readableStateFiles.push(file);
            }
        }
        catch {
            missing.push(file);
        }
    }
    const stageDirsExist = existsSync(join(root, "stages"));
    const orientable = missing.length === 0 && stageDirsExist;
    const reportPath = join(root, "artifacts", "walk-test-report.md");
    const reportLines = [
        "# Walk Test Report",
        "",
        `Root: ${root}`,
        `Orientable: ${orientable}`,
        "",
        "## Readable State Files",
        readableStateFiles.length
            ? readableStateFiles.map((file) => `- ${file}`).join("\n")
            : "- none",
        "",
        "## Missing",
        missing.length ? missing.map((file) => `- ${file}`).join("\n") : "- none",
        "",
    ];
    writeTextFile(reportPath, reportLines.join("\n"));
    return {
        orientable,
        readableStateFiles,
        missing,
        reportPath,
    };
}
//# sourceMappingURL=icm.js.map