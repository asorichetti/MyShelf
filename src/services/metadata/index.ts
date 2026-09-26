import { isbn10To13, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '@/domain';
import { isAbortError, OfflineError, RateLimitedError, systemClock, type HttpClient } from '@/services/http';

import { createGoogleBooks } from './googleBooks';
import { dedupeCandidates } from './merge';
import { createOpenLibrary, type EditionsOptions, type OpenLibraryProvider } from './openLibrary';
import { rankCandidates } from './rank';

import type { BookCandidate, MetadataProvider, MetadataResult, ProviderWarning, SearchQuery } from './types';

export type { BookCandidate, CandidateSource, MetadataProvider, MetadataResult, ProviderWarning, SearchQuery, SeriesHint } from './types';
export { createGoogleBooks, isDailyQuotaError } from './googleBooks';
export { dedupeCandidates, mergeCandidates } from './merge';
export { createOpenLibrary, type OpenLibraryProvider } from './openLibrary';
export { rankCandidates, scoreCandidate } from './rank';

/** The text is not a valid ISBN-10 or ISBN-13. */
export class InvalidIsbnError extends Error {
  constructor(readonly input: string) {
    super(`Not a valid ISBN: ${input}`);
    this.name = 'InvalidIsbnError';
  }
}

export interface MetadataServiceOptions {
  openLibrary: OpenLibraryProvider;
  googleBooks?: MetadataProvider | null;
  /** Read on every request, so a settings change applies at once. Default: enabled. */
  isGoogleBooksEnabled?: () => boolean | Promise<boolean>;
  /** How long to leave Google Books alone after it rate-limits us. Default 1 hour (or its Retry-After). */
  googleBooksCooldownMs?: number;
  clock?: { now(): number };
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface MetadataService {
  /**
   * One merged candidate per ISBN (usually zero or one) from both providers.
   * Accepts ISBN-10 or ISBN-13 with or without hyphens. Rejects with
   * `InvalidIsbnError` for bad input, `OfflineError` when no provider could
   * be reached (so the caller can queue it), or the first provider's error
   * when both failed otherwise. One provider failing adds a warning instead.
   */
  lookupIsbn(isbn: string, options?: RequestOptions): Promise<MetadataResult>;
  /** Merged, de-duplicated and ranked candidates from both providers, with the same failure rules. */
  search(query: SearchQuery, options?: RequestOptions): Promise<MetadataResult>;
  /** Editions of an Open Library work, for the edition picker (P03-08). */
  editions(workKey: string, options?: EditionsOptions): Promise<BookCandidate[]>;
}

/** ISBN-13 for any valid ISBN-10/13 input, or null. */
export function toIsbn13(input: string): string | null {
  const isbn = normalizeIsbn(input);
  if (!isbn) return null;
  if (isValidIsbn13(isbn)) return isbn;
  return isValidIsbn10(isbn) ? isbn10To13(isbn) : null;
}

function warningFor(provider: MetadataProvider['id'], error: unknown): ProviderWarning {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof OfflineError) return { provider, reason: 'offline', message };
  if (error instanceof RateLimitedError) return { provider, reason: 'rate-limited', message };
  return { provider, reason: 'failed', message };
}

/**
 * Queries Open Library and Google Books together and merges their answers
 * (P02-06, PLAN §6 "Merging providers").
 */
export function createMetadataService(options: MetadataServiceOptions): MetadataService {
  const { openLibrary, googleBooks = null, isGoogleBooksEnabled = () => true } = options;
  const clock = options.clock ?? systemClock;
  const cooldownMs = options.googleBooksCooldownMs ?? 60 * 60 * 1000;
  let googleBooksRestingUntil = 0;

  async function providers(warnings: ProviderWarning[]): Promise<MetadataProvider[]> {
    const list: MetadataProvider[] = [openLibrary];
    if (!googleBooks || !(await isGoogleBooksEnabled())) return list;
    if (clock.now() < googleBooksRestingUntil) {
      warnings.push({ provider: 'googlebooks', reason: 'rate-limited', message: 'Google Books is resting after refusing requests' });
      return list;
    }
    return [...list, googleBooks];
  }

  async function gather(
    call: (p: MetadataProvider) => Promise<BookCandidate[]>,
    signal: AbortSignal | undefined,
  ): Promise<{ candidates: BookCandidate[]; warnings: ProviderWarning[] }> {
    const warnings: ProviderWarning[] = [];
    const active = await providers(warnings);
    const settled = await Promise.allSettled(active.map(call));
    if (signal?.aborted) throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    const candidates: BookCandidate[] = [];
    const errors: unknown[] = [];
    settled.forEach((result, i) => {
      const provider = active[i];
      if (result.status === 'fulfilled') {
        candidates.push(...result.value);
        return;
      }
      if (isAbortError(result.reason)) throw result.reason;
      errors.push(result.reason);
      warnings.push(warningFor(provider.id, result.reason));
      if (provider.id === 'googlebooks' && result.reason instanceof RateLimitedError) {
        googleBooksRestingUntil = clock.now() + Math.max(cooldownMs, result.reason.retryAfterMs ?? 0);
      }
    });
    if (errors.length === active.length) {
      throw errors.find((e) => e instanceof OfflineError) ?? errors[0];
    }
    return { candidates, warnings };
  }

  return {
    async lookupIsbn(input, { signal } = {}) {
      const isbn13 = toIsbn13(input);
      if (!isbn13) throw new InvalidIsbnError(input);
      const { candidates, warnings } = await gather((p) => p.lookupIsbn(isbn13, signal), signal);
      // Every candidate describes the requested ISBN; merge them into one per ISBN.
      const merged = dedupeCandidates(candidates.map((c) => ({ ...c, isbn13: c.isbn13 ?? isbn13 })));
      return { candidates: merged, warnings };
    },

    async search(query, { signal } = {}) {
      if (!query.title?.trim() && !query.author?.trim() && !query.text?.trim()) return { candidates: [], warnings: [] };
      const { candidates, warnings } = await gather((p) => p.search(query, signal), signal);
      return { candidates: rankCandidates(dedupeCandidates(candidates), query), warnings };
    },

    editions: (workKey, editionOptions) => openLibrary.editions(workKey, editionOptions),
  };
}

export interface DefaultServiceOptions extends Omit<MetadataServiceOptions, 'openLibrary' | 'googleBooks'> {
  http: HttpClient;
}

/** The service with both real providers on one HTTP client. */
export function createDefaultMetadataService({ http, ...rest }: DefaultServiceOptions): MetadataService {
  return createMetadataService({ ...rest, openLibrary: createOpenLibrary({ http }), googleBooks: createGoogleBooks({ http }) });
}
