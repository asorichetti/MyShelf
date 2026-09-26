export type SqlValue = string | number | null | Uint8Array;
export type SqlParams = readonly SqlValue[];

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * The small async database surface the app is written against. Adapters exist
 * for expo-sqlite (the app) and node:sqlite (Jest).
 */
export interface Db {
  /** Runs one or more statements without parameters (DDL, pragmas). */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  get<T>(sql: string, params?: SqlParams): Promise<T | null>;
  all<T>(sql: string, params?: SqlParams): Promise<T[]>;
  /**
   * Runs `fn` atomically. Use the `tx` handle inside the callback, not the
   * outer `Db`: other callers are queued until the transaction finishes, so
   * using the outer handle inside would wait forever. Nested calls on `tx`
   * become savepoints.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** What an adapter must provide; `createDb` adds locking and transactions. */
export interface Connection {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SqlParams): Promise<RunResult>;
  get<T>(sql: string, params: SqlParams): Promise<T | null>;
  all<T>(sql: string, params: SqlParams): Promise<T[]>;
  close(): Promise<void>;
}
