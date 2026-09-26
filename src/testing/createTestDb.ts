import { migrate, type Db } from '@/db';
import { openBetterSqliteDatabase } from '@/db/betterSqlite';
import { openNodeDatabase } from '@/db/node';

/** A fresh, fully migrated in-memory database for tests (Node's SQLite: no FTS5, so search uses the plain index). */
export async function createTestDb(): Promise<Db> {
  const db = await openNodeDatabase();
  await migrate(db);
  return db;
}

/** The same with an SQLite that has FTS5 (better-sqlite3), as on Android, so search uses `books_fts`. */
export async function createFtsTestDb(): Promise<Db> {
  const db = await openBetterSqliteDatabase();
  await migrate(db);
  return db;
}
