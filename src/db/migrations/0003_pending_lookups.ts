import type { Migration } from './types';

/**
 * ISBNs scanned or typed while offline, retried when the app returns to the
 * foreground (P02-10, PLAN §6 "Offline behaviour"). One row per ISBN.
 */
export const pendingLookups: Migration = {
  version: 3,
  name: '0003_pending_lookups',
  up: `
CREATE TABLE pending_lookups (
  isbn13       TEXT PRIMARY KEY CHECK (length(isbn13) = 13),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error   TEXT
);
`,
};
