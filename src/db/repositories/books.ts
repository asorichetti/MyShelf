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
  type ShelfSort,
  type ValidBookDraft,
  isRating,
  defaultShelfSort,
  RECENTLY_ADDED_DAYS,
  stripDiacritics,
} from '@/domain';


import { buildSortSql, SORT_JOINS, SORT_TITLE_SQL } from '../sortKeys';
import { deleteOrphanAuthors, findOrCreateAuthor, listAuthorsForBook, setBookAuthors, updateAuthor } from './authors';
import { findOrCreateGenre, listGenresForBook, setBookGenres } from './genres';
import { findOrCreateSeries, getSeries } from './series';
import { BOOK_COLUMNS, NOW_SQL, sqlValue, toBook, type BookRow } from './shared';

import type { SearchIndexKind } from '../migrations/0006_book_search';
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
  rating: 'rating',
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

/** Sets when a book was added (an import keeps the date from the old catalogue). */
export async function setAddedAt(db: Db, id: number, createdAt: string): Promise<void> {
  await db.run('UPDATE books SET created_at = ?, updated_at = ? WHERE id = ?', [createdAt, createdAt, id]);
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

/**
 * Sets (1-5) or clears (null) the reader's rating, and nothing else. Returns
 * false if the book does not exist. Throws for anything that is not a whole
 * number of stars (the column's CHECK would refuse it too).
 */
export async function setRating(db: Db, bookId: number, rating: number | null): Promise<boolean> {
  if (rating !== null && !isRating(rating)) throw new RangeError(`A rating is 1 to 5 whole stars, not ${String(rating)}`);
  const { changes } = await db.run(`UPDATE books SET rating = ?, updated_at = ${NOW_SQL} WHERE id = ?`, [rating, bookId]);
  return changes > 0;
}

/** Deletes a book along with its author/genre/group links and loan history. */
export async function deleteBook(db: Db, id: number): Promise<boolean> {
  const { changes } = await db.run('DELETE FROM books WHERE id = ?', [id]);
  return changes > 0;
}

// ---- Shelf list ----

/**
 * Who has the book and when it is due, for the Shelf's loan stamp (P05-09):
 * one join, since a book has at most one open loan (`loans_one_open_per_book`).
 * The series and open-loan joins are the ones the sort keys read (`SORT_JOINS`).
 */
const BASE_JOINS = `${SORT_JOINS.series} ${SORT_JOINS.openLoan}`;

export interface ListBookItemsOptions {
  /** Full-text search: every word must match the title, subtitle, authors, series, genres, notes or ISBN (see `searchClause`). */
  query?: string;
  /** One to four levels (see src/db/sortKeys.ts); title order by default. */
  sort?: ShelfSort;
  /** The theme's rainbow order of generated bindings, for the "Spine colour" key (`SortOptions.coverOrder`). */
  coverOrder?: readonly number[];
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
  if (filters.minRating != null) {
    parts.push('b.rating >= ?');
    params.push(filters.minRating);
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
  rating: number | null;
}

const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Only digit-ish queries ("978-0-441", "0441172717") are also matched against ISBNs. */
function isbnFragment(query: string): string | null {
  if (!/^[\d\sXx-]+$/.test(query)) return null;
  const n = normalizeIsbn(query);
  return n && n.replace(/X$/, '').length >= 4 ? n : null;
}

/** At most this many words of a search are used. */
const MAX_SEARCH_TERMS = 8;

/**
 * The words of a search, as the index sees them: accents dropped, lower
 * case, split at anything that is not a letter or a digit ("Cien años" →
 * `cien`, `anos`; "O'Brien" → `o`, `brien`).
 */
export function searchTerms(query: string): string[] {
  return stripDiacritics(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
}

/**
 * Each word of a search in the spellings it may be stored under: fully
 * folded (`searchTerms`: "søren" → "soren", "straße" → "strasse") and with
 * only the accents Unicode can take off a letter ("søren", "straße",
 * "łodz"). Since migration 0009 both indexes hold a folded copy of the text
 * (ø, ł, đ, ß, æ, œ, þ spelt o, l, d, ss, ae, oe, th), which the first kind
 * matches; FTS5 also keeps the text as written, which the second matches.
 * One entry per word; a word's spellings are alternatives.
 */
function searchWordSpellings(query: string): string[][] {
  const words = query.normalize('NFC').split(/[^\p{L}\p{N}\p{M}]+/u).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words.slice(0, MAX_SEARCH_TERMS).map((word) => {
    const folded = searchTerms(word).join('');
    const light = word.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').toLowerCase();
    return light === folded ? [folded] : [folded, light];
  });
}

const searchIndexes = new WeakMap<Db, Promise<SearchIndexKind | null>>();

/**
 * Which search index this database has (migration 0006): `fts5` where SQLite
 * has FTS5 (Android), `plain` elsewhere (web, Node), null before 0006.
 * Remembered per database handle once found.
 */
export function searchIndexKind(db: Db): Promise<SearchIndexKind | null> {
  let kind = searchIndexes.get(db);
  if (!kind) {
    kind = db
      .all<{ name: string }>("SELECT name FROM sqlite_master WHERE name IN ('books_fts', 'books_search')")
      .then((rows) => (rows.some((r) => r.name === 'books_fts') ? 'fts5' : rows.length ? 'plain' : null));
    // Only a found index is remembered: a database may still be migrated to one.
    kind.then((k) => k ?? searchIndexes.delete(db), () => searchIndexes.delete(db));
    searchIndexes.set(db, kind);
  }
  return kind;
}

let letterClasses: Map<string, string> | undefined;

/**
 * GLOB character classes that match a letter with any accent and in either
 * case (`a` → `[aAàáâãäå…]`), built from `stripDiacritics` over Latin-1 and
 * Latin Extended-A/B so the plain index folds accents the way FTS5 does.
 */
function letterClass(ch: string): string {
  if (!letterClasses) {
    const sets = new Map<string, Set<string>>();
    // The plain index is stored lower-cased (ASCII only): each class starts with its ASCII letter, the
    // likeliest match, followed by the accented letters in both cases.
    for (let cp = 0x61; cp <= 0x24f; cp++) {
      if (cp > 0x7a && cp < 0xc0) continue;
      const c = String.fromCodePoint(cp);
      const base = stripDiacritics(c).toLowerCase();
      if (!/^[a-z]$/.test(base)) continue;
      if (!sets.has(base)) sets.set(base, new Set());
      sets.get(base)!.add(c);
    }
    letterClasses = new Map([...sets].map(([base, chars]) => [base, `[${[...chars].join('')}]`]));
  }
  const known = letterClasses.get(ch);
  if (known) return known;
  const upper = ch.toUpperCase();
  if (upper !== ch && upper.length === 1) return `[${ch}${upper}]`;
  return /[*?[\]]/.test(ch) ? `[${ch}]` : ch;
}

/**
 * A GLOB pattern that finds a word starting with `term` in the plain index's
 * text (where every word follows a space: migration 0006), ignoring case and
 * accents.
 */
export function searchGlob(term: string): string {
  return `* ${[...term].map(letterClass).join('')}*`;
}

/**
 * The search condition over `books b` for the Shelf and every list built on
 * `listBookItems`. Every word must match (in any field, in any order):
 *
 * - With FTS5 (`books_fts`), each word matches the start of a word in the
 *   title, subtitle, authors, series, genres, notes or ISBNs ("prat" finds
 *   Pratchett, "cien anos" finds "Cien años").
 * - With the plain index (`books_search`; web and Node have no FTS5), the
 *   same: each word matches the start of a word in that same text, found
 *   with `instr` in rows that are all ASCII and with a GLOB pattern that
 *   folds case and accents in the rest. The two agree except for words
 *   longer than FTS5 indexes.
 * - Letters with no accent to take off (ø, ł, đ, ß, æ, œ, þ) are found
 *   from the letters people type for them ("soren", "lodz", "strasse",
 *   "aelfric"): since migration 0009 both indexes hold the text with them
 *   folded, as `searchTerms` folds each word. A word is also looked for as
 *   typed, less its accents (`searchWordSpellings`), so "Søren", "Straße"
 *   or "Ælfric" typed as written finds the book too.
 * - Without either (a database from before migration 0006), the old `LIKE`
 *   over title, subtitle, series and author names.
 *
 * A digit-ish query ("978-0-441", "1984") is one word, its ISBN digits, and
 * also matches the ISBN columns anywhere; its `rank` puts books with those
 * digits in the title or subtitle first, before books that match only
 * through an ISBN. Returns null for a blank query.
 */
export async function searchClause(db: Db, query: string): Promise<(SqlClause & { rank?: SqlClause }) | null> {
  const text = query.trim();
  if (!text) return null;
  const isbn = isbnFragment(text);
  const words = isbn ? [[isbn.toLowerCase()]] : searchWordSpellings(text);
  const kind = words.length ? await searchIndexKind(db) : null;
  const alternatives: string[] = [];
  const params: (string | number)[] = [];
  const isAscii = (t: string) => /^[\x20-\x7e]+$/.test(t);
  if (kind === 'fts5') {
    alternatives.push('b.id IN (SELECT rowid FROM books_fts WHERE books_fts MATCH ?)');
    // FTS5 takes no implicit AND after a bracket, so the words are joined with an explicit one.
    params.push(words.map((spellings) => (spellings.length > 1 ? `(${spellings.map((t) => `"${t}"*`).join(' OR ')})` : `"${spellings[0]}"*`)).join(' AND '));
  } else if (kind === 'plain') {
    // ASCII text cannot hold an accent to fold: a plain substring search for " word" is enough, and fast.
    const conditions = words.map((spellings) => {
      const each = spellings.map((t) => (isAscii(t) ? '(CASE WHEN ascii THEN instr(body, ?) > 0 ELSE body GLOB ? END)' : 'body GLOB ?'));
      return each.length > 1 ? `(${each.join(' OR ')})` : each[0];
    });
    alternatives.push(`b.id IN (SELECT book_id FROM books_search WHERE ${conditions.join(' AND ')})`);
    for (const t of words.flat()) params.push(...(isAscii(t) ? [` ${t}`, searchGlob(t)] : [searchGlob(t)]));
  } else {
    const like = `%${likeEscape(text)}%`;
    alternatives.push(
      "b.title LIKE ? ESCAPE '\\'",
      "b.subtitle LIKE ? ESCAPE '\\'",
      "b.series_id IN (SELECT id FROM series WHERE name LIKE ? ESCAPE '\\')",
      "EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id AND a.name LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like);
  }
  if (isbn) {
    alternatives.push('b.isbn13 LIKE ?', 'b.isbn10 LIKE ?');
    params.push(`%${isbn}%`, `%${isbn}%`);
    // "1984" is a title as much as ISBN digits: books with it in the title or subtitle go before those that only have it in an ISBN.
    const rank = { sql: "CASE WHEN b.title LIKE ? OR b.subtitle LIKE ? THEN 0 ELSE 1 END", params: [`%${isbn}%`, `%${isbn}%`] };
    return { sql: `(${alternatives.join(' OR ')})`, params, rank };
  }
  return { sql: `(${alternatives.join(' OR ')})`, params };
}

/**
 * The Shelf list: one query for the rows (sorted and filtered in SQL) plus
 * one for their authors, whatever the number of books.
 */
export async function listBookItems(db: Db, options: ListBookItemsOptions = {}): Promise<BookListItem[]> {
  const { sort = defaultShelfSort, limit, offset = 0, scope = {} } = options;
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
  const search = await searchClause(db, query);
  if (search) {
    where.push(search.sql);
    params.push(...search.params);
  }
  const groupOrder = scope.groupId != null && options.groupOrder;
  const order = groupOrder ? { orderBy: `gb.position, ${SORT_TITLE_SQL} COLLATE NOCASE, b.id`, params: [] } : await buildSortSql(db, sort, { coverOrder: options.coverOrder });
  const rows = await db.all<ListRow>(
    `SELECT b.id, b.title, b.subtitle, b.cover_uri, b.publication_year, b.series_id, s.name AS series_name, b.series_position,
       ol.id IS NOT NULL AS on_loan, olp.name AS loan_borrower, ol.due_on AS loan_due_on, b.rating
     FROM books b ${joins.join(' ')} ${BASE_JOINS}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${search?.rank ? `${search.rank.sql}, ` : ''}${order.orderBy}
     ${limit != null ? 'LIMIT ? OFFSET ?' : ''}`,
    [...params, ...(search?.rank?.params ?? []), ...order.params, ...(limit != null ? [limit, offset] : [])],
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
    rating: r.rating ?? null,
  }));
}

/** What the Shelf's filter sheet can offer: only values some book actually has. */
export interface FilterOptions {
  genres: { id: number; name: string; count: number }[];
  formats: BookFormat[];
  languages: string[];
  minYear: number | null;
  maxYear: number | null;
  /** Whether any book is rated. */
  hasRatings: boolean;
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
  const rated = await db.get<{ n: number }>('SELECT EXISTS (SELECT 1 FROM books WHERE rating IS NOT NULL) AS n');
  const present = new Set(formats.map((f) => f.format));
  return {
    genres,
    formats: bookFormats.filter((f) => present.has(f)),
    languages: languages.map((l) => l.language),
    minYear: years?.min ?? null,
    maxYear: years?.max ?? null,
    hasRatings: rated?.n === 1,
  };
}

/** Above this many books, reading every author link at once beats asking for each chunk of ids. */
const ALL_AUTHORS_ABOVE = 1000;

/** Credited author names per book, in order: one query per 500 books, or one for the whole library for long lists. */
async function authorNamesFor(db: Db, bookIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  const add = (rows: { book_id: number; name: string }[], wanted?: Set<number>) => {
    for (const r of rows) {
      if (wanted && !wanted.has(r.book_id)) continue;
      const list = out.get(r.book_id);
      if (list) list.push(r.name);
      else out.set(r.book_id, [r.name]);
    }
  };
  const sql = (where: string) =>
    `SELECT ba.book_id, a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id ${where} ORDER BY ba.book_id, ba.position, a.id`;
  if (bookIds.length > ALL_AUTHORS_ABOVE) {
    add(await db.all<{ book_id: number; name: string }>(sql('')), new Set(bookIds));
    return out;
  }
  for (let i = 0; i < bookIds.length; i += 500) {
    const ids = bookIds.slice(i, i + 500);
    add(await db.all<{ book_id: number; name: string }>(sql(`WHERE ba.book_id IN (${ids.map(() => '?').join(', ')})`), ids));
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
      // Undefined (a refresh) leaves the stored rating as it is.
      rating: draft.rating,
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

/** Inserts a row with its old id when that id is free, else as a new row. Returns the id it got. */
async function insertWithId(db: Db, table: string, row: Row): Promise<number> {
  if (!(await db.get(`SELECT 1 FROM ${table} WHERE id = ?`, [row.id]))) {
    await insertRow(db, table, row);
    return row.id as number;
  }
  const { id: _old, ...rest } = row;
  await insertRow(db, table, rest);
  return (await db.get<{ id: number }>('SELECT last_insert_rowid() AS id'))!.id;
}

/**
 * Undoes `removeBook`: re-inserts the book and every link and loan,
 * restoring authors, series, groups and borrowers that went missing in the
 * meantime. The book keeps its id: new books and loans never reuse one
 * (migration 0008). Should a book hold it all the same (a backup restored
 * meanwhile, with its own ids), the book comes back with a new id; the same
 * goes for its loans. All or nothing. Returns the book's id.
 */
export async function restoreBook(db: Db, snapshot: BookSnapshot): Promise<number> {
  return db.transaction(async (tx) => {
    const series = snapshot.series ? await restoreEntity(tx, 'series', snapshot.series, 'name') : null;
    const bookId = await insertWithId(tx, 'books', { ...snapshot.book, series_id: series });

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
      await insertWithId(tx, 'loans', { ...loan, book_id: bookId, borrower_id: borrowerIds.get(loan.borrower_id) ?? loan.borrower_id });
    }
    return bookId;
  });
}
