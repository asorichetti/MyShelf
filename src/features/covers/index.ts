import { settingsRepo, type Db } from '@/db';
import { getLookupServices } from '@/features/lookup/metadataService';
import { coverSourceFromCandidate, GOOGLE_COVERS_REACHABLE } from '@/services/covers';
import { isOnMobileData } from '@/services/covers/mobileData';
import type { BookCandidate } from '@/services/metadata';


import { attachBestCover, type AttachCoverResult } from './attachCover';
import { backfillCovers, type BackfillSummary } from './backfillCovers';

export { attachBestCover, type AttachCoverOptions, type AttachCoverResult } from './attachCover';
export { backfillCovers, type BackfillCoversOptions, type BackfillSummary } from './backfillCovers';

/** Google Books covers, when the user allows Google Books and the platform can read its images. */
export async function includeGoogleCovers(db: Db): Promise<boolean> {
  return GOOGLE_COVERS_REACHABLE && (await settingsRepo.getSetting(db, 'googleBooksEnabled'));
}

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
  const includeGoogle = await includeGoogleCovers(db);
  return attachBestCover(db, bookId, coverSourceFromCandidate(candidate), { http, signal, includeGoogle, replace });
}

const NOTHING: BackfillSummary = { checked: 0, attached: 0, none: 0, failed: 0, offline: false };

/**
 * Whether the backfill may download covers now: always on Wi-Fi, and on
 * mobile data only while "Fetch covers on mobile data" is on (P08-07).
 */
export async function coversAllowedNow(db: Db, onMobileData: () => Promise<boolean> = isOnMobileData): Promise<boolean> {
  if (await settingsRepo.getSetting(db, 'coversOnMobileData')) return true;
  return !(await onMobileData());
}

/** The cover backfill with the app's services; run on start-up and on returning to the foreground. */
export async function backfillCoversNow(db: Db, { signal, limit }: { signal?: AbortSignal; limit?: number } = {}): Promise<BackfillSummary> {
  if (!(await coversAllowedNow(db))) return NOTHING;
  const { http, metadata } = getLookupServices(db);
  const includeGoogle = await includeGoogleCovers(db);
  return backfillCovers(db, {
    http,
    signal,
    limit,
    includeGoogle,
    lookupIsbn: (isbn, s) => metadata.lookupIsbn(isbn, { signal: s }),
    search: (query, s) => metadata.search(query, { signal: s }),
  });
}

let draining: Promise<number> | null = null;

/**
 * Keeps running the backfill, a few books at a time through the shared rate
 * limiter, until no book is due a cover search (or `maxBooks` were looked
 * at, or the network is gone). For after an import or a restore, when many
 * books arrive without covers at once. Only one drain runs at a time; it is
 * never awaited by the screen that started it. `onBatch` hears about every
 * batch that attached covers, so screens can reload. Resolves with the
 * number of covers attached.
 */
export function drainCoverBackfill(db: Db, { maxBooks = 200, onAttached }: { maxBooks?: number; onAttached?: () => void } = {}): Promise<number> {
  draining ??= (async () => {
    let looked = 0;
    let attached = 0;
    try {
      while (looked < maxBooks) {
        const summary = await backfillCoversNow(db, { limit: 5 });
        looked += summary.checked;
        attached += summary.attached;
        if (summary.attached) onAttached?.();
        if (summary.offline || summary.checked === 0) break;
      }
    } catch (error) {
      console.warn('The cover backfill stopped', error);
    } finally {
      draining = null;
    }
    return attached;
  })();
  return draining;
}
