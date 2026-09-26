import { migrate, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';

/** A fresh, fully migrated in-memory database for tests. */
export async function createTestDb(): Promise<Db> {
  const db = await openNodeDatabase();
  await migrate(db);
  return db;
}
