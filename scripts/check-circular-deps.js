import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { default: madge } = await import("madge");

const packagesDir = join(process.cwd(), "packages");
const entries = readdirSync(packagesDir);
const packageDirs = entries.filter((entry) =>
  statSync(join(packagesDir, entry)).isDirectory()
);

let failed = false;

for (const dir of packageDirs) {
  const packageDir = join(packagesDir, dir);
  const result = await madge(packageDir, {
    fileExtensions: ["ts", "tsx"],
  });

  const circular = result.circular();

  if (circular.length > 0) {
    process.stderr.write(`\n[FAIL] Circular dependencies detected in ${dir}\n`);
    for (const cycle of circular) {
      process.stderr.write(`  ${cycle.join(" -> ")}\n`);
    }
    failed = true;
  } else {
    process.stdout.write(`[OK] ${dir}: no circular dependencies\n`);
  }
}

if (failed) {
  process.stderr.write("\nCircular dependency check failed.\n");
  process.exit(1);
}

process.stdout.write("\nNo circular dependencies detected.\n");
