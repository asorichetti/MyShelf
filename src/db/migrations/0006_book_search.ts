import type { Db } from '../types';
import type { Migration } from './types';

/**
 * Full-text search over the catalogue (P09-03): each book's title, subtitle,
 * authors, series, genres, notes and ISBNs in one searchable row, kept in step
 * with the library by triggers, so every write path (the form, lookups,
 * imports, restores, merges, erasing) updates it without knowing it exists.
 *
 * Where SQLite has FTS5 (expo-sqlite on Android builds it in) the row lives in
 * `books_fts`, an FTS5 table whose `unicode61 remove_diacritics 2` tokenizer
 * makes "cien anos" find "Cien años" and answers prefix queries from an index.
 * Where it does not (the web build's wa-sqlite and Node's built-in SQLite,
 * which Jest uses, are both compiled without it) the same text goes into
 * `books_search`, a plain table that the repository searches for the start
 * of words with GLOB patterns that fold case and accents themselves (see
 * `searchClause` in repositories/books.ts).
 * Neither table is part of a backup: both are rebuilt from the library.
 */

/** The text a book is found by, one row per book. Both search tables are filled from it. */
const SOURCE_VIEW = `
CREATE VIEW book_search_source AS
SELECT
  b.id AS id,
  b.title AS title,
  COALESCE(b.subtitle, '') AS subtitle,
  COALESCE((SELECT group_concat(a.name, ' ') FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id), '') AS authors,
  COALESCE(s.name, '') AS series,
  COALESCE((SELECT group_concat(g.name, ' ') FROM book_genres bg JOIN genres g ON g.id = bg.genre_id WHERE bg.book_id = b.id), '') AS genres,
  COALESCE(b.notes, '') AS notes,
  trim(COALESCE(b.isbn13, '') || ' ' || COALESCE(b.isbn10, '')) AS isbn
FROM books b LEFT JOIN series s ON s.id = b.series_id;
`;

export type SearchIndexKind = 'fts5' | 'plain';

/**
 * Punctuation the plain index stores as spaces, so that every word in its
 * text follows a space and a search can look for " word" (a fast GLOB)
 * rather than for any non-letter before it. Anything rarer than these still
 * separates words for FTS5 but not for the plain index.
 */
const SEPARATORS = ['-', '/', '(', ')', '[', ']', '.', ',', ':', ';', '!', '?', '&', '+', '_', "'", '"', '’', '‘', '“', '”', '–', '—'];

/** `expr` with the separators, tabs and line breaks as spaces, and a space in front. */
function spaced(expr: string): string {
  let out = expr;
  for (const c of SEPARATORS) out = `replace(${out}, '${c.replace(/'/g, "''")}', ' ')`;
  for (const code of [9, 10, 13]) out = `replace(${out}, char(${code}), ' ')`;
  return `' ' || ${out}`;
}

/** SQL that forgets and re-reads the search rows of the books whose ids `ids` (a SQL list or subquery) yields. */
function refresh(kind: SearchIndexKind, ids: string): string {
  if (kind === 'fts5') {
    return `DELETE FROM books_fts WHERE rowid IN (${ids});
    INSERT INTO books_fts (rowid, title, subtitle, authors, series, genres, notes, isbn)
      SELECT id, title, subtitle, authors, series, genres, notes, isbn FROM book_search_source WHERE id IN (${ids});`;
  }
  return `DELETE FROM books_search WHERE book_id IN (${ids});
    INSERT INTO books_search (book_id, body)
      SELECT id, ${spaced("title || ' ' || subtitle || ' ' || authors || ' ' || series || ' ' || genres || ' ' || notes || ' ' || isbn")}
      FROM book_search_source WHERE id IN (${ids});`;
}

function forget(kind: SearchIndexKind, id: string): string {
  return kind === 'fts5' ? `DELETE FROM books_fts WHERE rowid = ${id};` : `DELETE FROM books_search WHERE book_id = ${id};`;
}

/** The whole schema for one kind of index: table, triggers and the first fill. */
export function bookSearchSchema(kind: SearchIndexKind): string {
  const table =
    kind === 'fts5'
      ? `CREATE VIRTUAL TABLE books_fts USING fts5(title, subtitle, authors, series, genres, notes, isbn, tokenize = 'unicode61 remove_diacritics 2');`
      : 'CREATE TABLE books_search (book_id INTEGER PRIMARY KEY, body TEXT NOT NULL);';
  const trigger = (name: string, when: string, body: string) => `CREATE TRIGGER ${name} ${when} BEGIN
    ${body}
  END;`;
  const booksWithAuthor = (id: string) => `SELECT book_id FROM book_authors WHERE author_id = ${id}`;
  const booksWithGenre = (id: string) => `SELECT book_id FROM book_genres WHERE genre_id = ${id}`;
  const booksInSeries = (id: string) => `SELECT id FROM books WHERE series_id = ${id}`;
  return [
    SOURCE_VIEW,
    table,
    trigger('book_search_books_ai', 'AFTER INSERT ON books', refresh(kind, 'NEW.id')),
    trigger('book_search_books_au', 'AFTER UPDATE OF id, title, subtitle, notes, isbn13, isbn10, series_id ON books', `${forget(kind, 'OLD.id')}\n${refresh(kind, 'NEW.id')}`),
    trigger('book_search_books_ad', 'AFTER DELETE ON books', forget(kind, 'OLD.id')),
    trigger('book_search_book_authors_ai', 'AFTER INSERT ON book_authors', refresh(kind, 'NEW.book_id')),
    trigger('book_search_book_authors_au', 'AFTER UPDATE ON book_authors', `${refresh(kind, 'OLD.book_id')}\n${refresh(kind, 'NEW.book_id')}`),
    trigger('book_search_book_authors_ad', 'AFTER DELETE ON book_authors', refresh(kind, 'OLD.book_id')),
    trigger('book_search_authors_au', 'AFTER UPDATE OF name ON authors', refresh(kind, booksWithAuthor('NEW.id'))),
    trigger('book_search_book_genres_ai', 'AFTER INSERT ON book_genres', refresh(kind, 'NEW.book_id')),
    trigger('book_search_book_genres_au', 'AFTER UPDATE ON book_genres', `${refresh(kind, 'OLD.book_id')}\n${refresh(kind, 'NEW.book_id')}`),
    trigger('book_search_book_genres_ad', 'AFTER DELETE ON book_genres', refresh(kind, 'OLD.book_id')),
    trigger('book_search_genres_au', 'AFTER UPDATE OF name ON genres', refresh(kind, booksWithGenre('NEW.id'))),
    trigger('book_search_series_au', 'AFTER UPDATE OF name ON series', refresh(kind, booksInSeries('NEW.id'))),
    // Deleting a series sets its books' series_id to NULL, which the books trigger above sees.
    refresh(kind, 'SELECT id FROM books'),
  ].join('\n');
}

/**
 * Whether this SQLite has FTS5. Creating a throwaway temporary table is the
 * only reliable test (FTS5 can be built in or loaded, and `PRAGMA
 * module_list` is not always compiled in); a failed CREATE leaves the
 * transaction untouched.
 */
export async function hasFts5(db: Db): Promise<boolean> {
  try {
    await db.exec('CREATE VIRTUAL TABLE temp.fts5_probe USING fts5(x); DROP TABLE temp.fts5_probe;');
    return true;
  } catch {
    return false;
  }
}

export const bookSearch: Migration = {
  version: 6,
  name: '0006_book_search',
  up: async (tx) => {
    await tx.exec(bookSearchSchema((await hasFts5(tx)) ? 'fts5' : 'plain'));
  },
};
