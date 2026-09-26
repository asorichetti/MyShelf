import { NOW_SQL } from './shared';

import type { Db } from '../types';

/** A queued ISBN waiting for the network. */
export interface PendingLookup {
  isbn13: string;
  /** ISO-8601 UTC. */
  requestedAt: string;
  attempts: number;
  lastError: string | null;
}

/** After this many failed attempts a lookup is given up (shown as failed, kept until removed). */
export const MAX_LOOKUP_ATTEMPTS = 5;

interface Row {
  isbn13: string;
  requested_at: string;
  attempts: number;
  last_error: string | null;
}

const COLUMNS = 'isbn13, requested_at, attempts, last_error';
const toPending = (r: Row): PendingLookup => ({
  isbn13: r.isbn13,
  requestedAt: r.requested_at,
  attempts: r.attempts,
  lastError: r.last_error,
});

/** Queues an ISBN-13. Returns false when it is already queued (it is never queued twice). */
export async function enqueue(db: Db, isbn13: string): Promise<boolean> {
  const { changes } = await db.run(
    `INSERT INTO pending_lookups (isbn13, requested_at) VALUES (?, ${NOW_SQL}) ON CONFLICT (isbn13) DO NOTHING`,
    [isbn13],
  );
  return changes > 0;
}

export async function get(db: Db, isbn13: string): Promise<PendingLookup | null> {
  const row = await db.get<Row>(`SELECT ${COLUMNS} FROM pending_lookups WHERE isbn13 = ?`, [isbn13]);
  return row ? toPending(row) : null;
}

/** Every queued lookup, oldest first (Settings → Pending lookups, P08-10). */
export async function list(db: Db): Promise<PendingLookup[]> {
  return (await db.all<Row>(`SELECT ${COLUMNS} FROM pending_lookups ORDER BY requested_at, isbn13`)).map(toPending);
}

/** Lookups still worth retrying, oldest first. */
export async function listDue(db: Db): Promise<PendingLookup[]> {
  const rows = await db.all<Row>(
    `SELECT ${COLUMNS} FROM pending_lookups WHERE attempts < ? ORDER BY requested_at, isbn13`,
    [MAX_LOOKUP_ATTEMPTS],
  );
  return rows.map(toPending);
}

/** Lookups that used up their attempts. */
export async function listFailed(db: Db): Promise<PendingLookup[]> {
  const rows = await db.all<Row>(
    `SELECT ${COLUMNS} FROM pending_lookups WHERE attempts >= ? ORDER BY requested_at, isbn13`,
    [MAX_LOOKUP_ATTEMPTS],
  );
  return rows.map(toPending);
}

/** Counts one failed attempt (capped at MAX_LOOKUP_ATTEMPTS). Returns the updated row. */
export async function recordFailure(db: Db, isbn13: string, error: string): Promise<PendingLookup | null> {
  await db.run('UPDATE pending_lookups SET attempts = MIN(attempts + 1, ?), last_error = ? WHERE isbn13 = ?', [
    MAX_LOOKUP_ATTEMPTS,
    error,
    isbn13,
  ]);
  return get(db, isbn13);
}

/** Gives up at once, e.g. when no provider knows the ISBN: retrying cannot help. */
export async function markFailed(db: Db, isbn13: string, error: string): Promise<void> {
  await db.run('UPDATE pending_lookups SET attempts = ?, last_error = ? WHERE isbn13 = ?', [MAX_LOOKUP_ATTEMPTS, error, isbn13]);
}

/** Puts a failed lookup back in the queue with fresh attempts ("Retry" in Settings). */
export async function resetAttempts(db: Db, isbn13: string): Promise<boolean> {
  return (await db.run('UPDATE pending_lookups SET attempts = 0, last_error = NULL WHERE isbn13 = ?', [isbn13])).changes > 0;
}

export async function remove(db: Db, isbn13: string): Promise<boolean> {
  return (await db.run('DELETE FROM pending_lookups WHERE isbn13 = ?', [isbn13])).changes > 0;
}

/** Queued lookups still being retried (for "2 books waiting for details"). */
export async function countDue(db: Db): Promise<number> {
  const row = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM pending_lookups WHERE attempts < ?', [MAX_LOOKUP_ATTEMPTS]);
  return row?.n ?? 0;
}
