import { HttpError, isAbortError, NotFoundError, OfflineError, RateLimitedError, type HttpClient } from '@/services/http';

import { coverCandidates, GOOGLE_COVER_WIDTH, type CoverCandidate, type CoverOrigin, type CoverSource } from './coverUrls';
import { compareCovers, isGoodCover, validateCover, type CoverRejection, type CoverShape } from './validateCover';

const isIsbnOrigin = (origin: CoverOrigin) => origin === 'openlibrary-isbn13' || origin === 'openlibrary-isbn10';

/** A real cover, checked and ready to store. */
export interface ResolvedCover {
  url: string;
  origin: CoverOrigin;
  width: number;
  height: number;
  shape: CoverShape;
  format: 'jpeg' | 'png' | 'gif' | 'webp';
  contentType: string | null;
  /** The downloaded image, so saving it needs no second request. */
  bytes: Uint8Array;
}

/** What happened to one place the chain looked, for diagnostics and tests. */
export interface CoverTrial {
  url: string;
  origin: CoverOrigin;
  outcome: 'accepted' | 'passed-over' | 'not-found' | 'rate-limited' | 'unreachable' | 'http-error' | CoverRejection;
  width?: number;
  height?: number;
}

export interface CoverResolution {
  cover: ResolvedCover | null;
  tried: CoverTrial[];
}

export interface ResolveCoverOptions {
  http: Pick<HttpClient, 'getBinary'>;
  signal?: AbortSignal;
  /** False when the user turned Google Books off. Default true. */
  includeGoogle?: boolean;
  /** Most images downloaded in one resolution. Default 4. */
  maxFetches?: number;
  /** Minimum cover height in pixels. Default 150. */
  minHeight?: number;
  /** URLs already tried (e.g. by an earlier resolution with less information); not fetched again. */
  skipUrls?: ReadonlySet<string>;
}

/**
 * Finds the best real cover for a book (PLAN §6 "Covers: real art first").
 * Walks `coverCandidates(source)` in order, downloading each through the
 * HTTP client (same etiquette as metadata) and validating the bytes. Stops
 * at the first good cover (portrait, ≥ 400 px tall); otherwise downloads up
 * to `maxFetches` images and keeps the best acceptable one (portrait over
 * square over odd, then taller). The rate-limited covers by ISBN are only
 * fetched while no portrait cover has turned up.
 *
 * Resolves with `cover: null` when no source has a usable cover. Rejects
 * with `AbortError` when cancelled, `OfflineError` when no request got a
 * response, and `RateLimitedError` when nothing was found and a source
 * refused to answer, so callers can tell "no cover exists" from "try later".
 */
export async function resolveCover(source: CoverSource, options: ResolveCoverOptions): Promise<CoverResolution> {
  const { http, signal, includeGoogle = true, maxFetches = 4, minHeight, skipUrls } = options;
  const tried: CoverTrial[] = [];
  const accepted: ResolvedCover[] = [];
  // Errors kept to explain an empty result (in an object: set inside tryCandidate).
  const failures: { offline: OfflineError | null; rateLimited: RateLimitedError | null } = { offline: null, rateLimited: null };
  let fetches = 0;

  for (const candidate of coverCandidates(source, { includeGoogle })) {
    if (skipUrls?.has(candidate.url)) continue;
    // Covers by ISBN are rate-limited (100 per 5 minutes) and show the edition's own cover, which a cover
    // id already fetched: once an id gave a usable portrait cover, they are not worth the wait.
    if (isIsbnOrigin(candidate.origin) && accepted.some((c) => c.shape === 'portrait')) continue;
    if (fetches >= maxFetches) break;
    fetches++;
    const trial = await tryCandidate(candidate);
    tried.push(trial.record);
    if (trial.cover) {
      accepted.push(trial.cover);
      if (isGoodCover(trial.cover)) break;
    }
  }

  async function tryCandidate(candidate: CoverCandidate): Promise<{ record: CoverTrial; cover?: ResolvedCover }> {
    const { url, origin } = candidate;
    try {
      const { bytes, contentType } = await http.getBinary(url, { signal });
      const check = validateCover(bytes, contentType, {
        minHeight,
        minScaledWidth: origin === 'googlebooks' && url.includes(`fife=w${GOOGLE_COVER_WIDTH}`) ? 256 : undefined,
      });
      if (!check.ok) return { record: { url, origin, outcome: check.reason, width: check.size?.width, height: check.size?.height } };
      const cover: ResolvedCover = { url, origin, width: check.width, height: check.height, shape: check.shape, format: check.format, contentType, bytes };
      return { record: { url, origin, outcome: 'accepted', width: check.width, height: check.height }, cover };
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof NotFoundError) return { record: { url, origin, outcome: 'not-found' } };
      if (error instanceof RateLimitedError) {
        failures.rateLimited ??= error;
        return { record: { url, origin, outcome: 'rate-limited' } };
      }
      if (error instanceof OfflineError) {
        // On web, an image host without CORS headers (Google's) also lands here.
        failures.offline ??= error;
        return { record: { url, origin, outcome: 'unreachable' } };
      }
      if (error instanceof HttpError) return { record: { url, origin, outcome: 'http-error' } };
      throw error;
    }
  }

  if (!accepted.length) {
    if (failures.offline && tried.every((t) => t.outcome === 'unreachable')) throw failures.offline;
    if (failures.rateLimited) throw failures.rateLimited;
    return { cover: null, tried };
  }
  const best = [...accepted].sort(compareCovers)[0];
  for (const t of tried) if (t.outcome === 'accepted' && t.url !== best.url) t.outcome = 'passed-over';
  return { cover: best, tried };
}
