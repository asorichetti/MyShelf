import type { Migration } from './types';

/**
 * The Shelf's slow sort keys, stored once per book instead of worked out
 * for every book in every Shelf query (Phase 11's budget: every preset
 * under 100 ms with 10,000 books on the web build, on machines slower than
 * a laptop).
 *
 * `book_sort_keys` has one row per book:
 *
 * - `title`: the title as a library files it (a leading The, A or An
 *   ignored), accents folded. Every sort ends with it.
 * - `author`: the first credited author's sort name (or name), folded.
 * - `genre`: the primary genre, the first of the book's genres in
 *   alphabetical order ignoring case, folded.
 * - `series`: the series name, folded.
 * - `author_names`: the credited authors' names in order, joined with the
 *   unit separator (char 31), so the Shelf lists a book's authors without a
 *   second query over every author link.
 * - `call_number`, `call_key`: the call number the book page prints
 *   ("FIC PRA 1983") and a text that sorts in shelf order.
 * - `rules`: which version of the rules made the row; 0 until it is made.
 *
 * The values come from the app (`ensureSortKeys` in src/db/sortKeyStore.ts):
 * the folds are the Shelf's own SQL (`foldSql`) and the call number is
 * `callNumber()` in TypeScript, which SQL cannot run. So the triggers here
 * only mark a book's row as out of date (rules 0) when anything it is made
 * from changes (the book's title, year or series; its authors or genres;
 * an author's name or sort name; a genre's or series' name), whatever
 * writes the library (the form, lookups, imports, restores, merges, undo,
 * erasing), and the app makes the rows that need it before it reads them.
 * Triggers that only mark are cheap to run and to prepare, which matters:
 * every statement that fires a trigger compiles it again.
 *
 * Deleting an author, genre or series reaches the books through the deletes
 * and updates it causes (ON DELETE CASCADE / SET NULL), which fire the
 * triggers below.
 *
 * This migration adds a row, to be made, for every book; the app makes them
 * the first time it lists the library (a migration must not call app code,
 * which later schemas may change). The table is not part of a backup: it is
 * rebuilt from the library.
 */

/** Marks the rows of the books whose ids `ids` (a SQL list or subquery) yields as out of date. */
const stale = (ids: string) => `UPDATE book_sort_keys SET rules = 0 WHERE book_id IN (${ids}) AND rules <> 0;`;

/** Adds a row for the book `id` unless it has one (a row left behind keeps its place, marked out of date by `stale`). */
const ensureRow = (id: string) => `INSERT INTO book_sort_keys (book_id) SELECT ${id} WHERE NOT EXISTS (SELECT 1 FROM book_sort_keys WHERE book_id = ${id});`;

const trigger = (name: string, when: string, body: string) => `CREATE TRIGGER ${name} ${when} BEGIN
    ${body}
  END;`;

const changed = (...cols: string[]) => cols.map((c) => `OLD.${c} IS NOT NEW.${c}`).join(' OR ');

export const bookSortKeys: Migration = {
  version: 10,
  name: '0010_book_sort_keys',
  up: [
    `CREATE TABLE book_sort_keys (
  book_id      INTEGER PRIMARY KEY,
  rules        INTEGER NOT NULL DEFAULT 0,
  title        TEXT,
  author       TEXT,
  author_names TEXT,
  genre        TEXT,
  series       TEXT,
  call_number  TEXT,
  call_key     TEXT
);
CREATE INDEX book_sort_keys_rules_idx ON book_sort_keys (rules);`,
    // No OR IGNORE / OR REPLACE in these bodies: the statement that fires a trigger imposes its own conflict policy on them.
    trigger('book_sort_books_ai', 'AFTER INSERT ON books', `${ensureRow('NEW.id')}\n    ${stale('NEW.id')}`),
    trigger(
      'book_sort_books_au',
      `AFTER UPDATE OF id, title, series_id, publication_year ON books WHEN ${changed('id', 'title', 'series_id', 'publication_year')}`,
      `DELETE FROM book_sort_keys WHERE book_id = OLD.id AND OLD.id IS NOT NEW.id;
    ${ensureRow('NEW.id')}
    ${stale('NEW.id')}`,
    ),
    trigger('book_sort_books_ad', 'AFTER DELETE ON books', 'DELETE FROM book_sort_keys WHERE book_id = OLD.id;'),
    trigger('book_sort_book_authors_ai', 'AFTER INSERT ON book_authors', stale('NEW.book_id')),
    trigger('book_sort_book_authors_au', 'AFTER UPDATE ON book_authors', stale('OLD.book_id, NEW.book_id')),
    trigger('book_sort_book_authors_ad', 'AFTER DELETE ON book_authors', stale('OLD.book_id')),
    trigger(
      'book_sort_authors_au',
      `AFTER UPDATE OF name, sort_name ON authors WHEN ${changed('name', 'sort_name')}`,
      stale('SELECT book_id FROM book_authors WHERE author_id = NEW.id'),
    ),
    trigger('book_sort_book_genres_ai', 'AFTER INSERT ON book_genres', stale('NEW.book_id')),
    trigger('book_sort_book_genres_au', `AFTER UPDATE OF book_id, genre_id ON book_genres WHEN ${changed('book_id', 'genre_id')}`, stale('OLD.book_id, NEW.book_id')),
    trigger('book_sort_book_genres_ad', 'AFTER DELETE ON book_genres', stale('OLD.book_id')),
    trigger('book_sort_genres_au', `AFTER UPDATE OF name ON genres WHEN ${changed('name')}`, stale('SELECT book_id FROM book_genres WHERE genre_id = NEW.id')),
    trigger('book_sort_series_au', `AFTER UPDATE OF name ON series WHEN ${changed('name')}`, stale('SELECT id FROM books WHERE series_id = NEW.id')),
    'INSERT INTO book_sort_keys (book_id) SELECT id FROM books;',
  ].join('\n'),
};
