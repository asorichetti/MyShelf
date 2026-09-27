import { coverAttemptsRepo, type BookNeedingCover, type Db } from '@/db';
import { bookMatchKey } from '@/domain';
import { combineCoverSources, coverSourceFromBook, coverSourceFromCandidate, searchIsbn13, type CoverSource } from '@/services/covers';
import { isAbortError, OfflineError } from '@/services/http';
import type { MetadataResult, SearchQuery } from '@/services/metadata';

import { attachBestCover, type AttachCoverOptions } from './attachCover';

export interface BackfillCoversOptions extends Omit<AttachCoverOptions, 'replace' | 'moreSource'> {
  /** ISBN lookup for cover ids (the metadata service's `lookupIsbn`); cached responses cost nothing. */
  lookupIsbn?: (isbn13: string, signal?: AbortSignal) => Promise<MetadataResult>;
  /** Title + author search for books without an ISBN (the metadata service's `search`). */
  search?: (query: SearchQuery, signal?: AbortSignal) => Promise<MetadataResult>;
  /**
   * Cover ids for many ISBN-13s in one request (`findCoverIdsByIsbn`). Books
   * it finds skip the per-book lookup; the rest (and any whose ids lead to no
   * usable image) take it as before.
   */
  findCoverIds?: (isbns13: string[], signal?: AbortSignal) => Promise<Map<string, CoverSource>>;
  /** Books looked at per run. Default 5: a gentle trickle, never a crawl. */
  limit?: number;
  /**
   * Books worked on at once. Default 1. The HTTP client's limiter still sets
   * the pace per host; this only lets one book's cover download while the
   * next one's lookup waits its turn.
   */
  concurrency?: number;
  /** Called as soon as each cover is stored, so screens can show it at once. */
  onAttached?: (bookId: number) => void;
  /** E2E builds: never look at books that came with a fixture (`settleFixtureCovers`). */
  skipFixtureBooks?: boolean;
}

export interface BackfillSummary {
  checked: number;
  attached: number;
  none: number;
  failed: number;
  /** The run stopped because the network was unreachable. */
  offline: boolean;
}

/** Surname match on the first author and the same title key: the search found this book, not a namesake. */
function sameBook(book: BookNeedingCover, candidate: { title: string; authors: string[] }): boolean {
  if (!book.firstAuthor || !candidate.authors.length) return false;
  return bookMatchKey(book.title, book.firstAuthor) === bookMatchKey(candidate.title, candidate.authors[0]);
}

async function sourceFor(book: BookNeedingCover, options: BackfillCoversOptions): Promise<CoverSource> {
  const base = coverSourceFromBook(book);
  const isbn = book.isbn13 ?? book.isbn10;
  try {
    if (isbn && options.lookupIsbn) {
      const [candidate] = (await options.lookupIsbn(isbn, options.signal)).candidates;
      return candidate ? combineCoverSources(base, coverSourceFromCandidate(candidate)) : base;
    }
    if (!isbn && options.search && book.firstAuthor) {
      const { candidates } = await options.search({ title: book.title, author: book.firstAuthor }, options.signal);
      const match = candidates.find((c) => sameBook(book, c));
      return match ? combineCoverSources(base, coverSourceFromCandidate(match)) : base;
    }
  } catch (error) {
    // Offline and cancelled stop the run; any other lookup failure still leaves the ISBN cover URLs to try.
    if (isAbortError(error) || error instanceof OfflineError) throw error;
  }
  return base;
}

/** Books some run is working on now, per database, so overlapping runs never fetch the same cover twice. */
const inFlight = new WeakMap<Db, Set<number>>();

/**
 * Fills in real covers for books that have none: typed in by hand, saved
 * when no cover could be found (P02-15), imported (P08-05) or restored
 * (P08-03). Looks at a few due books per run
 * (`coverAttemptsRepo.listBooksNeedingCover`, newest first). With
 * `findCoverIds`, one batch search finds cover ids for every book with an
 * ISBN, and those books go first; the others are enriched one by one with
 * an ISBN lookup (or a title + author search that must match the first
 * author). Up to `concurrency` books are worked on at once, every request
 * still going through the shared rate limiter, and `onAttached` hears about
 * each cover as it is stored. Empty and failed searches are recorded with a
 * growing backoff; being offline stops the run without recording anything.
 */
export async function backfillCovers(db: Db, options: BackfillCoversOptions): Promise<BackfillSummary> {
  const { limit = 5, now = Date.now, signal, findCoverIds, concurrency = 1, onAttached, skipFixtureBooks = false } = options;
  const summary: BackfillSummary = { checked: 0, attached: 0, none: 0, failed: 0, offline: false };
  let busy = inFlight.get(db);
  if (!busy) inFlight.set(db, (busy = new Set()));
  const mine = busy;
  const due = await coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now()).toISOString(), limit, skipFixtureBooks });
  const books = due.filter((b) => !mine.has(b.id));
  if (!books.length) return summary;
  books.forEach((b) => mine.add(b.id));

  try {
    let found = new Map<string, CoverSource>();
    const isbns = books.map(searchIsbn13).filter((i): i is string => !!i);
    if (findCoverIds && isbns.length) {
      try {
        found = await findCoverIds(isbns, signal);
      } catch (error) {
        if (isAbortError(error)) return summary;
        if (error instanceof OfflineError) {
          summary.offline = true;
          return summary;
        }
        // Anything else: every book takes the per-book path.
      }
    }
    const hitOf = (book: BookNeedingCover) => {
      const isbn = searchIsbn13(book);
      return isbn ? found.get(isbn) : undefined;
    };
    // Books with cover ids in hand first: they need no lookup, so their covers appear soonest.
    const queue = [...books.filter((b) => hitOf(b)), ...books.filter((b) => !hitOf(b))];
    let stopped = false;

    const work = async (book: BookNeedingCover): Promise<void> => {
      const hit = hitOf(book);
      let source: CoverSource;
      try {
        source = hit ? combineCoverSources(coverSourceFromBook(book), hit) : await sourceFor(book, options);
      } catch (error) {
        stopped = true;
        if (!isAbortError(error)) summary.offline = true;
        return;
      }
      const moreSource = hit && (options.lookupIsbn || options.search) ? () => sourceFor(book, options) : undefined;
      const result = await attachBestCover(db, book.id, source, { ...options, moreSource }).catch((error) => {
        if (isAbortError(error)) return null;
        throw error;
      });
      if (!result) {
        stopped = true;
        return;
      }
      if (result.status === 'offline') {
        stopped = true;
        summary.offline = true;
        return;
      }
      summary.checked++;
      if (result.status === 'attached') {
        summary.attached++;
        onAttached?.(book.id);
      } else if (result.status === 'none') summary.none++;
      else if (result.status === 'failed') summary.failed++;
    };

    const worker = async () => {
      while (!stopped && !signal?.aborted && queue.length) await work(queue.shift()!);
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker));
    return summary;
  } finally {
    books.forEach((b) => mine.delete(b.id));
  }
}
