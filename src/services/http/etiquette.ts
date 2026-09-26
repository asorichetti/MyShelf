import type { RateRule } from './rateLimiter';

/** Queue for Open Library covers by cover id (`/b/id/…`). */
export const OL_COVERS_BY_ID = 'covers.openlibrary.org/b/id';
/** Queue for Open Library covers by ISBN (`/b/isbn/…`). */
export const OL_COVERS_BY_ISBN = 'covers.openlibrary.org/b/isbn';

/**
 * The rate-limit queue a request joins: its host, except for Open Library
 * covers, whose documented limits depend on how the cover is asked for
 * (https://openlibrary.org/dev/docs/api/covers, checked September 2026).
 */
export function rateKeyOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)(\/[^?#]*)?/i.exec(url);
  if (!match) return url;
  const host = match[1].toLowerCase();
  const path = match[2] ?? '';
  if (host === 'covers.openlibrary.org') {
    if (path.startsWith('/b/id/')) return OL_COVERS_BY_ID;
    if (path.startsWith('/b/isbn/')) return OL_COVERS_BY_ISBN;
  }
  return host;
}

/**
 * PLAN §6 etiquette for the app's shared limiter. Every other host keeps
 * 1 request per second, 2 in flight overall.
 *
 * - Covers by cover id are not rate-limited by Open Library, and are what the
 *   covers API is for ("displaying covers"); still, at most 3 in flight and
 *   3 per second, the rate Open Library's API guidance allows an identified
 *   client (https://openlibrary.org/developers/api).
 * - Covers by ISBN are limited to 100 requests per IP every 5 minutes (403
 *   beyond that): one every 3 seconds stays inside it however long a run lasts.
 */
export const APP_RATE_RULES: Readonly<Record<string, RateRule>> = {
  [OL_COVERS_BY_ID]: { minIntervalMs: 334, maxConcurrent: 3 },
  [OL_COVERS_BY_ISBN]: { minIntervalMs: 3000 },
};
