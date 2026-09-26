import { settingsRepo, type Db } from '@/db';
import { getLookupServices } from '@/features/lookup/metadataService';
import { COVER_BATCH_SIZE, coverSourceFromCandidate, findCoverIdsByIsbn, GOOGLE_COVERS_REACHABLE } from '@/services/covers';
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

/** Books worked on at once by the backfill: as many as the covers-by-id queue lets download together (`APP_RATE_RULES`). */
export const BACKFILL_CONCURRENCY = 3;

/**
 * The cover backfill with the app's services; run on start-up and on
 * returning to the foreground (a few books), and by `drainCoverBackfill`
 * after an import or a restore (many).
 */
export async function backfillCoversNow(
  db: Db,
  { signal, limit, onAttached }: { signal?: AbortSignal; limit?: number; onAttached?: (bookId: number) => void } = {},
): Promise<BackfillSummary> {
  if (!(await coversAllowedNow(db))) return NOTHING;
  const { http, metadata } = getLookupServices(db);
  const includeGoogle = await includeGoogleCovers(db);
  return backfillCovers(db, {
    http,
    signal,
    limit,
    includeGoogle,
    concurrency: BACKFILL_CONCURRENCY,
    onAttached,
    findCoverIds: (isbns, s) => findCoverIdsByIsbn(http, isbns, { signal: s }),
    lookupIsbn: (isbn, s) => metadata.lookupIsbn(isbn, { signal: s }),
    search: (query, s) => metadata.search(query, { signal: s }),
  });
}

/**
 * Calls `fn` at most once per `ms`: at once when idle, then once more at the
 * end of the wait if anything asked meanwhile. `flush` runs a pending call now.
 */
export function throttle(fn: () => void, ms: number, clock: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  const fire = () => {
    pending = false;
    fn();
    timer = clock.setTimeout(() => {
      timer = null;
      if (pending) fire();
    }, ms);
  };
  return {
    call() {
      if (timer) pending = true;
      else fire();
    },
    flush() {
      if (timer) clock.clearTimeout(timer);
      timer = null;
      if (pending) {
        pending = false;
        fn();
      }
    },
  };
}

/** Shortest gap between two "covers arrived" reloads while a drain runs. */
export const ATTACHED_THROTTLE_MS = 500;

let draining: Promise<number> | null = null;

/**
 * Keeps running the backfill until no book is due a cover search (or
 * `maxBooks` were looked at, or the network is gone). For after an import
 * or a restore, when many books arrive without covers at once: each round
 * takes one batch search's worth of books (`COVER_BATCH_SIZE`), so a whole
 * Goodreads export costs one search request, then a cover download per
 * book. Only one drain runs at a time; it is never awaited by the screen
 * that started it. `onAttached` hears as covers arrive, so screens can
 * reload and show each one: at once for the first, then at most every
 * `ATTACHED_THROTTLE_MS`, and once more at the end. Resolves with the
 * number of covers attached.
 */
export function drainCoverBackfill(db: Db, { maxBooks = 200, onAttached }: { maxBooks?: number; onAttached?: () => void } = {}): Promise<number> {
  draining ??= (async () => {
    let looked = 0;
    let attached = 0;
    const notify = throttle(() => onAttached?.(), ATTACHED_THROTTLE_MS);
    try {
      while (looked < maxBooks) {
        const summary = await backfillCoversNow(db, { limit: Math.min(COVER_BATCH_SIZE, maxBooks - looked), onAttached: () => notify.call() });
        looked += summary.checked;
        attached += summary.attached;
        if (summary.offline || summary.checked === 0) break;
      }
    } catch (error) {
      console.warn('The cover backfill stopped', error);
    } finally {
      notify.flush();
      draining = null;
    }
    return attached;
  })();
  return draining;
}
