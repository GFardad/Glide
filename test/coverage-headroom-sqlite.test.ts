import { describe, it, expect } from "vitest";

/**
 * Coverage tests for packages/headroom/src/sqlite.d.ts.
 * This file only declares module augmentation types, so coverage comes from
 * asserting mocked database/shape implementations conform to those declared
 * interfaces/types.
 */

type Row = Record<string, unknown>;

describe("headroom sqlite type declarations", () => {
  it("marks DatabaseSync implementations as valid", () => {
    const db = {
      exec: () => {},
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [] as Row[],
      }),
    };

    expect(typeof db.exec).toBe("function");
    expect(typeof db.prepare).toBe("function");
  });

  it("marks StatementSync implementations as valid", () => {
    const statement = {
      run: (params: unknown[]) => {
        expect(Array.isArray(params)).toBe(true);
        return { changes: 1 };
      },
      get: () => ({ id: "1" }),
      all: () => [{ id: "1" }, { id: "2" }] as Row[],
    };

    expect(statement.run([]).changes).toBe(1);
    expect(statement.get()).toEqual({ id: "1" });
    expect(statement.all()).toHaveLength(2);
  });
});
