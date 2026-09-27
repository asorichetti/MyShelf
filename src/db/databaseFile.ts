import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';

import { APP_DATABASE_NAME } from './expo';

/** There is no database file on this device (the app has never opened one). */
export class NoDatabaseFileError extends Error {
  constructor() {
    super('There is no database file on this device');
    this.name = 'NoDatabaseFileError';
  }
}

/** The database file where expo-sqlite keeps it (`files/SQLite/<name>` on Android). */
function databaseFile(name: string): File {
  const dir = String(defaultDatabaseDirectory);
  return new File(dir.includes('://') ? dir : `file://${dir}`, name);
}

/**
 * The whole database file, for the recovery screen to hand to the user when
 * the app cannot open it (P09-04). It is read through a separate connection
 * that runs no migrations, so SQLite folds in the write-ahead log and the copy
 * is one complete file. If SQLite cannot read it at all (a damaged file), the
 * file's bytes as they are on disk.
 */
export async function readDatabaseFile(name: string = APP_DATABASE_NAME): Promise<Uint8Array> {
  const file = databaseFile(name);
  if (!file.exists) throw new NoDatabaseFileError();
  try {
    const sqlite = await openDatabaseAsync(name, { useNewConnection: true });
    try {
      return await sqlite.serializeAsync();
    } finally {
      await sqlite.closeAsync().catch(() => undefined);
    }
  } catch (error) {
    console.warn('The database could not be read as a database; saving the file as it is', error);
    return file.bytes();
  }
}
