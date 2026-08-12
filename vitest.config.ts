import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    threads: true,
    coverage: {
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        "packages/*/src/cli/**",
        "packages/*/src/cli.ts",
        "packages/*/src/plugins/**",
        "**/*.d.ts",
        "**/types.ts",
        "**/index.ts",
      ],
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "node:sqlite": fileURLToPath(new URL("./test/mocks/sqlite.ts", import.meta.url)),
      sqlite: fileURLToPath(new URL("./test/mocks/sqlite.ts", import.meta.url)),
    },
  },
});
