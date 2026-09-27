import { openDatabaseAsync } from 'expo-sqlite';

import { APP_DATABASE_NAME } from './expo';

/** There is no database file on this device (the app has never opened one). */
export class NoDatabaseFileError extends Error {
  constructor() {
    super('There is no database file on this device');
    this.name = 'NoDatabaseFileError';
  }
}

/**
 * Web: the whole database file, read through a separate connection that runs
 * no migrations (see databaseFile.ts). The browser keeps it in its private
 * file system, which a page cannot read as a file, so SQLite serialises it.
 */
export async function readDatabaseFile(name: string = APP_DATABASE_NAME): Promise<Uint8Array> {
  const sqlite = await openDatabaseAsync(name, { useNewConnection: true });
  try {
    // A database the browser had never stored opens as a new, empty one.
    const tables = await sqlite.getFirstAsync<{ n: number }>('SELECT count(*) AS n FROM sqlite_master');
    if (!tables?.n) throw new NoDatabaseFileError();
    return await sqlite.serializeAsync();
  } finally {
    await sqlite.closeAsync().catch(() => undefined);
  }
}
