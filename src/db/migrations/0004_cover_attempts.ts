import type { Migration } from './types';

/**
 * Cover backfill bookkeeping (P02-15): one row per book whose cover search
 * came up empty or failed, so the backfill waits before trying it again.
 * Derived data, like `api_cache`: safe to drop, left out of backups.
 */
export const coverAttempts: Migration = {
  version: 4,
  name: '0004_cover_attempts',
  up: `
CREATE TABLE cover_attempts (
  book_id         INTEGER PRIMARY KEY REFERENCES books (id) ON DELETE CASCADE,
  attempts        INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  last_attempt_at TEXT NOT NULL,
  retry_after     TEXT NOT NULL,
  last_result     TEXT NOT NULL CHECK (last_result IN ('none', 'error')),
  last_error      TEXT
);
CREATE INDEX cover_attempts_retry_after_idx ON cover_attempts (retry_after);
`,
};
