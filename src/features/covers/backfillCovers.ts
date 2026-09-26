import { coverAttemptsRepo, type BookNeedingCover, type Db } from '@/db';
import { bookMatchKey } from '@/domain';
import { combineCoverSources, coverSourceFromBook, coverSourceFromCandidate, type CoverSource } from '@/services/covers';
import { isAbortError, OfflineError } from '@/services/http';
import type { MetadataResult, SearchQuery } from '@/services/metadata';

import { attachBestCover, type AttachCoverOptions } from './attachCover';

export interface BackfillCoversOptions extends Omit<AttachCoverOptions, 'replace'> {
  /** ISBN lookup for cover ids (the metadata service's `lookupIsbn`); cached responses cost nothing. */
  lookupIsbn?: (isbn13: string, signal?: AbortSignal) => Promise<MetadataResult>;
  /** Title + author search for books without an ISBN (the metadata service's `search`). */
  search?: (query: SearchQuery, signal?: AbortSignal) => Promise<MetadataResult>;
  /** Books looked at per run. Default 5: a gentle trickle, never a crawl. */
  limit?: number;
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

/**
 * Fills in real covers for books that have none: typed in by hand, or saved
 * when no cover could be found (P02-15). Looks at a few due books per run
 * (`coverAttemptsRepo.listBooksNeedingCover`), one at a time through the
 * shared rate limiter: enriches what the book knows with an ISBN lookup (or
 * a title + author search that must match the first author), then runs the
 * cover chain. Empty and failed searches are recorded with a growing
 * backoff; being offline stops the run without recording anything.
 */
export async function backfillCovers(db: Db, options: BackfillCoversOptions): Promise<BackfillSummary> {
  const { limit = 5, now = Date.now, signal } = options;
  const summary: BackfillSummary = { checked: 0, attached: 0, none: 0, failed: 0, offline: false };
  const books = await coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now()).toISOString(), limit });
  for (const book of books) {
    if (signal?.aborted) break;
    let source: CoverSource;
    try {
      source = await sourceFor(book, options);
    } catch (error) {
      if (isAbortError(error)) break;
      summary.offline = true;
      break;
    }
    const result = await attachBestCover(db, book.id, source, options).catch((error) => {
      if (isAbortError(error)) return null;
      throw error;
    });
    if (!result) break;
    if (result.status === 'offline') {
      summary.offline = true;
      break;
    }
    summary.checked++;
    if (result.status === 'attached') summary.attached++;
    else if (result.status === 'none') summary.none++;
    else if (result.status === 'failed') summary.failed++;
  }
  return summary;
}
