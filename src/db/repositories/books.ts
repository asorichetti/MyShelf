import { normalizeIsbn, type Book, type BookPatch, type NewBook } from '@/domain';

import { BOOK_COLUMNS, NOW_SQL, sqlValue, toBook, type BookRow } from './shared';

import type { Db } from '../types';

/** Domain field -> column. Order defines INSERT column order. */
const FIELDS = {
  title: 'title',
  subtitle: 'subtitle',
  isbn13: 'isbn13',
  isbn10: 'isbn10',
  edition: 'edition',
  publisher: 'publisher',
  publicationYear: 'publication_year',
  pageCount: 'page_count',
  summary: 'summary',
  coverUri: 'cover_uri',
  language: 'language',
  format: 'format',
  seriesId: 'series_id',
  seriesPosition: 'series_position',
  source: 'source',
  sourceId: 'source_id',
  notes: 'notes',
} as const satisfies Record<keyof NewBook, string>;

type Field = keyof typeof FIELDS;

function clean<T extends BookPatch>(input: T): T {
  const out = { ...input };
  if ('title' in out && typeof out.title === 'string') out.title = out.title.trim();
  if ('isbn13' in out) out.isbn13 = normalizeIsbn(out.isbn13);
  if ('isbn10' in out) out.isbn10 = normalizeIsbn(out.isbn10);
  return out;
}

export async function createBook(db: Db, input: NewBook): Promise<Book> {
  const data = clean(input);
  const keys = (Object.keys(FIELDS) as Field[]).filter((k) => data[k] !== undefined);
  const cols = keys.map((k) => FIELDS[k]);
  const { lastInsertRowId } = await db.run(
    `INSERT INTO books (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    keys.map((k) => sqlValue(data[k])),
  );
  return (await getBook(db, lastInsertRowId))!;
}

export async function getBook(db: Db, id: number): Promise<Book | null> {
  const row = await db.get<BookRow>(`SELECT ${BOOK_COLUMNS} FROM books b WHERE b.id = ?`, [id]);
  return row ? toBook(row) : null;
}

export async function findBooksByIsbn(db: Db, isbn: string): Promise<Book[]> {
  const n = normalizeIsbn(isbn);
  if (!n) return [];
  const rows = await db.all<BookRow>(
    `SELECT ${BOOK_COLUMNS} FROM books b WHERE b.isbn13 = ? OR b.isbn10 = ? ORDER BY b.id`,
    [n, n],
  );
  return rows.map(toBook);
}

export async function listBooks(db: Db): Promise<Book[]> {
  const rows = await db.all<BookRow>(`SELECT ${BOOK_COLUMNS} FROM books b ORDER BY b.title COLLATE NOCASE, b.id`);
  return rows.map(toBook);
}

export async function searchBooks(db: Db, query: string): Promise<Book[]> {
  const like = `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.all<BookRow>(
    `SELECT DISTINCT ${BOOK_COLUMNS} FROM books b
     LEFT JOIN book_authors ba ON ba.book_id = b.id
     LEFT JOIN authors a ON a.id = ba.author_id
     WHERE b.title LIKE ? ESCAPE '\\' OR b.subtitle LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\'
     ORDER BY b.title COLLATE NOCASE, b.id`,
    [like, like, like],
  );
  return rows.map(toBook);
}

export async function countBooks(db: Db): Promise<number> {
  const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM books');
  return row?.n ?? 0;
}

/** Updates the given fields and bumps updated_at. Returns null if the book does not exist. */
export async function updateBook(db: Db, id: number, patch: BookPatch): Promise<Book | null> {
  const data = clean(patch);
  const keys = (Object.keys(FIELDS) as Field[]).filter((k) => data[k] !== undefined);
  const sets = [...keys.map((k) => `${FIELDS[k]} = ?`), `updated_at = ${NOW_SQL}`];
  const { changes } = await db.run(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, [
    ...keys.map((k) => sqlValue(data[k])),
    id,
  ]);
  return changes ? getBook(db, id) : null;
}

/** Deletes a book along with its author/genre/group links and loan history. */
export async function deleteBook(db: Db, id: number): Promise<boolean> {
  const { changes } = await db.run('DELETE FROM books WHERE id = ?', [id]);
  return changes > 0;
}
