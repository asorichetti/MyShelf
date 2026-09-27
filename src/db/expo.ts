import { openDatabaseAsync, type SQLiteBindParams, type SQLiteOpenOptions } from 'expo-sqlite';

import { createDb } from './createDb';
import { CONNECTION_PRAGMAS } from './pragmas';

import type { Db, SqlParams } from './types';

export const APP_DATABASE_NAME = 'myshelf.db';

const bind = (params: SqlParams) => params as unknown as SQLiteBindParams;

/** Opens an expo-sqlite database with foreign keys enforced. */
export async function openExpoDatabase(name: string = APP_DATABASE_NAME, options?: SQLiteOpenOptions): Promise<Db> {
  const sqlite = await openDatabaseAsync(name, options);
  await sqlite.execAsync(CONNECTION_PRAGMAS);
  return createDb({
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params) => {
      const r = await sqlite.runAsync(sql, bind(params));
      return { lastInsertRowId: Number(r.lastInsertRowId), changes: r.changes };
    },
    get: <T>(sql: string, params: SqlParams) => sqlite.getFirstAsync<T>(sql, bind(params)),
    all: <T>(sql: string, params: SqlParams) => sqlite.getAllAsync<T>(sql, bind(params)),
    close: () => sqlite.closeAsync(),
  });
}

let shared: Promise<Db> | null = null;

/** The app's single shared database connection. */
export function openAppDatabase(): Promise<Db> {
  shared ??= openExpoDatabase().catch((error) => {
    shared = null;
    throw error;
  });
  return shared;
}
