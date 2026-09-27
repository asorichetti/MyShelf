import { toIso6391 } from '@/domain/languages';
import { DEFAULT_CACHE_TTL_MS, NotFoundError, type HttpClient } from '@/services/http';
import { withQuery } from '@/services/http/url';

import {
  authorDisplayName,
  authorKeys,
  cleanText,
  isLatinText,
  mapEdition,
  mapSearchDoc,
  olid,
  type OlAuthor,
  type OlEdition,
  type OlEditionsResponse,
  type OlSearchResponse,
  type OlWork,
  wantsLatinNames,
} from './openLibraryMap';

import type { BookCandidate, MetadataProvider, SearchQuery } from './types';

export const OPEN_LIBRARY_BASE = 'https://openlibrary.org';
export const SEARCH_FIELDS = 'key,title,author_name,first_publish_year,edition_count,isbn,cover_i,subject,language,author_key';

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
  const authorRecords = new Map<string, Promise<OlAuthor | null>>();

  function authorRecord(key: string, signal?: AbortSignal): Promise<OlAuthor | null> {
    let record = authorRecords.get(key);
    if (!record) {
      record = orNull(http.getJson<OlAuthor>(`${baseUrl}/authors/${key}.json`, { signal, cacheTtl }));
      // Only successes stay memoised, so a failed lookup is retried next time.
      record.catch(() => authorRecords.delete(key));
      authorRecords.set(key, record);
    }
    return record;
  }

  /** Display names for author keys, in Latin letters for an edition in a Latin-script language. */
  async function authorsFor(keys: string[], language: string | null, signal?: AbortSignal): Promise<string[]> {
    const names: string[] = [];
    for (const key of keys) {
      const name = authorDisplayName(await authorRecord(key, signal), { latinScript: wantsLatinNames(language) });
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
      const authors = await authorsFor(authorKeys(edition, work), toIso6391(edition.languages?.[0]?.key), signal);
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
      const out: BookCandidate[] = [];
      for (const doc of response.docs ?? []) {
        const candidate = mapSearchDoc(doc);
        if (!candidate) continue;
        // Search gives each author's stored name, sometimes in their own script ("村上春樹"): for a reader
        // of a Latin-script language, look those authors up for a Latin form (rare, and cached).
        const keys = doc.author_key ?? [];
        const language = query.language?.code ?? null;
        if (wantsLatinNames(language) && candidate.authors.some((a) => !isLatinText(a)) && keys.length === (doc.author_name ?? []).length) {
          candidate.authors = await authorsFor(keys, language, signal);
        }
        out.push(candidate);
      }
      return out;
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
