import { DEFAULT_CACHE_TTL_MS, NotFoundError, type HttpClient } from '@/services/http';
import { withQuery } from '@/services/http/url';

import {
  authorKeys,
  cleanText,
  mapEdition,
  mapSearchDoc,
  olid,
  type OlAuthor,
  type OlEdition,
  type OlEditionsResponse,
  type OlSearchResponse,
  type OlWork,
} from './openLibraryMap';

import type { BookCandidate, MetadataProvider, SearchQuery } from './types';

export const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
export const SEARCH_FIELDS = 'key,title,author_name,first_publish_year,edition_count,isbn,cover_i,subject,language';

export interface OpenLibraryOptions {
  http: HttpClient;
  baseUrl?: string;
  /** How long cached responses stay fresh (when the client has a cache). Default 30 days. */
  cacheTtlMs?: number;
}

export interface EditionsOptions {
  signal?: AbortSignal;
  /** The work's authors, when known (edition entries rarely carry resolvable names). */
  authors?: string[];
  /** Default 50, the most Open Library returns per page. */
  limit?: number;
}

export interface OpenLibraryProvider extends MetadataProvider {
  id: 'openlibrary';
  /** Editions of a work (`OL453657W` or `/works/OL453657W`), for the edition picker. */
  editions(workKey: string, options?: EditionsOptions): Promise<BookCandidate[]>;
}

/** Resolves to null for a 404 and rethrows everything else (offline, rate limits, aborts). */
async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/**
 * Open Library (PLAN §6): an ISBN lookup reads the edition, then its work
 * (description, subjects) and authors; search returns works; `editions`
 * lists a work's editions.
 */
export function createOpenLibrary({
  http,
  baseUrl = OPEN_LIBRARY_BASE,
  cacheTtlMs: cacheTtl = DEFAULT_CACHE_TTL_MS,
}: OpenLibraryOptions): OpenLibraryProvider {
  const authorNames = new Map<string, Promise<string | null>>();

  function authorName(key: string, signal?: AbortSignal): Promise<string | null> {
    let name = authorNames.get(key);
    if (!name) {
      name = orNull(http.getJson<OlAuthor>(`${baseUrl}/authors/${key}.json`, { signal, cacheTtl })).then(
        (a) => cleanText(a?.name) ?? cleanText(a?.personal_name),
      );
      // Only successes stay memoised, so a failed lookup is retried next time.
      name.catch(() => authorNames.delete(key));
      authorNames.set(key, name);
    }
    return name;
  }

  async function authorsFor(keys: string[], signal?: AbortSignal): Promise<string[]> {
    const names: string[] = [];
    for (const key of keys) {
      const name = await authorName(key, signal);
      if (name) names.push(name);
    }
    return names;
  }

  return {
    id: 'openlibrary',

    async lookupIsbn(isbn13, signal) {
      // Open Library redirects /isbn/{isbn} to /books/{OLID}; fetch follows it.
      const edition = await orNull(http.getJson<OlEdition>(`${baseUrl}/isbn/${isbn13}.json`, { signal, cacheTtl }));
      if (!edition) return [];
      const workId = olid(edition.works?.[0]?.key);
      const work = workId ? await orNull(http.getJson<OlWork>(`${baseUrl}/works/${workId}.json`, { signal, cacheTtl })) : null;
      const authors = await authorsFor(authorKeys(edition, work), signal);
      return [mapEdition(edition, { work, authors, requestedIsbn13: isbn13, confidence: 0.95 })];
    },

    async search(query: SearchQuery, signal) {
      const title = query.title?.trim();
      const author = query.author?.trim();
      const text = query.text?.trim();
      if (!title && !author && !text) return [];
      const params = title || author ? { title, author } : { q: text };
      const url = withQuery(`${baseUrl}/search.json`, { ...params, fields: SEARCH_FIELDS, limit: 10 });
      const response = await http.getJson<OlSearchResponse>(url, { signal, cacheTtl });
      return (response.docs ?? []).map(mapSearchDoc).filter((c): c is BookCandidate => c !== null);
    },

    async editions(workKey, { signal, authors = [], limit = 50 } = {}) {
      const id = olid(workKey);
      if (!id) return [];
      const url = withQuery(`${baseUrl}/works/${id}/editions.json`, { limit });
      const response = await orNull(http.getJson<OlEditionsResponse>(url, { signal, cacheTtl }));
      return (response?.entries ?? [])
        .filter((e) => cleanText(e.title))
        .map((e) => mapEdition(e, { authors, confidence: 0.5 }));
    },
  };
}
