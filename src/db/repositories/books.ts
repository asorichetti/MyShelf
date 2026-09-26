import {
  normalizeIsbn,
  type Book,
  type BookDetail,
  type BookListItem,
  type BookPatch,
  type NewBook,
  type ShelfSortKey,
  type SortDirection,
} from '@/domain';

import { listAuthorsForBook } from './authors';
import { listGenresForBook } from './genres';
import { getSeries } from './series';
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

// ---- Shelf list ----

/** SQL twin of `sortableTitle()` in src/domain/book.ts: a leading The/A/An is ignored. */
const SORT_TITLE = `CASE
  WHEN b.title LIKE 'the %' THEN ltrim(substr(b.title, 5))
  WHEN b.title LIKE 'a %' THEN ltrim(substr(b.title, 3))
  WHEN b.title LIKE 'an %' THEN ltrim(substr(b.title, 4))
  ELSE b.title END COLLATE NOCASE`;

/** The first credited author's sort name. */
const PRIMARY_AUTHOR_SORT = `(SELECT COALESCE(a.sort_name, a.name) FROM book_authors ba JOIN authors a ON a.id = ba.author_id
  WHERE ba.book_id = b.id ORDER BY ba.position, a.id LIMIT 1)`;

function orderBy(sort: ShelfSortKey, dir: SortDirection): string {
  const d = dir === 'desc' ? 'DESC' : 'ASC';
  switch (sort) {
    case 'title':
      return `${SORT_TITLE} ${d}, b.id ${d}`;
    case 'author':
      // Books without an author go last in either direction.
      return `author_sort IS NULL, author_sort COLLATE NOCASE ${d}, ${SORT_TITLE} ASC, b.id`;
    case 'year':
      return `b.publication_year IS NULL, b.publication_year ${d}, ${SORT_TITLE} ASC, b.id`;
    case 'added':
      return `b.created_at ${d}, b.id ${d}`;
  }
}

export interface ListBookItemsOptions {
  /** Matches title, subtitle, author names, series name and (normalised) ISBN, case-insensitively. */
  query?: string;
  sort?: ShelfSortKey;
  direction?: SortDirection;
  limit?: number;
  offset?: number;
}

interface ListRow {
  id: number;
  title: string;
  subtitle: string | null;
  cover_uri: string | null;
  publication_year: number | null;
  series_name: string | null;
  series_position: number | null;
  on_loan: number;
}

const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Only digit-ish queries ("978-0-441", "0441172717") are also matched against ISBNs. */
function isbnFragment(query: string): string | null {
  if (!/^[\d\sXx-]+$/.test(query)) return null;
  const n = normalizeIsbn(query);
  return n && n.replace(/X$/, '').length >= 4 ? n : null;
}

/**
 * The Shelf list: one query for the rows (sorted and filtered in SQL) plus
 * one for their authors, whatever the number of books.
 */
export async function listBookItems(db: Db, options: ListBookItemsOptions = {}): Promise<BookListItem[]> {
  const { sort = 'title', direction = 'asc', limit, offset = 0 } = options;
  const query = options.query?.trim() ?? '';
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query) {
    const like = `%${likeEscape(query)}%`;
    const alternatives = [
      "b.title LIKE ? ESCAPE '\\'",
      "b.subtitle LIKE ? ESCAPE '\\'",
      "s.name LIKE ? ESCAPE '\\'",
      "EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ? ESCAPE '\\')",
    ];
    params.push(like, like, like, like);
    const isbn = isbnFragment(query);
    if (isbn) {
      alternatives.push('b.isbn13 LIKE ?', 'b.isbn10 LIKE ?');
      params.push(`%${isbn}%`, `%${isbn}%`);
    }
    where.push(`(${alternatives.join(' OR ')})`);
  }
  const rows = await db.all<ListRow & { author_sort: string | null }>(
    `SELECT b.id, b.title, b.subtitle, b.cover_uri, b.publication_year, s.name AS series_name, b.series_position,
       EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.returned_on IS NULL) AS on_loan,
       ${PRIMARY_AUTHOR_SORT} AS author_sort
     FROM books b LEFT JOIN series s ON s.id = b.series_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${orderBy(sort, direction)}
     ${limit != null ? 'LIMIT ? OFFSET ?' : ''}`,
    limit != null ? [...params, limit, offset] : params,
  );

  const names = await authorNamesFor(db, rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    authors: names.get(r.id) ?? [],
    coverUri: r.cover_uri,
    publicationYear: r.publication_year,
    seriesName: r.series_name,
    seriesPosition: r.series_position,
    onLoan: r.on_loan === 1,
  }));
}

/** Credited author names per book, in order, in one query (chunked for very long lists). */
async function authorNamesFor(db: Db, bookIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  for (let i = 0; i < bookIds.length; i += 500) {
    const ids = bookIds.slice(i, i + 500);
    const rows = await db.all<{ book_id: number; name: string }>(
      `SELECT ba.book_id, a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id
       WHERE ba.book_id IN (${ids.map(() => '?').join(', ')}) ORDER BY ba.book_id, ba.position, a.id`,
      ids,
    );
    for (const r of rows) {
      const list = out.get(r.book_id);
      if (list) list.push(r.name);
      else out.set(r.book_id, [r.name]);
    }
  }
  return out;
}

/** A book with its authors (in order), genres, series and open loan; null if there is no such book. */
export async function getBookDetail(db: Db, id: number): Promise<BookDetail | null> {
  const book = await getBook(db, id);
  if (!book) return null;
  const [authors, genres, series, loan] = await Promise.all([
    listAuthorsForBook(db, id),
    listGenresForBook(db, id),
    book.seriesId != null ? getSeries(db, book.seriesId) : Promise.resolve(null),
    db.get<{ id: number; book_id: number; borrower_id: number; lent_on: string; due_on: string | null; note: string | null; borrower_name: string }>(
      `SELECT l.id, l.book_id, l.borrower_id, l.lent_on, l.due_on, l.note, p.name AS borrower_name
       FROM loans l JOIN borrowers p ON p.id = l.borrower_id WHERE l.book_id = ? AND l.returned_on IS NULL`,
      [id],
    ),
  ]);
  return {
    ...book,
    authors,
    genres,
    series,
    openLoan: loan
      ? {
          id: loan.id,
          bookId: loan.book_id,
          borrowerId: loan.borrower_id,
          lentOn: loan.lent_on,
          dueOn: loan.due_on,
          returnedOn: null,
          note: loan.note,
          borrowerName: loan.borrower_name,
        }
      : null,
  };
}
