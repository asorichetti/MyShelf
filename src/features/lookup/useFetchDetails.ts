import { useCallback, useEffect, useRef, useState } from 'react';

import { booksRepo, useDatabase, type Db } from '@/db';
import { missingDetailChanges, type RefreshField } from '@/domain';
import { emit } from '@/features/events';
import { useMounted } from '@/hooks/useMounted';
import { isAbortError, OfflineError } from '@/services/http';
import type { MetadataService } from '@/services/metadata';

import { useMetadataService } from './metadataService';
import { applyProposal, proposeForBook, type BookProposal } from './useRefresh';

/** Books looked up at once. The shared rate limiter still paces every request per host (PLAN §6). */
export const FETCH_DETAILS_CONCURRENCY = 2;

export interface DetailsCounts {
  /** Books with something to add. */
  found: number;
  /** Books the catalogues know but with nothing to add. */
  upToDate: number;
  /** Books no catalogue knows. */
  notFound: number;
  /** Lookups that failed (a catalogue error), or books not reached before going offline. */
  failed: number;
}

export type FetchDetailsState =
  | { status: 'checking'; done: number; total: number }
  | { status: 'review'; proposals: BookProposal[]; counts: DetailsCounts; offline: boolean }
  | { status: 'saved'; books: number; details: number };

export interface FetchDetails {
  state: FetchDetailsState;
  ticked: ReadonlyMap<number, ReadonlySet<RefreshField>>;
  toggle: (bookId: number, field: RefreshField) => void;
  /** Stops checking and reviews what was found so far. */
  stop: () => void;
  applying: boolean;
  /** Saves every ticked change; resolves with the number of books updated. */
  apply: () => Promise<number>;
}

interface CheckOptions {
  service: MetadataService;
  signal: AbortSignal;
  concurrency?: number;
  onProgress: (done: number) => void;
}

/**
 * Looks each book up and keeps what it could add (P08-05): by ISBN, or by
 * title and first author (a match only when both agree). Up to `concurrency`
 * books at a time through the shared rate limiter; going offline stops the
 * run and counts the books not reached as failed.
 */
export async function checkBooks(db: Db, bookIds: readonly number[], { service, signal, concurrency = FETCH_DETAILS_CONCURRENCY, onProgress }: CheckOptions) {
  const proposals = new Map<number, BookProposal>();
  const counts: DetailsCounts = { found: 0, upToDate: 0, notFound: 0, failed: 0 };
  let offline = false;
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (!offline && !signal.aborted && next < bookIds.length) {
      const id = bookIds[next++]!;
      try {
        const book = await booksRepo.getBookDetail(db, id);
        if (!book) continue;
        const proposal = await proposeForBook(db, book, service, signal);
        if (!proposal) counts.notFound++;
        else {
          const changes = missingDetailChanges(proposal.changes);
          if (changes.length) {
            proposals.set(id, { ...proposal, changes });
            counts.found++;
          } else counts.upToDate++;
        }
      } catch (error) {
        if (signal.aborted || isAbortError(error)) return;
        if (error instanceof OfflineError) {
          offline = true;
          counts.failed++;
          return;
        }
        console.warn(`Could not look up book ${id} for missing details`, error);
        counts.failed++;
      } finally {
        if (!signal.aborted) onProgress(++done);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  // Books never reached (offline, or stopped) count as not checked.
  counts.failed += bookIds.length - done;
  // In the order the books were imported.
  return { proposals: bookIds.map((id) => proposals.get(id)).filter((p): p is BookProposal => p != null), counts, offline };
}

/**
 * "Fetch missing details" for books just imported from a spreadsheet
 * (P08-05). Unlike the offline lookup queue, it enriches the books already
 * on the shelf: each is looked up, and only the details it lacks are offered
 * (summary, genres, series, cover, pages, publisher), field by field as
 * "Refresh details" shows them (P02-12). Nothing the file held, no rating
 * and no note is ever replaced.
 */
export function useFetchDetails(bookIds: readonly number[], { service: injected }: { service?: MetadataService } = {}): FetchDetails {
  const db = useDatabase();
  const appService = useMetadataService();
  const service = injected ?? appService;
  const mounted = useMounted();
  const [state, setState] = useState<FetchDetailsState>({ status: 'checking', done: 0, total: bookIds.length });
  const [ticked, setTicked] = useState<ReadonlyMap<number, ReadonlySet<RefreshField>>>(new Map());
  const [applying, setApplying] = useState(false);
  const stopper = useRef<AbortController | null>(null);
  const key = bookIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',').map(Number) : [];
    // Stop (or leaving the screen) aborts the lookups; only leaving drops the answer.
    const lookups = new AbortController();
    let left = false;
    stopper.current = lookups;
    checkBooks(db, ids, { service, signal: lookups.signal, onProgress: (done) => !left && setState({ status: 'checking', done, total: ids.length }) })
      .then(({ proposals, counts, offline }) => {
        if (left) return;
        setTicked(new Map(proposals.map((p) => [p.book.id, new Set(p.changes.map((c) => c.field))])));
        setState({ status: 'review', proposals, counts, offline });
      })
      .catch((error) => {
        console.error('Could not fetch missing details', error);
        if (!left) setState({ status: 'review', proposals: [], counts: { found: 0, upToDate: 0, notFound: 0, failed: ids.length }, offline: false });
      });
    return () => {
      left = true;
      lookups.abort();
    };
  }, [db, key, service]);

  const stop = useCallback(() => stopper.current?.abort(), []);

  const toggle = useCallback((bookId: number, field: RefreshField) => {
    setTicked((current) => {
      const next = new Map(current);
      const fields = new Set(next.get(bookId) ?? []);
      if (fields.has(field)) fields.delete(field);
      else fields.add(field);
      next.set(bookId, fields);
      return next;
    });
  }, []);

  const apply = useCallback(async () => {
    if (state.status !== 'review') return 0;
    setApplying(true);
    let books = 0;
    let details = 0;
    try {
      for (const proposal of state.proposals) {
        const fields = ticked.get(proposal.book.id);
        if (!fields?.size) continue;
        const saved = await applyProposal(db, proposal, fields, { onlyMissing: true });
        if (!saved) continue;
        books++;
        details += saved;
      }
    } finally {
      if (books) emit('library-changed');
      if (mounted.current) {
        setApplying(false);
        setState({ status: 'saved', books, details });
      }
    }
    return books;
  }, [db, mounted, state, ticked]);

  return { state, ticked, toggle, stop, applying, apply };
}
