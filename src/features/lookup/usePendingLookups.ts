import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { bookCount, useBooky } from '@/components/booky';
import { pendingLookupsRepo, useDatabase, type PendingLookup } from '@/db';
import { backfillCoversNow } from '@/features/covers';
import { useLibraryEvent } from '@/features/events';
import { t } from '@/i18n';
import { isAbortError, OfflineError } from '@/services/http';
import { InvalidIsbnError, type BookCandidate, type MetadataResult } from '@/services/metadata';

import { useMetadataService } from './metadataService';

export type { PendingLookup };

/** Details that arrived for a queued ISBN, waiting for the user to confirm a candidate. */
export interface PendingResult {
  isbn13: string;
  candidates: BookCandidate[];
}

export interface UsePendingLookupsOptions {
  /** Defaults to the app's metadata service. */
  lookup?: (isbn13: string, signal: AbortSignal) => Promise<MetadataResult>;
  /**
   * Runs after the queue is retried while online, to fill in missing covers
   * (P02-15). Defaults to `backfillCoversNow`; pass null to turn it off.
   */
  backfillCovers?: ((signal: AbortSignal) => Promise<unknown>) | null;
}

export interface PendingLookups {
  /** Queued and still being retried (not counting those whose details arrived). */
  pending: PendingLookup[];
  /** Gave up after five attempts, or no provider knows the ISBN. */
  failed: PendingLookup[];
  /**
   * Arrived; the user confirms each through the candidate UI (the edition
   * picker). They stay queued until the book is saved (`saveCandidate`
   * removes the ISBN) or dismissed, so a restart before then finds them again.
   */
  results: PendingResult[];
  retrying: boolean;
  /** Queues an ISBN after an `OfflineError` (Booky: sleepy). False if it was already queued. */
  queue(isbn13: string): Promise<boolean>;
  /** Retries every due lookup now, one at a time. Also runs on returning to the foreground. */
  retryNow(): Promise<void>;
  /** Forgets arrived details without saving the book, and drops the ISBN from the queue. */
  dismissResult(isbn13: string): void;
  /** Drops a lookup from the queue (Settings → Pending lookups). */
  remove(isbn13: string): Promise<void>;
}


/**
 * The offline lookup queue (P02-10). Retries when the app comes back to the
 * foreground, one ISBN at a time; stops at the first `OfflineError` (still
 * offline, and that does not count as an attempt); counts other failures up
 * to five; tells the user through Booky when details arrive or a lookup is
 * given up.
 */
export function usePendingLookups({ lookup, backfillCovers }: UsePendingLookupsOptions = {}): PendingLookups {
  const db = useDatabase();
  const service = useMetadataService();
  const { emit } = useBooky();
  const [pending, setPending] = useState<PendingLookup[]>([]);
  const [failed, setFailed] = useState<PendingLookup[]>([]);
  const [results, setResults] = useState<PendingResult[]>([]);
  const [retrying, setRetrying] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const backfillController = useRef<AbortController | null>(null);

  const backfill = useMemo(
    () => (backfillCovers === undefined ? (signal: AbortSignal) => backfillCoversNow(db, { signal }) : backfillCovers),
    [backfillCovers, db],
  );

  /** Starts the cover backfill in the background; one run at a time, cancelled on unmount. */
  const startBackfill = useCallback(() => {
    if (!backfill || backfillController.current) return;
    const abort = new AbortController();
    backfillController.current = abort;
    backfill(abort.signal)
      .catch(() => undefined) // the backfill records its own failures; nothing to tell the user
      .finally(() => {
        if (backfillController.current === abort) backfillController.current = null;
      });
  }, [backfill]);

  const doLookup = useCallback(
    (isbn13: string, signal: AbortSignal) => (lookup ? lookup(isbn13, signal) : service.lookupIsbn(isbn13, { signal })),
    [lookup, service],
  );

  /** `results` as of now (state lags a render), and their ISBNs, for `pending` and the retry. */
  const resultsNow = useRef<PendingResult[]>([]);
  const arrivedIsbns = useRef(new Set<string>());

  const showResults = useCallback((update: (current: PendingResult[]) => PendingResult[]) => {
    const next = update(resultsNow.current);
    resultsNow.current = next;
    arrivedIsbns.current = new Set(next.map((r) => r.isbn13));
    setResults(next);
  }, []);

  const reload = useCallback(async () => {
    const [due, gaveUp] = await Promise.all([pendingLookupsRepo.listDue(db), pendingLookupsRepo.listFailed(db)]);
    const queued = new Set(due.map((p) => p.isbn13));
    // Details for an ISBN no longer queued (saved, or removed in Settings) are done with.
    if ([...arrivedIsbns.current].some((isbn) => !queued.has(isbn))) showResults((current) => current.filter((r) => queued.has(r.isbn13)));
    setPending(due.filter((p) => !arrivedIsbns.current.has(p.isbn13)));
    setFailed(gaveUp);
    return due;
  }, [db, showResults]);

  const retryNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setRetrying(true);
    const arrived: PendingResult[] = [];
    const gaveUp: string[] = [];
    let offline = false;
    try {
      for (const item of await reload()) {
        if (abort.signal.aborted) break;
        // Already arrived and waiting for the user.
        if (arrivedIsbns.current.has(item.isbn13)) continue;
        try {
          const { candidates } = await doLookup(item.isbn13, abort.signal);
          if (candidates.length) {
            // Stays queued until the user saves the book: nothing scanned is lost if the app closes first.
            arrived.push({ isbn13: item.isbn13, candidates });
          } else {
            await pendingLookupsRepo.markFailed(db, item.isbn13, 'not-found');
            gaveUp.push(item.isbn13);
          }
        } catch (error) {
          if (isAbortError(error)) break;
          if (error instanceof OfflineError) {
            offline = true; // still offline: try again next time
            break;
          }
          if (error instanceof InvalidIsbnError) {
            await pendingLookupsRepo.markFailed(db, item.isbn13, 'invalid-isbn');
            gaveUp.push(item.isbn13);
            continue;
          }
          const row = await pendingLookupsRepo.recordFailure(db, item.isbn13, error instanceof Error ? error.message : String(error));
          if (row && row.attempts >= pendingLookupsRepo.MAX_LOOKUP_ATTEMPTS) gaveUp.push(item.isbn13);
        }
      }
    } finally {
      running.current = false;
      controller.current = null;
    }
    if (abort.signal.aborted) return;
    if (arrived.length) showResults((current) => [...current.filter((r) => !arrived.some((a) => a.isbn13 === r.isbn13)), ...arrived]);
    await reload();
    setRetrying(false);
    if (!offline) startBackfill();
    if (arrived.length) {
      void emit({ type: 'lookup-arrived', vars: { books: bookCount(arrived.length) } });
    } else if (gaveUp.length) {
      void emit({ type: 'lookup-none', variant: 'offline', vars: { books: bookCount(gaveUp.length), them: t('lookup.pending.them', { count: gaveUp.length }) } });
    }
  }, [db, doLookup, reload, emit, startBackfill, showResults]);

  const queue = useCallback(
    async (isbn13: string) => {
      const added = await pendingLookupsRepo.enqueue(db, isbn13);
      await reload();
      void emit({ type: 'offline-queued' });
      return added;
    },
    [db, reload, emit],
  );

  const remove = useCallback(
    async (isbn13: string) => {
      await pendingLookupsRepo.remove(db, isbn13);
      await reload();
    },
    [db, reload],
  );

  // Settings → Pending lookups edits the queue from outside the tab shell.
  useLibraryEvent('pending-changed', () => {
    reload().catch(() => undefined);
  });
  useLibraryEvent('pending-retry', () => {
    retryNow().catch(() => undefined);
  });

  const dismissResult = useCallback(
    (isbn13: string) => {
      showResults((current) => current.filter((r) => r.isbn13 !== isbn13));
      pendingLookupsRepo
        .remove(db, isbn13)
        .then(() => reload())
        .catch(() => undefined);
    },
    [db, reload, showResults],
  );

  useEffect(() => {
    let mounted = true;
    Promise.all([pendingLookupsRepo.listDue(db), pendingLookupsRepo.listFailed(db)])
      .then(([due, gaveUp]) => {
        if (!mounted) return;
        setPending(due);
        setFailed(gaveUp);
        // A cold start is a return to the foreground too, but AppState reports no change for it.
        if (due.length) return retryNow();
        startBackfill();
      })
      .catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryNow().catch(() => undefined);
    });
    return () => {
      mounted = false;
      subscription.remove();
      controller.current?.abort();
      backfillController.current?.abort();
    };
  }, [db, retryNow, startBackfill]);

  return { pending, failed, results, retrying, queue, retryNow, dismissResult, remove };
}
