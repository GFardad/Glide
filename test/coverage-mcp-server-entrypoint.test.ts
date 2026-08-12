import { describe, it, expect } from "vitest";
import * as mcpServerIndex from "../packages/mcp-server/src/index.js";

/**
 * Coverage tests for packages/mcp-server/src/index.ts.
 * The entrypoint re-exports `createGlideServer` and `main`, and provides the
 * stdio bootstrap when executed directly. We assert the exports exist and
 * exercise the bootstrap path by calling `main` against a fake stdin stream.
 */

describe("mcp-server entrypoint", () => {
  it("exposes createGlideServer and main", () => {
    expect(typeof mcpServerIndex.createGlideServer).toBe("function");
    expect(typeof mcpServerIndex.main).toBe("function");
  });

  it("writes an initialize response for valid input", async () => {
    const lines: string[] = [];
    const originalStdin = process.stdin;
    const originalStdout = process.stdout;
    const originalStderr = process.stderr;
    const originalArgv = process.argv;

    try {
      let endHandler: (() => void) | undefined;
      const stdinMock = {
        setEncoding: () => {},
        on: (_event: string, handler: (chunk: string) => void) => {
          if (_event === "data") {
            handler(`{"jsonrpc":"2.0","id":1,"method":"initialize"}\n`);
            setTimeout(() => endHandler?.(), 0);
          } else if (_event === "end") {
            endHandler = handler as () => void;
          }
        },
      };

      const stdoutMock = {
        write: (chunk: string) => {
          lines.push(chunk);
        },
        once: () => {},
        on: () => {},
      };

      const stderrMock = {
        write: () => {},
        once: () => {},
        on: () => {},
      };

      Object.defineProperty(process, "stdin", {
        value: stdinMock,
        configurable: true,
      });
      Object.defineProperty(process, "stdout", {
        value: stdoutMock,
        configurable: true,
      });
      Object.defineProperty(process, "stderr", {
        value: stderrMock,
        configurable: true,
      });
      Object.defineProperty(process, "argv", {
        value: [originalArgv[0], originalArgv[1]],
        configurable: true,
      });

      await mcpServerIndex.main();
    } finally {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      });
      Object.defineProperty(process, "stdout", {
        value: originalStdout,
        configurable: true,
      });
      Object.defineProperty(process, "stderr", {
        value: originalStderr,
        configurable: true,
      });
      Object.defineProperty(process, "argv", {
        value: originalArgv,
        configurable: true,
      });
    }

    expect(lines.some((line) => line.includes('"protocolVersion"'))).toBe(true);
  });
});
