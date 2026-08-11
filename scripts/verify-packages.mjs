import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const packagesDir = join(process.cwd(), "packages");
const entries = readdirSync(packagesDir);
const packageDirs = entries.filter((entry) =>
  statSync(join(packagesDir, entry)).isDirectory()
);

const phases = [
  { name: "typecheck", command: "pnpm typecheck" },
  { name: "lint", command: "pnpm lint" },
  { name: "build", command: "pnpm build" },
  { name: "test", command: "pnpm test -- --coverage" },
];

for (const dir of packageDirs) {
  process.stdout.write(`\n=== ${dir} ===\n`);
  const packageDir = join(packagesDir, dir);
  const packageJsonPath = join(packageDir, "package.json");
  let scripts = {};
  try {
    const raw = readFileSync(packageJsonPath, "utf8");
    scripts = JSON.parse(raw).scripts || {};
  } catch (error) {
    process.stderr.write(`  [WARN] Skipping ${dir}: invalid package.json\n`);
    continue;
  }

  for (const phase of phases) {
    if (phase.name === "test") {
      try {
        execSync("pnpm test -- --coverage", {
          cwd: process.cwd(),
          stdio: "inherit",
        });
      } catch (error) {
        process.stderr.write(`\n[FAIL] ${dir} ${phase.name}\n`);
        process.exit(1);
      }
      continue;
    }

    if (scripts[phase.name]) {
      try {
        execSync(phase.command, { cwd: packageDir, stdio: "inherit" });
      } catch (error) {
        process.stderr.write(`\n[FAIL] ${dir} ${phase.name}\n`);
        process.exit(1);
      }
    } else {
      process.stdout.write(`  [SKIP] ${phase.name} (no script)\n`);
    }
  }
}
