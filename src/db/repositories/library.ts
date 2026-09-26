import type { Db } from '../types';

/** Every table that holds library data, children before parents. `settings` is kept. */
const LIBRARY_TABLES = ['loans', 'group_books', 'book_genres', 'book_authors', 'books', 'borrowers', 'groups', 'genres', 'authors', 'series'];

/**
 * Removes every book, author, genre, series, group, borrower and loan in one
 * transaction (settings are kept). Used by the E2E fixture loader; a restore
 * from backup will use it too.
 */
export async function wipeLibrary(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of LIBRARY_TABLES) await tx.run(`DELETE FROM ${table}`);
  });
}

/** Row counts per library table (tests and diagnostics). */
export async function countRows(db: Db): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of LIBRARY_TABLES) {
    const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    out[table] = row?.n ?? 0;
  }
  return out;
}

/** Settings that name books, series or loans by id: meaningless once the library is gone. */
const ID_SETTINGS = ['series.dismissedBookIds', 'series.pendingConfirmBookIds', 'booky.seen'];

export interface EraseOptions {
  /** Also forget every preference (sort, loan length, Booky mode, …). */
  resetSettings?: boolean;
}

/**
 * "Erase library" (P08-09): every book, author, genre, series, group,
 * borrower and loan, the pending lookups, the cover-search bookkeeping, the
 * lookup cache and the restore safety copy, in one transaction. Settings are
 * kept (except the ones that point at deleted rows) unless `resetSettings`.
 * Cover files on the device are deleted by the caller.
 */
export async function eraseLibrary(db: Db, { resetSettings = false }: EraseOptions = {}): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of LIBRARY_TABLES) await tx.run(`DELETE FROM ${table}`);
    for (const table of ['pending_lookups', 'cover_attempts', 'api_cache', 'backup_snapshots']) await tx.run(`DELETE FROM ${table}`);
    if (resetSettings) await tx.run('DELETE FROM settings');
    else await tx.run(`DELETE FROM settings WHERE key IN (${ID_SETTINGS.map(() => '?').join(', ')})`, ID_SETTINGS);
  });
}

/** How many books there are and when the first was added (for the backup reminder, P08-06). */
export async function libraryStats(db: Db): Promise<{ books: number; firstAddedAt: string | null }> {
  const row = await db.get<{ n: number; first: string | null }>('SELECT COUNT(*) AS n, MIN(created_at) AS first FROM books');
  return { books: row?.n ?? 0, firstAddedAt: row?.first ?? null };
}
