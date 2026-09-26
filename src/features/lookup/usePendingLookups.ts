import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useBooky } from '@/components/booky';
import { pendingLookupsRepo, useDatabase, type PendingLookup } from '@/db';
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
}

export interface PendingLookups {
  /** Queued and still being retried. */
  pending: PendingLookup[];
  /** Gave up after five attempts, or no provider knows the ISBN. */
  failed: PendingLookup[];
  /** Arrived; the user confirms each through the candidate UI, then calls `dismissResult`. */
  results: PendingResult[];
  retrying: boolean;
  /** Queues an ISBN after an `OfflineError` (Booky: sleepy). False if it was already queued. */
  queue(isbn13: string): Promise<boolean>;
  /** Retries every due lookup now, one at a time. Also runs on returning to the foreground. */
  retryNow(): Promise<void>;
  dismissResult(isbn13: string): void;
  /** Drops a lookup from the queue (Settings → Pending lookups). */
  remove(isbn13: string): Promise<void>;
}

const plural = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/**
 * The offline lookup queue (P02-10). Retries when the app comes back to the
 * foreground, one ISBN at a time; stops at the first `OfflineError` (still
 * offline, and that does not count as an attempt); counts other failures up
 * to five; tells the user through Booky when details arrive or a lookup is
 * given up.
 */
export function usePendingLookups({ lookup }: UsePendingLookupsOptions = {}): PendingLookups {
  const db = useDatabase();
  const service = useMetadataService();
  const { showTip } = useBooky();
  const [pending, setPending] = useState<PendingLookup[]>([]);
  const [failed, setFailed] = useState<PendingLookup[]>([]);
  const [results, setResults] = useState<PendingResult[]>([]);
  const [retrying, setRetrying] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const doLookup = useCallback(
    (isbn13: string, signal: AbortSignal) => (lookup ? lookup(isbn13, signal) : service.lookupIsbn(isbn13, { signal })),
    [lookup, service],
  );

  const reload = useCallback(async () => {
    const [due, gaveUp] = await Promise.all([pendingLookupsRepo.listDue(db), pendingLookupsRepo.listFailed(db)]);
    setPending(due);
    setFailed(gaveUp);
    return due;
  }, [db]);

  const retryNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setRetrying(true);
    const arrived: PendingResult[] = [];
    const gaveUp: string[] = [];
    try {
      for (const item of await reload()) {
        if (abort.signal.aborted) break;
        try {
          const { candidates } = await doLookup(item.isbn13, abort.signal);
          if (candidates.length) {
            await pendingLookupsRepo.remove(db, item.isbn13);
            arrived.push({ isbn13: item.isbn13, candidates });
          } else {
            await pendingLookupsRepo.markFailed(db, item.isbn13, 'not-found');
            gaveUp.push(item.isbn13);
          }
        } catch (error) {
          if (isAbortError(error)) break;
          if (error instanceof OfflineError) break; // still offline: try again next time
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
    await reload();
    setRetrying(false);
    if (arrived.length) {
      setResults((current) => [...current.filter((r) => !arrived.some((a) => a.isbn13 === r.isbn13)), ...arrived]);
      showTip({ expression: 'excited', message: `Good news — I found details for ${plural(arrived.length)} you added offline.` });
    } else if (gaveUp.length) {
      showTip({
        expression: 'concerned',
        message: `I couldn't find details for ${plural(gaveUp.length)}. You can add ${gaveUp.length === 1 ? 'it' : 'them'} by hand.`,
      });
    }
  }, [db, doLookup, reload, showTip]);

  const queue = useCallback(
    async (isbn13: string) => {
      const added = await pendingLookupsRepo.enqueue(db, isbn13);
      await reload();
      showTip({ expression: 'sleepy', message: "Saved — I'll look this up when you're back online." });
      return added;
    },
    [db, reload, showTip],
  );

  const remove = useCallback(
    async (isbn13: string) => {
      await pendingLookupsRepo.remove(db, isbn13);
      await reload();
    },
    [db, reload],
  );

  const dismissResult = useCallback((isbn13: string) => {
    setResults((current) => current.filter((r) => r.isbn13 !== isbn13));
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([pendingLookupsRepo.listDue(db), pendingLookupsRepo.listFailed(db)])
      .then(([due, gaveUp]) => {
        if (!mounted) return;
        setPending(due);
        setFailed(gaveUp);
        // A cold start is a return to the foreground too, but AppState reports no change for it.
        if (due.length) return retryNow();
      })
      .catch(() => undefined);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retryNow().catch(() => undefined);
    });
    return () => {
      mounted = false;
      subscription.remove();
      controller.current?.abort();
    };
  }, [db, retryNow]);

  return { pending, failed, results, retrying, queue, retryNow, dismissResult, remove };
}
