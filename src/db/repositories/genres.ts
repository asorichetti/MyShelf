import type { Book, BookGenre, BookGroup, Genre } from '@/domain';

import type { Db } from '../types';
import { BOOK_COLUMNS, foldBookGroups, toBook, type BookRow } from './shared';

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

export async function renameGenre(db: Db, id: number, name: string): Promise<Genre | null> {
  const { changes } = await db.run('UPDATE genres SET name = ? WHERE id = ?', [name.trim(), id]);
  return changes ? getGenre(db, id) : null;
}

export async function deleteGenre(db: Db, id: number): Promise<boolean> {
  return (await db.run('DELETE FROM genres WHERE id = ?', [id])).changes > 0;
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
