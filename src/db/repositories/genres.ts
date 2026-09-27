import type { Book, BookGenre, BookGroup, Genre } from '@/domain';

import { forgetEntities } from './settings';
import { BOOK_COLUMNS, foldBookGroups, toBook, type BookRow } from './shared';

import type { Db } from '../types';

export async function createGenre(db: Db, name: string): Promise<Genre> {
  const clean = name.trim();
  const { lastInsertRowId } = await db.run('INSERT INTO genres (name) VALUES (?)', [clean]);
  return { id: lastInsertRowId, name: clean };
}

/** Genre names are unique case-insensitively ("Fantasy" == "fantasy"). */
export async function findGenreByName(db: Db, name: string): Promise<Genre | null> {
  return db.get<Genre>('SELECT id, name FROM genres WHERE name = ?', [name.trim()]);
}

export async function findOrCreateGenre(db: Db, name: string): Promise<Genre> {
  return (await findGenreByName(db, name)) ?? createGenre(db, name);
}

export async function getGenre(db: Db, id: number): Promise<Genre | null> {
  return db.get<Genre>('SELECT id, name FROM genres WHERE id = ?', [id]);
}

export async function listGenres(db: Db): Promise<Genre[]> {
  return db.all<Genre>('SELECT id, name FROM genres ORDER BY name');
}

/** Thrown when renaming a genre to a name another genre already has; the caller can offer to merge. */
export class GenreNameTakenError extends Error {
  constructor(readonly existing: Genre) {
    super(`There is already a genre called "${existing.name}"`);
    this.name = 'GenreNameTakenError';
  }
}

/**
 * Renames a genre. Changing only the case ("sci-fi" to "Sci-Fi") is fine;
 * a name another genre has (ignoring case) throws GenreNameTakenError, so
 * the user can be asked whether to merge them instead. Null if not found.
 */
export async function renameGenre(db: Db, id: number, name: string): Promise<Genre | null> {
  const clean = name.trim();
  if (!clean) throw new RangeError('A genre needs a name');
  const existing = await findGenreByName(db, clean);
  if (existing && existing.id !== id) throw new GenreNameTakenError(existing);
  const { changes } = await db.run('UPDATE genres SET name = ? WHERE id = ?', [clean, id]);
  return changes ? getGenre(db, id) : null;
}

/** Deletes a genre: books lose the tag, and the Shelf stops filtering on it. */
export async function deleteGenre(db: Db, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const deleted = (await tx.run('DELETE FROM genres WHERE id = ?', [id])).changes > 0;
    if (deleted) await forgetEntities(tx, 'genre', [id]);
    return deleted;
  });
}

export interface GenreWithCount extends Genre {
  /** Books tagged with the genre. */
  count: number;
}

/** Every genre A-Z with how many books it tags (unused genres included, with 0). */
export async function listGenresWithCounts(db: Db): Promise<GenreWithCount[]> {
  return db.all<GenreWithCount>(
    `SELECT g.id, g.name, COUNT(bg.book_id) AS count FROM genres g LEFT JOIN book_genres bg ON bg.genre_id = g.id
     GROUP BY g.id ORDER BY g.name COLLATE NOCASE, g.id`,
  );
}

/**
 * Merges `sourceId` into `targetId` in one transaction: every book tagged
 * with the source is tagged with the target (never twice; a link stays
 * user-edited if either was), then the source is deleted. Returns the target
 * with its new count, or null when either is missing or they are the same.
 */
export async function mergeGenres(db: Db, sourceId: number, targetId: number): Promise<GenreWithCount | null> {
  if (sourceId === targetId) return null;
  return db.transaction(async (tx) => {
    const [source, target] = [await getGenre(tx, sourceId), await getGenre(tx, targetId)];
    if (!source || !target) return null;
    await tx.run(
      `INSERT INTO book_genres (book_id, genre_id, user_edited)
       SELECT book_id, ?, user_edited FROM book_genres WHERE genre_id = ?
       ON CONFLICT (book_id, genre_id) DO UPDATE SET user_edited = MAX(user_edited, excluded.user_edited)`,
      [targetId, sourceId],
    );
    await tx.run('DELETE FROM genres WHERE id = ?', [sourceId]);
    await forgetEntities(tx, 'genre', [sourceId], { mergedInto: targetId });
    const row = await tx.get<{ count: number }>('SELECT COUNT(*) AS count FROM book_genres WHERE genre_id = ?', [targetId]);
    return { ...target, count: row?.count ?? 0 };
  });
}

/**
 * Replaces a book's genres. `userEdited` marks them as the user's choice so a
 * later metadata lookup knows not to overwrite them.
 */
export async function setBookGenres(db: Db, bookId: number, genreIds: number[], { userEdited = false } = {}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM book_genres WHERE book_id = ?', [bookId]);
    for (const genreId of new Set(genreIds)) {
      await tx.run('INSERT INTO book_genres (book_id, genre_id, user_edited) VALUES (?, ?, ?)', [
        bookId,
        genreId,
        userEdited ? 1 : 0,
      ]);
    }
  });
}

export async function addBookGenre(db: Db, bookId: number, genreId: number, { userEdited = false } = {}): Promise<void> {
  await db.run(
    `INSERT INTO book_genres (book_id, genre_id, user_edited) VALUES (?, ?, ?)
     ON CONFLICT (book_id, genre_id) DO UPDATE SET user_edited = MAX(user_edited, excluded.user_edited)`,
    [bookId, genreId, userEdited ? 1 : 0],
  );
}

export async function removeBookGenre(db: Db, bookId: number, genreId: number): Promise<boolean> {
  return (await db.run('DELETE FROM book_genres WHERE book_id = ? AND genre_id = ?', [bookId, genreId])).changes > 0;
}

export async function listGenresForBook(db: Db, bookId: number): Promise<BookGenre[]> {
  const rows = await db.all<{ id: number; name: string; user_edited: number }>(
    `SELECT g.id, g.name, bg.user_edited FROM book_genres bg JOIN genres g ON g.id = bg.genre_id
     WHERE bg.book_id = ? ORDER BY g.name`,
    [bookId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, userEdited: r.user_edited === 1 }));
}

export async function listBooksByGenre(db: Db, genreId: number): Promise<Book[]> {
  const rows = await db.all<BookRow>(
    `SELECT ${BOOK_COLUMNS} FROM books b JOIN book_genres bg ON bg.book_id = b.id
     WHERE bg.genre_id = ? ORDER BY b.title COLLATE NOCASE, b.id`,
    [genreId],
  );
  return rows.map(toBook);
}

/** Every book under each of its genres (A-Z); books with no genre come last under a null key. */
export async function groupBooksByGenre(db: Db): Promise<BookGroup<Genre>[]> {
  const rows = await db.all<BookRow & { g_id: number | null; g_name: string | null }>(
    `SELECT ${BOOK_COLUMNS}, g.id AS g_id, g.name AS g_name
     FROM books b
     LEFT JOIN book_genres bg ON bg.book_id = b.id
     LEFT JOIN genres g ON g.id = bg.genre_id
     ORDER BY g.id IS NULL, g.name, b.title COLLATE NOCASE, b.id`,
  );
  return foldBookGroups(rows, (r) => (r.g_id == null ? null : { id: r.g_id, name: r.g_name! }));
}
