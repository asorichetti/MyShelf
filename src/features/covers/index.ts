import { settingsRepo, type Db } from '@/db';
import { getLookupServices } from '@/features/lookup/metadataService';
import { coverSourceFromCandidate } from '@/services/covers';
import type { BookCandidate } from '@/services/metadata';


import { attachBestCover, type AttachCoverResult } from './attachCover';
import { backfillCovers, type BackfillSummary } from './backfillCovers';

export { attachBestCover, type AttachCoverOptions, type AttachCoverResult } from './attachCover';
export { backfillCovers, type BackfillCoversOptions, type BackfillSummary } from './backfillCovers';

/**
 * After saving a book from a lookup candidate (P02-11, P03-09): find its
 * best real cover and store it, with the app's HTTP client and the Google
 * Books setting. Safe to call without awaiting the save's UI; never throws
 * for network trouble.
 */
export async function attachCoverFromCandidate(
  db: Db,
  bookId: number,
  candidate: BookCandidate,
  { signal, replace }: { signal?: AbortSignal; replace?: boolean } = {},
): Promise<AttachCoverResult> {
  const { http } = getLookupServices(db);
  const includeGoogle = await settingsRepo.getSetting(db, 'googleBooksEnabled');
  return attachBestCover(db, bookId, coverSourceFromCandidate(candidate), { http, signal, includeGoogle, replace });
}

/** The cover backfill with the app's services; run on start-up and on returning to the foreground. */
export async function backfillCoversNow(db: Db, { signal, limit }: { signal?: AbortSignal; limit?: number } = {}): Promise<BackfillSummary> {
  const { http, metadata } = getLookupServices(db);
  const includeGoogle = await settingsRepo.getSetting(db, 'googleBooksEnabled');
  return backfillCovers(db, {
    http,
    signal,
    limit,
    includeGoogle,
    lookupIsbn: (isbn, s) => metadata.lookupIsbn(isbn, { signal: s }),
    search: (query, s) => metadata.search(query, { signal: s }),
  });
}
