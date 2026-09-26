import { isbn13To10 } from '@/domain';
import { DEFAULT_CACHE_TTL_MS, type HttpClient } from '@/services/http';
import { withQuery } from '@/services/http/url';

import { mapVolume, type GbVolumesResponse } from './googleBooksMap';

import type { BookCandidate, MetadataProvider, SearchQuery } from './types';

export const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1';

/** The `fields=` filter from PLAN §6, plus `totalItems` so an empty result is explicit. */
export const VOLUME_FIELDS =
  'totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,language,seriesInfo))';

export interface GoogleBooksOptions {
  http: HttpClient;
  baseUrl?: string;
  /** How long cached responses stay fresh (when the client has a cache). Default 30 days. */
  cacheTtlMs?: number;
  /**
   * Optional API key (free, from Google Cloud). Keyless requests share a
   * project quota that can be zero; a key gives the app its own daily quota.
   * The key is sent with each request but never stored in the response cache.
   */
  apiKey?: string;
}

/**
 * True for a 429 caused by a daily quota. Keyless requests share one Google
 * project whose daily quota can be exhausted (or zero); retrying within
 * seconds cannot help, so the request fails at once.
 */
export function isDailyQuotaError(status: number, body: string): boolean {
  return status === 429 && /per ?day|PerDay|dailyLimit/i.test(body);
}

/** `"the colour of magic"` → `intitle:"the colour of magic"`; quotes inside are dropped. */
function term(operator: string, value: string | undefined): string | null {
  const v = value?.replace(/"/g, ' ').replace(/\s+/g, ' ').trim();
  return v ? `${operator}:"${v}"` : null;
}

/** Google Books (PLAN §6): ISBN lookup and title/author search, keyless or with an optional API key. */
export function createGoogleBooks({
  http,
  baseUrl = GOOGLE_BOOKS_BASE,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  apiKey,
}: GoogleBooksOptions): MetadataProvider {
  const key = apiKey?.trim() || undefined;

  async function volumes(q: string, maxResults: number, signal?: AbortSignal): Promise<GbVolumesResponse> {
    const cacheKey = withQuery(`${baseUrl}/volumes`, { q, maxResults, printType: 'books', fields: VOLUME_FIELDS });
    const url = key ? withQuery(cacheKey, { key }) : cacheKey;
    return http.getJson<GbVolumesResponse>(url, { signal, giveUp: isDailyQuotaError, cacheTtl: cacheTtlMs, cacheKey });
  }

  return {
    id: 'googlebooks',

    async lookupIsbn(isbn13, signal) {
      const response = await volumes(`isbn:${isbn13}`, 5, signal);
      const isbn10 = isbn13To10(isbn13);
      return (response.items ?? [])
        .map((v) => mapVolume(v, 0.85))
        .filter((c): c is BookCandidate => c !== null)
        // Keep the volumes that are this ISBN; Google sometimes adds other editions.
        .filter((c) => (!c.isbn13 && !c.isbn10) || c.isbn13 === isbn13 || (isbn10 !== null && c.isbn10 === isbn10));
    },

    async search(query: SearchQuery, signal) {
      const structured = [term('intitle', query.title), term('inauthor', query.author)].filter(Boolean).join(' ');
      const q = structured || query.text?.replace(/\s+/g, ' ').trim();
      if (!q) return [];
      const response = await volumes(q, 10, signal);
      return (response.items ?? []).map((v) => mapVolume(v)).filter((c): c is BookCandidate => c !== null);
    },
  };
}
