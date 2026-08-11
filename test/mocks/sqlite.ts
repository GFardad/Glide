type Row = Record<string, unknown>;
/* eslint-disable @typescript-eslint/no-unused-vars */
type Rows = Row[];

interface StatementSync {
  run(_params?: unknown): { changes: number };
  get(_params?: unknown): Row | undefined;
  all(_params?: unknown): Row[];
}

interface DatabaseSync {
  prepare(_sql: string): StatementSync;
  exec(_sql: string): void;
  close(): void;
  [Symbol.dispose](): void;
}

const stores = new Map<string, Rows>();

function getStore(filename: string): Rows {
  const key = filename;
  if (!stores.has(key)) stores.set(key, []);
  return stores.get(key)!;
}

export interface DatabaseSyncOptions {
  filename?: string;
  verbose?: boolean;
}

export class MockDatabaseSync implements DatabaseSync {
  private readonly rows: Rows;
  constructor(filename?: string) {
    const key = filename ?? ':memory:';
    this.rows = getStore(key);
  }

  prepare(_sql: string): StatementSync {
    return {
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [] as Row[],
    };
  }

  exec(_sql: string): void {}
  close(): void {}
  [Symbol.dispose](): void {}
}

export { MockDatabaseSync as DatabaseSync };
