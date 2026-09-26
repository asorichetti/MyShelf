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
