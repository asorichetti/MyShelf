/**
 * better-sqlite3 adapter for Jest only. Its SQLite is built with FTS5, which
 * Node's built-in one (`node.ts`, the default for tests) is not, so the tests
 * can run the FTS5 search path that Android uses (migration 0006) as well as
 * the plain one the web build and `node:sqlite` use. Not bundled into the app.
 */
import { createDb } from './createDb';

import type { Db, SqlParams } from './types';

interface Statement {
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}

declare const require: (id: string) => unknown;

/** Opens a better-sqlite3 database (in memory by default) with foreign keys enforced. */
export async function openBetterSqliteDatabase(path = ':memory:'): Promise<Db> {
  const BetterSqlite = require('better-sqlite3') as new (path: string) => Database;
  const sqlite = new BetterSqlite(path);
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const bind = (params: SqlParams) => params.map((p) => (p instanceof Uint8Array ? (globalThis as unknown as { Buffer: { from(a: Uint8Array): unknown } }).Buffer.from(p) : p));
  return createDb({
    exec: async (sql) => sqlite.exec(sql),
    run: async (sql, params: SqlParams) => {
      const r = sqlite.prepare(sql).run(...bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    get: async <T>(sql: string, params: SqlParams) => {
      const row = sqlite.prepare(sql).get(...bind(params));
      return row == null ? null : ({ ...(row as object) } as T);
    },
    all: async <T>(sql: string, params: SqlParams) => sqlite.prepare(sql).all(...bind(params)).map((r) => ({ ...(r as object) }) as T),
    close: async () => sqlite.close(),
  });
}
