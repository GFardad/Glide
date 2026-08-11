declare module "node:sqlite" {
  export interface DatabaseSync {
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }

  export interface StatementSync {
    run(params?: unknown[]): { changes: number };
    get(params?: unknown[]): Record<string, unknown> | undefined;
    all(params?: unknown[]): Record<string, unknown>[];
  }

  export const DatabaseSync: new (filename?: string) => DatabaseSync;
}
