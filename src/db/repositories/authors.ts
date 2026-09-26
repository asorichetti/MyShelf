import { toSortName, type Author, type AuthorRole, type Book, type BookAuthor, type BookAuthorLink, type BookGroup } from '@/domain';

import { BOOK_COLUMNS, foldBookGroups, toBook, type BookRow } from './shared';

import type { Db } from '../types';

interface AuthorRow {
  id: number;
  name: string;
  sort_name: string | null;
}

const toAuthor = (r: AuthorRow): Author => ({ id: r.id, name: r.name, sortName: r.sort_name });

export async function createAuthor(db: Db, name: string, sortName: string | null = toSortName(name)): Promise<Author> {
  const clean = name.trim();
  const { lastInsertRowId } = await db.run('INSERT INTO authors (name, sort_name) VALUES (?, ?)', [clean, sortName]);
  return { id: lastInsertRowId, name: clean, sortName };
}

export async function getAuthor(db: Db, id: number): Promise<Author | null> {
  const row = await db.get<AuthorRow>('SELECT id, name, sort_name FROM authors WHERE id = ?', [id]);
  return row ? toAuthor(row) : null;
}

/** Case-insensitive exact name match. */
export async function findAuthorByName(db: Db, name: string): Promise<Author | null> {
  const row = await db.get<AuthorRow>(
    'SELECT id, name, sort_name FROM authors WHERE name = ? COLLATE NOCASE ORDER BY id LIMIT 1',
    [name.trim()],
  );
  return row ? toAuthor(row) : null;
}

export async function findOrCreateAuthor(db: Db, name: string): Promise<Author> {
  return (await findAuthorByName(db, name)) ?? createAuthor(db, name);
}

export async function listAuthors(db: Db): Promise<Author[]> {
  const rows = await db.all<AuthorRow>(
    'SELECT id, name, sort_name FROM authors ORDER BY COALESCE(sort_name, name) COLLATE NOCASE, id',
  );
  return rows.map(toAuthor);
}

export async function updateAuthor(db: Db, id: number, patch: Partial<Pick<Author, 'name' | 'sortName'>>): Promise<Author | null> {
  const current = await getAuthor(db, id);
  if (!current) return null;
  const name = patch.name?.trim() ?? current.name;
  const sortName = patch.sortName !== undefined ? patch.sortName : patch.name ? toSortName(name) : current.sortName;
  await db.run('UPDATE authors SET name = ?, sort_name = ? WHERE id = ?', [name, sortName, id]);
  return { id, name, sortName };
}

export async function deleteAuthor(db: Db, id: number): Promise<boolean> {
  return (await db.run('DELETE FROM authors WHERE id = ?', [id])).changes > 0;
}

/** Replaces a book's authors; list order becomes their credited order. */
export async function setBookAuthors(db: Db, bookId: number, links: BookAuthorLink[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM book_authors WHERE book_id = ?', [bookId]);
    for (const [position, link] of links.entries()) {
      await tx.run('INSERT INTO book_authors (book_id, author_id, role, position) VALUES (?, ?, ?, ?)', [
        bookId,
        link.authorId,
        link.role ?? 'author',
        position,
      ]);
    }
  });
}

export async function listAuthorsForBook(db: Db, bookId: number): Promise<BookAuthor[]> {
  const rows = await db.all<AuthorRow & { role: string; position: number }>(
    `SELECT a.id, a.name, a.sort_name, ba.role, ba.position
     FROM book_authors ba JOIN authors a ON a.id = ba.author_id
     WHERE ba.book_id = ? ORDER BY ba.position, a.id`,
    [bookId],
  );
  return rows.map((r) => ({ ...toAuthor(r), role: r.role as AuthorRole, position: r.position }));
}

export async function listBooksByAuthor(db: Db, authorId: number): Promise<Book[]> {
  const rows = await db.all<BookRow>(
    `SELECT ${BOOK_COLUMNS} FROM books b JOIN book_authors ba ON ba.book_id = b.id
     WHERE ba.author_id = ?
     ORDER BY b.series_id IS NULL, b.series_id, b.series_position, b.publication_year, b.title COLLATE NOCASE`,
    [authorId],
  );
  return rows.map(toBook);
}

/** Every book grouped under each of its authors (A-Z by sort name); books with no author come last. */
export async function groupBooksByAuthor(db: Db): Promise<BookGroup<Author>[]> {
  const rows = await db.all<BookRow & { a_id: number | null; a_name: string | null; a_sort_name: string | null }>(
    `SELECT ${BOOK_COLUMNS}, a.id AS a_id, a.name AS a_name, a.sort_name AS a_sort_name
     FROM books b
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     ORDER BY a.id IS NULL, COALESCE(a.sort_name, a.name) COLLATE NOCASE, a.id, b.title COLLATE NOCASE, b.id`,
  );
  return foldBookGroups(rows, (r) => (r.a_id == null ? null : { id: r.a_id, name: r.a_name!, sortName: r.a_sort_name }));
}
