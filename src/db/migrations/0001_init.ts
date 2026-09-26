import type { Migration } from './types';

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

export const init: Migration = {
  version: 1,
  name: '0001_init',
  up: `
CREATE TABLE series (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  total_count INTEGER CHECK (total_count IS NULL OR total_count > 0)
);
CREATE INDEX series_name_idx ON series (name COLLATE NOCASE);

CREATE TABLE books (
  id               INTEGER PRIMARY KEY,
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
  updated_at       TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX books_title_idx ON books (title COLLATE NOCASE);
CREATE INDEX books_isbn13_idx ON books (isbn13);
CREATE INDEX books_isbn10_idx ON books (isbn10);
CREATE INDEX books_series_idx ON books (series_id, series_position);
CREATE INDEX books_source_idx ON books (source, source_id);

CREATE TABLE authors (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL CHECK (length(trim(name)) > 0),
  sort_name TEXT
);
CREATE INDEX authors_name_idx ON authors (name COLLATE NOCASE);
CREATE INDEX authors_sort_name_idx ON authors (sort_name COLLATE NOCASE);

CREATE TABLE book_authors (
  book_id   INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('author', 'illustrator', 'translator', 'editor')),
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, author_id)
);
CREATE INDEX book_authors_author_idx ON book_authors (author_id);

CREATE TABLE genres (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0)
);

CREATE TABLE book_genres (
  book_id     INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  genre_id    INTEGER NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  user_edited INTEGER NOT NULL DEFAULT 0 CHECK (user_edited IN (0, 1)),
  PRIMARY KEY (book_id, genre_id)
);
CREATE INDEX book_genres_genre_idx ON book_genres (genre_id);

CREATE TABLE groups (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
  colour     TEXT,
  icon       TEXT,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE group_books (
  group_id INTEGER NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  book_id  INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, book_id)
);
CREATE INDEX group_books_book_idx ON group_books (book_id);

CREATE TABLE borrowers (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL CHECK (length(trim(name)) > 0),
  contact TEXT
);

-- Deleting a book removes its loan history; a borrower with loans cannot be
-- deleted (history is kept) until those loans are removed.
CREATE TABLE loans (
  id          INTEGER PRIMARY KEY,
  book_id     INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
  borrower_id INTEGER NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  lent_on     TEXT NOT NULL,
  due_on      TEXT CHECK (due_on IS NULL OR due_on >= lent_on),
  returned_on TEXT CHECK (returned_on IS NULL OR returned_on >= lent_on),
  note        TEXT
);
-- A book can only be out with one borrower at a time.
CREATE UNIQUE INDEX loans_one_open_per_book ON loans (book_id) WHERE returned_on IS NULL;
CREATE INDEX loans_book_idx ON loans (book_id, lent_on);
CREATE INDEX loans_borrower_idx ON loans (borrower_id);
CREATE INDEX loans_open_due_idx ON loans (due_on) WHERE returned_on IS NULL;

-- Values are JSON-encoded; typed access and defaults live in the settings repository.
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`,
};
