import {
  bookFormats,
  normalizeIsbn,
  type BookFormat,
  type Book,
  type BookDetail,
  type BookListItem,
  type BookPatch,
  type NewBook,
  type ShelfFilters,
  type ShelfSortKey,
  type SortDirection,
  type ValidBookDraft,
  RECENTLY_ADDED_DAYS,
} from '@/domain';

import { deleteOrphanAuthors, findOrCreateAuthor, listAuthorsForBook, setBookAuthors, updateAuthor } from './authors';
import { findOrCreateGenre, listGenresForBook, setBookGenres } from './genres';
import { findOrCreateSeries, getSeries } from './series';
import { BOOK_COLUMNS, NOW_SQL, sqlValue, toBook, type BookRow } from './shared';

import type { Db, SqlValue } from '../types';

export { createBookFromCandidate, refreshBook, type CandidateOverrides } from './bookLookups';

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

/** Who has the book and when it is due, for the Shelf's loan stamp (P05-09). */
const OPEN_LOAN_BORROWER = `(SELECT p.name FROM loans l JOIN borrowers p ON p.id = l.borrower_id
  WHERE l.book_id = b.id AND l.returned_on IS NULL)`;
const OPEN_LOAN_DUE = '(SELECT l.due_on FROM loans l WHERE l.book_id = b.id AND l.returned_on IS NULL)';

export interface ListBookItemsOptions {
  /** Matches title, subtitle, author names, series name and (normalised) ISBN, case-insensitively. */
  query?: string;
  sort?: ShelfSortKey;
  direction?: SortDirection;
  /** The Shelf's filters (see `filterClause`). */
  filters?: ShelfFilters;
  /** Only books by this author, in this genre or in this user group. */
  scope?: { authorId?: number; genreId?: number; groupId?: number };
  /** With `scope.groupId`: the group's own order instead of `sort`. */
  groupOrder?: boolean;
  limit?: number;
  offset?: number;
}

/** A SQL condition over `books b` (joined with `series s`) and its parameters. */
export interface SqlClause {
  sql: string;
  params: (string | number)[];
}

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/**
 * The Shelf filters as one WHERE condition. Different kinds of filter combine
 * with AND; the chosen genres, formats and languages are each alternatives
 * (OR, as `IN (…)`). Every value is a bound parameter: nothing the user typed
 * or stored is spliced into the SQL text. Returns null when nothing is set.
 */
export function filterClause(filters: ShelfFilters): SqlClause | null {
  const parts: string[] = [];
  const params: (string | number)[] = [];
  if (filters.genreIds.length) {
    parts.push(`EXISTS (SELECT 1 FROM book_genres bg WHERE bg.book_id = b.id AND bg.genre_id IN (${placeholders(filters.genreIds.length)}))`);
    params.push(...filters.genreIds);
  }
  if (filters.formats.length) {
    parts.push(`b.format IN (${placeholders(filters.formats.length)})`);
    params.push(...filters.formats);
  }
  if (filters.languages.length) {
    parts.push(`b.language IN (${placeholders(filters.languages.length)})`);
    params.push(...filters.languages);
  }
  if (filters.loan !== 'any') {
    parts.push(`${filters.loan === 'onLoan' ? '' : 'NOT '}EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.returned_on IS NULL)`);
  }
  if (filters.series !== 'any') parts.push(filters.series === 'inSeries' ? 'b.series_id IS NOT NULL' : 'b.series_id IS NULL');
  if (filters.yearFrom != null) {
    parts.push('b.publication_year >= ?');
    params.push(filters.yearFrom);
  }
  if (filters.yearTo != null) {
    parts.push('b.publication_year <= ?');
    params.push(filters.yearTo);
  }
  if (filters.recentlyAdded) {
    parts.push("b.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?)");
    params.push(`-${RECENTLY_ADDED_DAYS} days`);
  }
  return parts.length ? { sql: parts.map((p) => `(${p})`).join(' AND '), params } : null;
}

interface ListRow {
  id: number;
  title: string;
  subtitle: string | null;
  cover_uri: string | null;
  publication_year: number | null;
  series_id: number | null;
  series_name: string | null;
  series_position: number | null;
  on_loan: number;
  loan_borrower: string | null;
  loan_due_on: string | null;
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
  const { sort = 'title', direction = 'asc', limit, offset = 0, scope = {} } = options;
  const query = options.query?.trim() ?? '';
  const where: string[] = [];
  const params: (string | number)[] = [];
  const joins: string[] = [];
  if (scope.groupId != null) {
    joins.push('JOIN group_books gb ON gb.book_id = b.id AND gb.group_id = ?');
    params.push(scope.groupId);
  }
  if (scope.authorId != null) {
    where.push('EXISTS (SELECT 1 FROM book_authors sa WHERE sa.book_id = b.id AND sa.author_id = ?)');
    params.push(scope.authorId);
  }
  if (scope.genreId != null) {
    where.push('EXISTS (SELECT 1 FROM book_genres sg WHERE sg.book_id = b.id AND sg.genre_id = ?)');
    params.push(scope.genreId);
  }
  const filter = options.filters ? filterClause(options.filters) : null;
  if (filter) {
    where.push(filter.sql);
    params.push(...filter.params);
  }
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
  const order = scope.groupId != null && options.groupOrder ? `gb.position, ${SORT_TITLE}, b.id` : orderBy(sort, direction);
  const rows = await db.all<ListRow & { author_sort: string | null }>(
    `SELECT b.id, b.title, b.subtitle, b.cover_uri, b.publication_year, b.series_id, s.name AS series_name, b.series_position,
       EXISTS (SELECT 1 FROM loans l WHERE l.book_id = b.id AND l.returned_on IS NULL) AS on_loan,
       ${OPEN_LOAN_BORROWER} AS loan_borrower, ${OPEN_LOAN_DUE} AS loan_due_on,
       ${PRIMARY_AUTHOR_SORT} AS author_sort
     FROM books b ${joins.join(' ')} LEFT JOIN series s ON s.id = b.series_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${order}
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
    seriesId: r.series_id,
    seriesName: r.series_name,
    seriesPosition: r.series_position,
    onLoan: r.on_loan === 1,
    loanBorrower: r.loan_borrower,
    loanDueOn: r.loan_due_on,
  }));
}

/** What the Shelf's filter sheet can offer: only values some book actually has. */
export interface FilterOptions {
  genres: { id: number; name: string; count: number }[];
  formats: BookFormat[];
  languages: string[];
  minYear: number | null;
  maxYear: number | null;
}

export async function listFilterOptions(db: Db): Promise<FilterOptions> {
  const genres = await db.all<{ id: number; name: string; count: number }>(
    `SELECT g.id, g.name, COUNT(bg.book_id) AS count FROM genres g JOIN book_genres bg ON bg.genre_id = g.id
     GROUP BY g.id ORDER BY g.name COLLATE NOCASE`,
  );
  const formats = await db.all<{ format: BookFormat }>('SELECT DISTINCT format FROM books WHERE format IS NOT NULL');
  const languages = await db.all<{ language: string }>('SELECT DISTINCT language FROM books WHERE language IS NOT NULL ORDER BY language');
  const years = await db.get<{ min: number | null; max: number | null }>(
    'SELECT MIN(publication_year) AS min, MAX(publication_year) AS max FROM books',
  );
  const present = new Set(formats.map((f) => f.format));
  return {
    genres,
    formats: bookFormats.filter((f) => present.has(f)),
    languages: languages.map((l) => l.language),
    minYear: years?.min ?? null,
    maxYear: years?.max ?? null,
  };
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

// ---- Saving from the book form ----

/**
 * Saves a validated form draft in one transaction: the book (new books get
 * `source = 'manual'`), its series, its authors in order (reusing existing
 * authors case-insensitively; a typed sort name updates the author) and its
 * genres (marked as the user's choice). Authors left without books are
 * removed. Returns the book id.
 */
export async function saveBookDraft(db: Db, draft: ValidBookDraft, id?: number): Promise<number> {
  return db.transaction(async (tx) => {
    const series = draft.series ? await findOrCreateSeries(tx, draft.series.name) : null;
    const fields: BookPatch = {
      title: draft.title,
      subtitle: draft.subtitle,
      isbn13: draft.isbn13,
      isbn10: draft.isbn10,
      publisher: draft.publisher,
      publicationYear: draft.publicationYear,
      edition: draft.edition,
      format: draft.format,
      pageCount: draft.pageCount,
      language: draft.language,
      summary: draft.summary,
      notes: draft.notes,
      coverUri: draft.coverUri,
      seriesId: series?.id ?? null,
      seriesPosition: series ? (draft.series?.position ?? null) : null,
    };
    let bookId: number;
    if (id == null) {
      bookId = (await createBook(tx, { ...fields, title: draft.title, source: 'manual' })).id;
    } else {
      if (!(await updateBook(tx, id, fields))) throw new Error(`Book ${id} no longer exists`);
      bookId = id;
    }

    const links = [];
    for (const a of draft.authors) {
      const author = await findOrCreateAuthor(tx, a.name);
      if (a.sortName && a.sortName !== author.sortName) await updateAuthor(tx, author.id, { sortName: a.sortName });
      links.push({ authorId: author.id, role: a.role });
    }
    await setBookAuthors(tx, bookId, links);

    const genreIds = [];
    for (const name of draft.genres) genreIds.push((await findOrCreateGenre(tx, name)).id);
    await setBookGenres(tx, bookId, genreIds, { userEdited: true });

    await deleteOrphanAuthors(tx);
    return bookId;
  });
}

// ---- Delete with undo ----

type Row = Record<string, SqlValue>;

/**
 * Everything a book's deletion removes or orphans, captured as raw rows so
 * `restoreBook` can put it back with the same ids.
 */
export interface BookSnapshot {
  book: Row;
  authors: Row[];
  bookAuthors: Row[];
  genres: Row[];
  bookGenres: Row[];
  series: Row | null;
  groups: Row[];
  groupBooks: Row[];
  borrowers: Row[];
  loans: Row[];
}

/** Captures a book and everything linked to it; null if there is no such book. */
export async function snapshotBook(db: Db, id: number): Promise<BookSnapshot | null> {
  const book = await db.get<Row>('SELECT * FROM books WHERE id = ?', [id]);
  if (!book) return null;
  return {
    book,
    authors: await db.all<Row>('SELECT a.* FROM authors a JOIN book_authors ba ON ba.author_id = a.id WHERE ba.book_id = ?', [id]),
    bookAuthors: await db.all<Row>('SELECT * FROM book_authors WHERE book_id = ? ORDER BY position', [id]),
    genres: await db.all<Row>('SELECT g.* FROM genres g JOIN book_genres bg ON bg.genre_id = g.id WHERE bg.book_id = ?', [id]),
    bookGenres: await db.all<Row>('SELECT * FROM book_genres WHERE book_id = ?', [id]),
    series: book.series_id == null ? null : await db.get<Row>('SELECT * FROM series WHERE id = ?', [book.series_id]),
    groups: await db.all<Row>('SELECT g.* FROM groups g JOIN group_books gb ON gb.group_id = g.id WHERE gb.book_id = ?', [id]),
    groupBooks: await db.all<Row>('SELECT * FROM group_books WHERE book_id = ?', [id]),
    borrowers: await db.all<Row>('SELECT DISTINCT p.* FROM borrowers p JOIN loans l ON l.borrower_id = p.id WHERE l.book_id = ?', [id]),
    loans: await db.all<Row>('SELECT * FROM loans WHERE book_id = ? ORDER BY id', [id]),
  };
}

/**
 * Deletes a book in one transaction: its author, genre and group links and
 * its loan history go with it, and authors left without books are removed.
 * Returns the snapshot `restoreBook` needs to undo it (null if not found).
 */
export async function removeBook(db: Db, id: number): Promise<BookSnapshot | null> {
  return db.transaction(async (tx) => {
    const snapshot = await snapshotBook(tx, id);
    if (!snapshot) return null;
    await tx.run('DELETE FROM books WHERE id = ?', [id]);
    await deleteOrphanAuthors(tx);
    return snapshot;
  });
}

async function insertRow(db: Db, table: string, row: Row): Promise<void> {
  const cols = Object.keys(row);
  await db.run(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => row[c]),
  );
}

/**
 * Puts a row back with its old id when that id is free, reuses it when it
 * still holds the same entity (same `key` column), and otherwise inserts a
 * copy with a new id. Returns the id to link to.
 */
async function restoreEntity(db: Db, table: string, row: Row, key: string): Promise<number> {
  const existing = await db.get<Row>(`SELECT * FROM ${table} WHERE id = ?`, [row.id]);
  if (!existing) {
    await insertRow(db, table, row);
    return row.id as number;
  }
  if (existing[key] === row[key]) return row.id as number;
  const { id: _old, ...rest } = row;
  await insertRow(db, table, rest);
  return (await db.get<{ id: number }>('SELECT last_insert_rowid() AS id'))!.id;
}

/**
 * Undoes `removeBook`: re-inserts the book with the same id and every link
 * and loan, restoring authors, series, groups and borrowers that went
 * missing in the meantime. All or nothing.
 */
export async function restoreBook(db: Db, snapshot: BookSnapshot): Promise<void> {
  await db.transaction(async (tx) => {
    const series = snapshot.series ? await restoreEntity(tx, 'series', snapshot.series, 'name') : null;
    await insertRow(tx, 'books', { ...snapshot.book, series_id: series });
    const bookId = snapshot.book.id as number;

    const authorIds = new Map<SqlValue, number>();
    for (const a of snapshot.authors) authorIds.set(a.id, await restoreEntity(tx, 'authors', a, 'name'));
    for (const link of snapshot.bookAuthors) {
      await insertRow(tx, 'book_authors', { ...link, book_id: bookId, author_id: authorIds.get(link.author_id) ?? link.author_id });
    }

    // Genre names are unique, so a genre is found again by name.
    const genreIds = new Map<SqlValue, number>();
    for (const g of snapshot.genres) genreIds.set(g.id, (await findOrCreateGenre(tx, String(g.name))).id);
    for (const link of snapshot.bookGenres) {
      await insertRow(tx, 'book_genres', { ...link, book_id: bookId, genre_id: genreIds.get(link.genre_id) ?? link.genre_id });
    }

    const groupIds = new Map<SqlValue, number>();
    for (const g of snapshot.groups) groupIds.set(g.id, await restoreEntity(tx, 'groups', g, 'name'));
    for (const link of snapshot.groupBooks) {
      await insertRow(tx, 'group_books', { ...link, book_id: bookId, group_id: groupIds.get(link.group_id) ?? link.group_id });
    }

    const borrowerIds = new Map<SqlValue, number>();
    for (const b of snapshot.borrowers) borrowerIds.set(b.id, await restoreEntity(tx, 'borrowers', b, 'name'));
    for (const loan of snapshot.loans) {
      await insertRow(tx, 'loans', { ...loan, book_id: bookId, borrower_id: borrowerIds.get(loan.borrower_id) ?? loan.borrower_id });
    }
  });
}
