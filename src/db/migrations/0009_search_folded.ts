import type { Db } from '../types';
import type { Migration } from './types';

/**
 * The search index also holds each book's text with the letters Unicode
 * cannot take an accent off spelt the way people type them without one:
 * ø → o, ł → l, đ and ð → d, ß → ss, æ → ae, œ → oe, þ → th, ı → i (in
 * either case), the letters `stripDiacritics` folds the same way. A search
 * folds every word like that, so "soren" finds "Søren", "lodz" "Łódź" and
 * "strasse" "Straße".
 *
 * Before, FTS5 (Android) kept those letters as they were, so "soren" found
 * nothing there, and the plain index (web) matched ø, ł and đ from a plain
 * letter but not ß, æ, œ or þ from two. Now:
 *
 * - FTS5: `books_fts` gains a column, `folded`, the folded copy of all the
 *   other columns. A search matches any column, so the words typed as
 *   written still match the originals and the folded words match the copy.
 * - Plain index: `books_search.body` holds the folded text (the words typed
 *   as written are looked for folded too, see `searchWordSpellings`).
 *
 * The index is dropped and built again, with the same view and the same
 * triggers as 0006 (so every write path keeps it current), and filled from
 * the library. A database without a search index (only ever in tests of
 * migrations before 0006) is left alone.
 */

/** Letters folded, as `stripDiacritics` folds them (both cases: SQLite's `lower` folds ASCII only). */
const FOLDS: readonly [string, string][] = [
  ['ø', 'o'], ['Ø', 'o'], ['ł', 'l'], ['Ł', 'l'], ['đ', 'd'], ['Đ', 'd'], ['ð', 'd'], ['Ð', 'd'],
  ['ß', 'ss'], ['ẞ', 'ss'], ['æ', 'ae'], ['Æ', 'ae'], ['œ', 'oe'], ['Œ', 'oe'], ['þ', 'th'], ['Þ', 'th'], ['ı', 'i'],
];

/** `expr` with those letters folded. */
function fold(expr: string): string {
  let out = expr;
  for (const [from, to] of FOLDS) out = `replace(${out}, '${from}', '${to}')`;
  return out;
}

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

type Kind = 'fts5' | 'plain';

/** Punctuation the plain index stores as spaces (as in 0006). */
const SEPARATORS = ['-', '/', '(', ')', '[', ']', '.', ',', ':', ';', '!', '?', '&', '+', '_', "'", '"', '’', '‘', '“', '”', '–', '—'];

function spaced(expr: string): string {
  let out = `lower(${expr})`;
  for (const c of SEPARATORS) out = `replace(${out}, '${c.replace(/'/g, "''")}', ' ')`;
  for (const code of [9, 10, 13]) out = `replace(${out}, char(${code}), ' ')`;
  return `' ' || ${out}`;
}

const TEXT = "(title || ' ' || subtitle || ' ' || authors || ' ' || series || ' ' || genres || ' ' || notes || ' ' || isbn)";

function refresh(kind: Kind, ids: string): string {
  if (kind === 'fts5') {
    return `DELETE FROM books_fts WHERE rowid IN (${ids});
    INSERT INTO books_fts (rowid, title, subtitle, authors, series, genres, notes, isbn, folded)
      SELECT id, title, subtitle, authors, series, genres, notes, isbn, ${fold(TEXT)} FROM book_search_source WHERE id IN (${ids});`;
  }
  return `DELETE FROM books_search WHERE book_id IN (${ids});
    INSERT INTO books_search (book_id, body, ascii)
      SELECT id, ${spaced(fold(TEXT))}, ${fold(TEXT)} NOT GLOB '*[^ -~]*'
      FROM book_search_source WHERE id IN (${ids});`;
}

function forget(kind: Kind, id: string): string {
  return kind === 'fts5' ? `DELETE FROM books_fts WHERE rowid = ${id};` : `DELETE FROM books_search WHERE book_id = ${id};`;
}

/** Table, view, triggers (the same as 0006's) and the first fill. */
export function foldedSearchSchema(kind: Kind): string {
  const table =
    kind === 'fts5'
      ? `CREATE VIRTUAL TABLE books_fts USING fts5(title, subtitle, authors, series, genres, notes, isbn, folded, tokenize = 'unicode61 remove_diacritics 2');`
      : 'CREATE TABLE books_search (book_id INTEGER PRIMARY KEY, body TEXT NOT NULL, ascii INTEGER NOT NULL);';
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
    refresh(kind, 'SELECT id FROM books'),
  ].join('\n');
}

/** Drops the search index 0006 (or 0008) built: its triggers, view and table. Returns which kind it was, or null. */
async function dropSearchIndex(tx: Db): Promise<Kind | null> {
  const tables = await tx.all<{ name: string }>("SELECT name FROM sqlite_master WHERE name IN ('books_fts', 'books_search')");
  const kind: Kind | null = tables.some((r) => r.name === 'books_fts') ? 'fts5' : tables.length ? 'plain' : null;
  if (!kind) return null;
  const triggers = await tx.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'book\\_search\\_%' ESCAPE '\\'");
  for (const { name } of triggers) await tx.exec(`DROP TRIGGER ${name};`);
  await tx.exec(`DROP VIEW IF EXISTS book_search_source; DROP TABLE ${kind === 'fts5' ? 'books_fts' : 'books_search'};`);
  return kind;
}

export const searchFolded: Migration = {
  version: 9,
  name: '0009_search_folded',
  up: async (tx) => {
    const kind = await dropSearchIndex(tx);
    if (kind) await tx.exec(foldedSearchSchema(kind));
  },
};
