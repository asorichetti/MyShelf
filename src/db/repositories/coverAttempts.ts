import { nextCoverRetryAt, type BookSource, type CoverAttemptResult } from '@/domain';

import type { Db } from '../types';

/** A book's unsuccessful cover searches (table `cover_attempts`, P02-15). */
export interface CoverAttempt {
  bookId: number;
  attempts: number;
  /** ISO-8601 UTC. */
  lastAttemptAt: string;
  /** ISO-8601 UTC; the backfill leaves the book alone until then. */
  retryAfter: string;
  lastResult: CoverAttemptResult;
  lastError: string | null;
}

/** What the cover backfill needs to know about a book without a cover. */
export interface BookNeedingCover {
  id: number;
  title: string;
  isbn13: string | null;
  isbn10: string | null;
  source: BookSource | null;
  sourceId: string | null;
  /** First credited author (role `author`), for a title + author search. */
  firstAuthor: string | null;
  /** Unsuccessful searches so far (0 = never searched). */
  attempts: number;
}

interface AttemptRow {
  book_id: number;
  attempts: number;
  last_attempt_at: string;
  retry_after: string;
  last_result: CoverAttemptResult;
  last_error: string | null;
}

const toAttempt = (r: AttemptRow): CoverAttempt => ({
  bookId: r.book_id,
  attempts: r.attempts,
  lastAttemptAt: r.last_attempt_at,
  retryAfter: r.retry_after,
  lastResult: r.last_result,
  lastError: r.last_error,
});

export async function get(db: Db, bookId: number): Promise<CoverAttempt | null> {
  const row = await db.get<AttemptRow>('SELECT * FROM cover_attempts WHERE book_id = ?', [bookId]);
  return row ? toAttempt(row) : null;
}

/**
 * Books with no cover that are due a search: never searched, or past their
 * `retry_after`. Never-searched books come first (newest first: most likely
 * what the user just added), then the longest-waiting.
 */
export async function listBooksNeedingCover(db: Db, { now, limit }: { now: string; limit: number }): Promise<BookNeedingCover[]> {
  return db.all<BookNeedingCover>(
    `SELECT b.id, b.title, b.isbn13, b.isbn10, b.source, b.source_id AS sourceId,
       (SELECT a.name FROM book_authors ba JOIN authors a ON a.id = ba.author_id
         WHERE ba.book_id = b.id AND ba.role = 'author' ORDER BY ba.position, a.id LIMIT 1) AS firstAuthor,
       COALESCE(ca.attempts, 0) AS attempts
     FROM books b
     LEFT JOIN cover_attempts ca ON ca.book_id = b.id
     WHERE (b.cover_uri IS NULL OR trim(b.cover_uri) = '')
       AND (ca.book_id IS NULL OR ca.retry_after <= ?)
     ORDER BY ca.book_id IS NOT NULL, ca.retry_after, b.created_at DESC, b.id DESC
     LIMIT ?`,
    [now, limit],
  );
}

/** Counts an unsuccessful search and sets when to try again (`COVER_RETRY_DELAYS`). */
export async function recordAttempt(
  db: Db,
  bookId: number,
  result: CoverAttemptResult,
  { now = Date.now(), error = null }: { now?: number; error?: string | null } = {},
): Promise<CoverAttempt> {
  const attempts = ((await get(db, bookId))?.attempts ?? 0) + 1;
  await db.run(
    `INSERT INTO cover_attempts (book_id, attempts, last_attempt_at, retry_after, last_result, last_error)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (book_id) DO UPDATE SET
       attempts = excluded.attempts, last_attempt_at = excluded.last_attempt_at,
       retry_after = excluded.retry_after, last_result = excluded.last_result, last_error = excluded.last_error`,
    [bookId, attempts, new Date(now).toISOString(), nextCoverRetryAt(attempts, result, now), result, error],
  );
  return (await get(db, bookId))!;
}

/** Forgets a book's attempts: it has a cover now, or the user asked to search again. */
export async function clear(db: Db, bookId: number): Promise<boolean> {
  return (await db.run('DELETE FROM cover_attempts WHERE book_id = ?', [bookId])).changes > 0;
}
