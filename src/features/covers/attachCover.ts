import { booksRepo, coverAttemptsRepo, type Db } from '@/db';
import { deleteCoverFile, downloadCover as platformDownloadCover, resolveCover, type CoverSource, type CoverTrial, type ResolvedCover } from '@/services/covers';
import { isAbortError, OfflineError, type HttpClient } from '@/services/http';

import { releaseCover } from './release';

export interface AttachCoverOptions {
  /** The app's HTTP client (`getLookupServices(db).http`). */
  http: Pick<HttpClient, 'getBinary'>;
  signal?: AbortSignal;
  /** False when the user turned Google Books off. Default true. */
  includeGoogle?: boolean;
  /** Replace a cover the book already has (e.g. "Find a better cover"). Default false: a user's photo is never overwritten. */
  replace?: boolean;
  /** Clock for the attempt log. */
  now?: () => number;
  /** Stores the image; defaults to the platform `downloadCover` (a file on native, the remote URL on web). */
  downloadCover?: typeof platformDownloadCover;
  /**
   * More to go on when `source` leads to no usable cover: e.g. the backfill
   * starts from cover ids found in a batch search and falls back to the full
   * ISBN lookup. Its new places are tried before the search is recorded as
   * empty. Rejecting with `OfflineError` counts as offline.
   */
  moreSource?: () => Promise<CoverSource | null>;
}

export type AttachCoverResult =
  /** A real cover was found, stored and set as `cover_uri`. */
  | { status: 'attached'; coverUri: string; cover: Omit<ResolvedCover, 'bytes'> }
  /** The book already has a cover and `replace` was not set, or the user changed its cover while the search ran. */
  | { status: 'kept' }
  /** No source has a usable cover; recorded, so the backfill waits before trying again. */
  | { status: 'none'; tried: CoverTrial[] }
  /** No network: nothing recorded, try again later. */
  | { status: 'offline' }
  /** A source refused or failed; recorded with a short backoff. */
  | { status: 'failed'; error: string };

/**
 * Finds the best real cover for a saved book and stores it (PLAN §6
 * "Covers: real art first"): call it after saving a book from a lookup,
 * with `coverSourceFromCandidate(candidate)`, and from the backfill. The
 * image already downloaded to validate it is written out without a second
 * request. Never throws for network trouble (the book stays saved with its
 * generated cover); rejects only when cancelled.
 */
export async function attachBestCover(db: Db, bookId: number, source: CoverSource, options: AttachCoverOptions): Promise<AttachCoverResult> {
  const { http, signal, includeGoogle, replace = false, now = Date.now, downloadCover = platformDownloadCover, moreSource } = options;
  const book = await booksRepo.getBook(db, bookId);
  if (!book) return { status: 'failed', error: `No book ${bookId}` };
  if (book.coverUri?.trim() && !replace) return { status: 'kept' };

  const record = async (result: 'none' | 'error', error: string | null = null) => {
    // The book may have been deleted meanwhile; the log is only an optimisation.
    await coverAttemptsRepo.recordAttempt(db, bookId, result, { now: now(), error }).catch(() => undefined);
  };

  try {
    let { cover, tried } = await resolveCover(source, { http, signal, includeGoogle });
    const more = !cover && moreSource ? await moreSource() : null;
    if (more) {
      const skipUrls = new Set(tried.map((t) => t.url));
      const second = await resolveCover(more, { http, signal, includeGoogle, skipUrls });
      cover = second.cover;
      tried = [...tried, ...second.tried];
    }
    if (!cover) {
      await record('none');
      return { status: 'none', tried };
    }
    // The search took a while: the user may have chosen a cover of their own or deleted the book
    // meanwhile. Neither may be overwritten or brought back.
    const changed = async () => {
      const current = await booksRepo.getBook(db, bookId);
      if (!current) return { status: 'failed', error: `No book ${bookId}` } as const;
      return (current.coverUri ?? '') !== (book.coverUri ?? '') ? ({ status: 'kept' } as const) : null;
    };
    const early = await changed();
    if (early) return early;
    const { bytes, ...found } = cover;
    // Hand the bytes we already have to the downloader instead of fetching them again.
    const reuse: AttachCoverOptions['http'] = {
      getBinary: (url, opts) => (url === cover.url ? Promise.resolve({ bytes, contentType: cover.contentType }) : http.getBinary(url, opts)),
    };
    // A new file of its own: the old cover stays on disk (and on screen) until the book names the new one.
    const coverUri = await downloadCover(bookId, cover.url, { http: reuse, signal });
    const late = signal?.aborted ? null : await changed().catch(() => null);
    if (signal?.aborted || late) {
      deleteCoverFile(coverUri);
      if (signal?.aborted) throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      return late!;
    }
    try {
      await booksRepo.updateBook(db, bookId, { coverUri });
    } catch (error) {
      deleteCoverFile(coverUri);
      throw error;
    }
    // The cover it replaces goes once nothing names it ("Find a better cover", "Refresh details").
    if (book.coverUri && book.coverUri !== coverUri) await releaseCover(db, book.coverUri);
    await coverAttemptsRepo.clear(db, bookId);
    return { status: 'attached', coverUri, cover: found };
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error instanceof OfflineError) return { status: 'offline' };
    const message = error instanceof Error ? error.message : String(error);
    await record('error', message);
    return { status: 'failed', error: message };
  }
}
