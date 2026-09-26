import { isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/domain';
import { DEFAULT_CACHE_TTL_MS, isAbortError, OfflineError, TimeoutError, withQuery, type HttpClient } from '@/services/http';

import type { CoverSource } from './coverUrls';

export const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json';

/**
 * ISBNs asked about in one search. Tested against openlibrary.org in
 * September 2026: 20 ISBNs answered in about 1 s, 40 in 2 s, 100 in 4.5 s and
 * 150 in 9 s (close to the client's 10 s timeout), every ISBN found each
 * time. 40 keeps each answer quick and the URL under 1 KB.
 */
export const COVER_BATCH_SIZE = 40;

/**
 * The work's cover and, through `editions`, the one edition of the work that
 * matched the query, with its own cover id and ISBNs. Asking for the work's
 * `isbn` list instead would return every ISBN of every edition (hundreds for
 * a classic); this answer stays around 3 KB for 8 books.
 */
export const COVER_BATCH_FIELDS = 'key,cover_i,editions,editions.key,editions.cover_i,editions.isbn';

interface BatchEdition {
  key?: string;
  cover_i?: number;
  isbn?: string[];
}

interface BatchDoc {
  key?: string;
  cover_i?: number;
  editions?: { docs?: BatchEdition[] };
}

export interface CoverBatchResponse {
  docs?: BatchDoc[];
}

/** The ISBN-13 a book is searched under: its own, or the one derived from its ISBN-10. */
export function searchIsbn13(book: { isbn13?: string | null; isbn10?: string | null }): string | null {
  const raw13 = normalizeIsbn(book.isbn13);
  if (raw13 && isValidIsbn13(raw13)) return raw13;
  const raw10 = normalizeIsbn(book.isbn10);
  return raw10 && isValidIsbn10(raw10) ? isbn10To13(raw10) : null;
}

/** One search for several ISBNs; sorted, so the same books always ask the same URL (cache hits, recorded fixtures). */
export function coverBatchUrl(isbns13: readonly string[]): string {
  const sorted = [...new Set(isbns13)].sort();
  return withQuery(OPEN_LIBRARY_SEARCH, { q: `isbn:(${sorted.join(' OR ')})`, fields: COVER_BATCH_FIELDS, limit: 100 });
}

const positive = (id: number | undefined): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0;
const olidOf = (key: string | undefined) => (key ? (key.split('/').filter(Boolean).pop() ?? null) : null);

/**
 * What one search answer says about each ISBN asked for: the matching
 * edition's cover id and OLID, and its work's cover id. When an ISBN matches
 * several works (a single volume and the box set holding it), the first one
 * whose matching edition has a cover wins, else the first match. ISBNs the
 * answer does not mention are left out.
 */
export function coverSourcesFromBatch(response: CoverBatchResponse, isbns13: readonly string[]): Map<string, CoverSource> {
  const out = new Map<string, CoverSource>();
  const docs = response.docs ?? [];
  for (const isbn13 of isbns13) {
    const forms = new Set([isbn13, isbn13To10(isbn13)].filter((f): f is string => !!f));
    const matches: { doc: BatchDoc; edition: BatchEdition }[] = [];
    for (const doc of docs) {
      for (const edition of doc.editions?.docs ?? []) {
        if ((edition.isbn ?? []).some((i) => forms.has(i))) matches.push({ doc, edition });
      }
    }
    const best = matches.find((m) => positive(m.edition.cover_i)) ?? matches[0];
    if (!best) continue;
    out.set(isbn13, {
      isbn13,
      olEditionCoverIds: positive(best.edition.cover_i) ? [best.edition.cover_i] : [],
      olEditionId: olidOf(best.edition.key),
      olWorkCoverIds: positive(best.doc.cover_i) ? [best.doc.cover_i] : [],
    });
  }
  return out;
}

export interface FindCoverIdsOptions {
  signal?: AbortSignal;
  /** Default `COVER_BATCH_SIZE`. */
  batchSize?: number;
  /** How long a cached answer stays fresh (when the client has a cache). Default 30 days. */
  cacheTtlMs?: number;
}

/**
 * Finds Open Library cover ids for many books at once (PLAN §6 "Covers:
 * real art first"): one search request per `batchSize` ISBN-13s instead of
 * an edition, work and author lookup per book. Keyed by ISBN-13; books the
 * search misses are not in the map, so the caller falls back to the full
 * per-book lookup for them. A batch that fails (an HTTP error, a refusal,
 * a bad answer, a timeout) just leaves its books out; being offline or
 * cancelled rejects, as for any other request.
 */
export async function findCoverIdsByIsbn(
  http: Pick<HttpClient, 'getJson'>,
  isbns13: readonly string[],
  { signal, batchSize = COVER_BATCH_SIZE, cacheTtlMs = DEFAULT_CACHE_TTL_MS }: FindCoverIdsOptions = {},
): Promise<Map<string, CoverSource>> {
  const unique = [...new Set(isbns13)];
  const found = new Map<string, CoverSource>();
  for (let i = 0; i < unique.length; i += batchSize) {
    const chunk = unique.slice(i, i + batchSize);
    try {
      const response = await http.getJson<CoverBatchResponse>(coverBatchUrl(chunk), { signal, cacheTtl: cacheTtlMs });
      for (const [isbn, source] of coverSourcesFromBatch(response, chunk)) found.set(isbn, source);
    } catch (error) {
      // A slow answer is not a lost connection: its books take the per-book path.
      if (isAbortError(error) || (error instanceof OfflineError && !(error instanceof TimeoutError))) throw error;
    }
  }
  return found;
}
