import type { Db } from '@/db';
import { openExpoDatabase } from '@/db/expo';

/**
 * An empty in-memory database, for bringing a backup from an older version
 * of the app up to date with the real migrations before it is restored.
 *
 * By default expo-sqlite finalizes every statement on the connection before
 * closing it, including the ones SQLite's extensions keep for themselves
 * (the search index's FTS5 table prepares its own), which SQLite then frees
 * again while closing. Since migration 0008 rebuilds the search index,
 * restoring an older backup crashed the app on Android when the scratch
 * database was closed (SIGABRT in `sqlite3_finalize`). Every statement the
 * app prepares is finalized when it has run, so SQLite's own close is left
 * to tidy up the rest.
 */
export function openScratchDatabase(): Promise<Db> {
  return openExpoDatabase(':memory:', { finalizeUnusedStatementsBeforeClosing: false });
}
