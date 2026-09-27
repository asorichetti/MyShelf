import { bookSearchSchema, type SearchIndexKind } from './0006_book_search';

import type { Migration } from './types';

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

/**
 * Book and loan ids are never handed out twice. Without AUTOINCREMENT,
 * SQLite gives a new row the highest id plus one, so deleting the newest
 * book freed its id for the next book added — while Undo was still offered
 * for the deleted one, whose cover file (`covers/<id>.jpg`), loan reminders
 * and "not a series" setting are all found by that id. With AUTOINCREMENT
 * a new row always gets an id above every id the table has ever used
 * (tracked in `sqlite_sequence`).
 *
 * AUTOINCREMENT can only be declared when a table is created, so `books`
 * and `loans` are rebuilt the way SQLite documents it: with foreign keys
 * off (dropping a table with them on would delete every row that points at
 * it), a new table under a temporary name, every row copied with its id,
 * the old table dropped and the new one renamed. The columns, checks,
 * defaults and indexes are exactly those of 0001 and 0007. Links to books
 * (authors, genres, groups, loans, cover attempts) name the table, so they
 * follow the new one. The search index (0006) reads `books` through a view
 * and triggers, which are dropped first and built again, with the index,
 * at the end.
 */
export const noIdReuse: Migration = {
  version: 8,
  name: '0008_no_id_reuse',
  foreignKeysOff: true,
  up: async (tx) => {
    const search = await tx.all<{ name: string }>("SELECT name FROM sqlite_master WHERE name IN ('books_fts', 'books_search')");
    const kind: SearchIndexKind | null = search.some((r) => r.name === 'books_fts') ? 'fts5' : search.length ? 'plain' : null;
    if (kind) {
      const triggers = await tx.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'book\\_search\\_%' ESCAPE '\\'");
      for (const { name } of triggers) await tx.exec(`DROP TRIGGER ${name};`);
      await tx.exec(`DROP VIEW IF EXISTS book_search_source; DROP TABLE ${kind === 'fts5' ? 'books_fts' : 'books_search'};`);
    }

    await tx.exec(`
CREATE TABLE books_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL CHECK (length(trim(title)) > 0),
  subtitle         TEXT,
  isbn13           TEXT CHECK (isbn13 IS NULL OR length(isbn13) = 13),
  isbn10           TEXT CHECK (isbn10 IS NULL OR length(isbn10) = 10),
  edition          TEXT,
  publisher        TEXT,
  publication_year INTEGER,
  page_count       INTEGER CHECK (page_count IS NULL OR page_count > 0),
  summary          TEXT,
  cover_uri        TEXT,
  language         TEXT,
  format           TEXT CHECK (format IS NULL OR format IN ('hardcover', 'paperback', 'ebook', 'audiobook', 'other')),
  series_id        INTEGER REFERENCES series (id) ON DELETE SET NULL,
  series_position  REAL,
  source           TEXT CHECK (source IS NULL OR source IN ('openlibrary', 'googlebooks', 'manual', 'import')),
  source_id        TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT ${NOW},
  updated_at       TEXT NOT NULL DEFAULT ${NOW},
  rating           INTEGER NULL CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5 AND typeof(rating) = 'integer'))
);
INSERT INTO books_new (id, title, subtitle, isbn13, isbn10, edition, publisher, publication_year, page_count, summary, cover_uri, language,
  format, series_id, series_position, source, source_id, notes, created_at, updated_at, rating)
SELECT id, title, subtitle, isbn13, isbn10, edition, publisher, publication_year, page_count, summary, cover_uri, language,
  format, series_id, series_position, source, source_id, notes, created_at, updated_at, rating FROM books;
DROP TABLE books;
ALTER TABLE books_new RENAME TO books;
CREATE INDEX books_title_idx ON books (title COLLATE NOCASE);
CREATE INDEX books_isbn13_idx ON books (isbn13);
CREATE INDEX books_isbn10_idx ON books (isbn10);
CREATE INDEX books_series_idx ON books (series_id, series_position);
CREATE INDEX books_source_idx ON books (source, source_id);
CREATE INDEX books_rating_idx ON books (rating);

CREATE TABLE loans_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  lent_on     TEXT NOT NULL,
  due_on      TEXT CHECK (due_on IS NULL OR due_on >= lent_on),
  returned_on TEXT CHECK (returned_on IS NULL OR returned_on >= lent_on),
  note        TEXT
);
INSERT INTO loans_new (id, book_id, borrower_id, lent_on, due_on, returned_on, note)
SELECT id, book_id, borrower_id, lent_on, due_on, returned_on, note FROM loans;
DROP TABLE loans;
ALTER TABLE loans_new RENAME TO loans;
CREATE UNIQUE INDEX loans_one_open_per_book ON loans (book_id) WHERE returned_on IS NULL;
CREATE INDEX loans_book_idx ON loans (book_id, lent_on);
CREATE INDEX loans_borrower_idx ON loans (borrower_id);
CREATE INDEX loans_open_due_idx ON loans (due_on) WHERE returned_on IS NULL;
`);

    if (kind) await tx.exec(bookSearchSchema(kind));
  },
};
