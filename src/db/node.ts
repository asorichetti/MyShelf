/**
 * node:sqlite adapter for Jest and Node scripts. Not bundled into the app:
 * only tests import it. Uses Node's built-in SQLite (no native build).
 */
import { createDb } from './createDb';
import type { Db, SqlParams } from './types';

interface StatementSync {
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}
interface NodeSqlite {
  DatabaseSync: new (path: string) => DatabaseSync;
}

declare const process: { getBuiltinModule?: (id: string) => unknown };

/** Node prints a one-time ExperimentalWarning when node:sqlite loads; it is harmless. */
function loadNodeSqlite(): NodeSqlite {
  const mod = process.getBuiltinModule?.('node:sqlite') as NodeSqlite | undefined;
  if (!mod) throw new Error('node:sqlite is unavailable; Node 22.13+ or 23.4+ is required');
  return mod;
}

// Plain objects: node:sqlite returns null-prototype rows, which trip up deep equality in tests.
const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

/** Opens a node:sqlite database (in memory by default) with foreign keys enforced. */
export async function openNodeDatabase(path = ':memory:'): Promise<Db> {
  const { DatabaseSync } = loadNodeSqlite();
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  return createDb({
    exec: async (sql) => sqlite.exec(sql),
    run: async (sql, params: SqlParams) => {
      const r = sqlite.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    get: async <T>(sql: string, params: SqlParams) => {
      const row = sqlite.prepare(sql).get(...params);
      return row == null ? null : plain<T>(row);
    },
    all: async <T>(sql: string, params: SqlParams) => sqlite.prepare(sql).all(...params).map((r) => plain<T>(r)),
    close: async () => sqlite.close(),
  });
}
