import type { Db } from '../types';

export interface ApiCacheEntry {
  url: string;
  body: string;
  /** ISO-8601 UTC. */
  fetchedAt: string;
}

export const API_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const API_CACHE_MAX_BYTES = 5 * 1024 * 1024;

export async function getEntry(db: Db, url: string): Promise<ApiCacheEntry | null> {
  const row = await db.get<{ url: string; body: string; fetched_at: string }>(
    'SELECT url, body, fetched_at FROM api_cache WHERE url = ?',
    [url],
  );
  return row ? { url: row.url, body: row.body, fetchedAt: row.fetched_at } : null;
}

/** Stores (or replaces) the response for a URL. */
export async function putEntry(db: Db, url: string, body: string, fetchedAt: string = new Date().toISOString()): Promise<void> {
  await db.run(
    `INSERT INTO api_cache (url, body, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT (url) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
    [url, body, fetchedAt],
  );
}

export async function deleteEntry(db: Db, url: string): Promise<boolean> {
  return (await db.run('DELETE FROM api_cache WHERE url = ?', [url])).changes > 0;
}

/** Empties the cache (Settings → Erase library, P08-09). */
export async function clear(db: Db): Promise<number> {
  return (await db.run('DELETE FROM api_cache')).changes;
}

/** Rows and their total size in bytes (URL + body, UTF-8). */
export async function stats(db: Db): Promise<{ entries: number; bytes: number }> {
  const row = await db.get<{ entries: number; bytes: number | null }>(
    'SELECT COUNT(*) AS entries, SUM(length(CAST(url AS BLOB)) + length(CAST(body AS BLOB))) AS bytes FROM api_cache',
  );
  return { entries: row?.entries ?? 0, bytes: row?.bytes ?? 0 };
}

export interface PruneOptions {
  now?: Date;
  maxAgeMs?: number;
  maxBytes?: number;
}

/**
 * Run on start-up: deletes entries older than `maxAgeMs` (30 days), then the
 * oldest entries until the rest fit in `maxBytes` (5 MB).
 */
export async function prune(
  db: Db,
  { now = new Date(), maxAgeMs = API_CACHE_MAX_AGE_MS, maxBytes = API_CACHE_MAX_BYTES }: PruneOptions = {},
): Promise<{ expired: number; evicted: number }> {
  return db.transaction(async (tx) => {
    const cutoff = new Date(now.getTime() - maxAgeMs).toISOString();
    const expired = (await tx.run('DELETE FROM api_cache WHERE fetched_at < ?', [cutoff])).changes;
    // Keep the newest rows whose running total fits; delete the rest.
    const evicted = (
      await tx.run(
        `DELETE FROM api_cache WHERE url IN (
           SELECT url FROM (
             SELECT url, SUM(length(CAST(url AS BLOB)) + length(CAST(body AS BLOB)))
               OVER (ORDER BY fetched_at DESC, url) AS running
             FROM api_cache
           ) WHERE running > ?
         )`,
        [maxBytes],
      )
    ).changes;
    return { expired, evicted };
  });
}

/** The store the HTTP response cache reads and writes (`createResponseCache` in `src/services/http/cache.ts`). */
export function store(db: Db) {
  return {
    get: (url: string) => getEntry(db, url),
    put: (url: string, body: string, fetchedAt: string) => putEntry(db, url, body, fetchedAt),
  };
}
