import { backupRepo, booksRepo, type Db } from '@/db';
import { deleteCoverFile, isLocalCover, isStoredCover } from '@/services/covers';

/* Cover files are deleted only when nothing names them. */

/** Covers a deleted book still names while its Undo is on offer (in memory, counted). */
const held = new Map<string, number>();

/** Keeps a cover file while something outside the database may bring it back (a deleted book's Undo). */
export function holdCover(uri: string | null | undefined): void {
  if (uri) held.set(uri, (held.get(uri) ?? 0) + 1);
}

/** Ends a `holdCover`. */
export function unholdCover(uri: string | null | undefined): void {
  if (!uri) return;
  const n = (held.get(uri) ?? 0) - 1;
  if (n > 0) held.set(uri, n);
  else held.delete(uri);
}

/**
 * Deletes a stored cover file once nothing names it: no book, not the safety
 * copy "Undo restore" keeps, not a deleted book whose Undo is still offered.
 * Call after a book stops naming it (its cover replaced or removed, the book
 * deleted, the library replaced). Covers are stored under names of their own
 * (`covers/<bookId>-<unique>.jpg`), so two books name the same file only when
 * a restore or an Undo put them back that way, and this keeps it for both.
 * Never throws; returns whether the file was deleted.
 */
export async function releaseCover(db: Db, uri: string | null | undefined): Promise<boolean> {
  try {
    if (!uri || !isLocalCover(uri) || !isStoredCover(uri) || held.has(uri)) return false;
    if (await booksRepo.coverInUse(db, uri)) return false;
    return deleteCoverFile(uri);
  } catch (error) {
    console.warn('Could not delete the cover file', error);
    return false;
  }
}

/** `releaseCover` for each of `uris`. Resolves with how many files went. */
export async function releaseCovers(db: Db, uris: Iterable<string | null | undefined>): Promise<number> {
  let n = 0;
  for (const uri of new Set(uris)) if (await releaseCover(db, uri)) n++;
  return n;
}

/**
 * A deleted book's Undo is over: its cover file goes unless something else
 * names it (the book was put back, possibly under another id, or a restore
 * brought back a book with the same cover). Never throws.
 */
export async function releaseCoverOfDeletedBook(db: Db, uri: string | null | undefined): Promise<boolean> {
  unholdCover(uri);
  return releaseCover(db, uri);
}

/** Tests: forget every hold. */
export function clearCoverHolds(): void {
  held.clear();
}

/**
 * Runs `replace`, which swaps the library for another (a Replace restore, or
 * "Undo restore"), then releases the cover files the library and the safety
 * copy named before that nothing names after: a restore keeps the library it
 * replaced in its safety copy, so its covers stay, and the previous copy's
 * go; undoing it brings those covers back, and the covers the backfill
 * fetched for the restored books go.
 */
export async function replacingLibrary<T>(db: Db, replace: () => Promise<T>): Promise<T> {
  const before = [...(await booksRepo.listLocalCoverUris(db)), ...(await backupRepo.snapshotCoverUris(db))];
  const result = await replace();
  await releaseCovers(db, before);
  return result;
}
