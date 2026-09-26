import type { Migration } from './types';

/**
 * The automatic safety copy taken just before a backup is restored over the
 * library (P08-03): the whole library as a backup document, so "Undo
 * restore" can put it back. Only the latest is kept. Like `api_cache`, it is
 * never itself part of a backup, and "Erase library" deletes it.
 */
export const backupSnapshots: Migration = {
  version: 5,
  name: '0005_backup_snapshots',
  up: `
CREATE TABLE backup_snapshots (
  id         INTEGER PRIMARY KEY,
  reason     TEXT NOT NULL CHECK (reason IN ('before-restore')),
  created_at TEXT NOT NULL,
  book_count INTEGER NOT NULL CHECK (book_count >= 0),
  body       TEXT NOT NULL
);
`,
};
