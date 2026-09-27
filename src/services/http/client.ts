import { type ResponseCache } from './cache';
import { systemClock, type Clock } from './clock';
import { abortError, HttpError, isAbortError, NotFoundError, OfflineError, RateLimitedError, TimeoutError } from './errors';
import { rateKeyOf } from './etiquette';
import { createRateLimiter, type RateLimiter } from './rateLimiter';

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export interface HttpClientOptions {
  /** Defaults to the global `fetch`, looked up per request. */
  fetch?: FetchLike;
  /** Sent as `User-Agent` when set (native only: browsers refuse the header). */
  userAgent?: string;
  clock?: Clock;
  /** Shared per-host queue. Defaults to 1 request/second per host, 2 in flight. */
  limiter?: RateLimiter;
  /** Per attempt, from when the request is sent until its whole body has arrived. Default 10 s. */
  timeoutMs?: number;
  /** Waits before each retry of a 429/5xx; its length is the retry count. Default 1 s, 2 s, 4 s. */
  retryDelaysMs?: readonly number[];
  /** A `Retry-After` longer than this is not waited for: the request fails at once. Default 30 s. */
  maxRetryAfterMs?: number;
  /** Response cache for `getJson` requests that pass `cacheTtl`. */
  cache?: ResponseCache;
}

export interface HttpRequestOptions {
  signal?: AbortSignal;
  /**
   * `getJson` only: answer from the cache when an entry is younger than this
   * many milliseconds (no network at all), and store a successful response.
   * Needs a client created with a `cache`.
   */
  cacheTtl?: number;
  /**
   * `getJson` only: the key the response is cached under, when it should
   * differ from the URL (e.g. to keep an API key out of the stored entries).
   * Defaults to the URL.
   */
  cacheKey?: string;
  /**
   * Return true to fail a 429/5xx at once instead of retrying, e.g. for a
   * daily quota that backing off for seconds cannot fix. Gets the status and
   * the response body text.
   */
  giveUp?: (status: number, body: string) => boolean;
}

export interface BinaryResponse {
  bytes: Uint8Array;
  contentType: string | null;
}

export interface HttpClient {
  /** GET and parse JSON. 404 → NotFoundError; persistent 429 → RateLimitedError; no network → OfflineError. */
  getJson<T = unknown>(url: string, options?: HttpRequestOptions): Promise<T>;
  /** GET raw bytes (cover images), with the same etiquette and errors as `getJson`. */
  getBinary(url: string, options?: HttpRequestOptions): Promise<BinaryResponse>;
}

const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000] as const;

/** A response read in full: its body as text (JSON, or an error body) or as bytes (an image). */
interface Answer {
  status: number;
  headers: Headers;
  text: string;
  bytes: Uint8Array | null;
}

/** `Retry-After` is either delay-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

function sleep(ms: number, clock: Clock, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError(signal.reason));
    const onAbort = () => {
      clock.clearTimeout(handle);
      reject(abortError(signal?.reason));
    };
    const handle = clock.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The one way the app talks to the network (PLAN §6 etiquette): identifies
 * itself, queues politely per host, times out, retries 429/5xx with backoff,
 * honours `Retry-After`, supports cancellation and raises typed errors.
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const clock = options.clock ?? systemClock;
  const limiter = options.limiter ?? createRateLimiter({ clock });
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 30_000;
  const doFetch: FetchLike = options.fetch ?? ((url, init) => fetch(url, init));
  const headers: Record<string, string> = {};
  if (options.userAgent) headers['User-Agent'] = options.userAgent;

  /**
   * One attempt, run inside the limiter slot: the request and, for a
   * success (or an error whose body `giveUp` needs), its body, all under the
   * timeout and the caller's signal. A browser's `fetch` resolves as soon as
   * the headers arrive, so a body that stalls must time out too. Resolves
   * with the answer or rejects with a typed error.
   */
  function attempt(url: string, signal: AbortSignal | undefined, accept: string, binary: boolean, errorBody: boolean): Promise<Answer> {
    return limiter.schedule(
      rateKeyOf(url),
      async () => {
        if (signal?.aborted) throw abortError(signal.reason);
        const controller = new AbortController();
        let timedOut = false;
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener('abort', onAbort, { once: true });
        const timer = clock.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
        try {
          const response = await doFetch(url, { headers: { Accept: accept, ...headers }, signal: controller.signal });
          const { status } = response;
          const answer: Answer = { status, headers: response.headers, text: '', bytes: null };
          if (status >= 200 && status < 300) {
            if (binary) answer.bytes = new Uint8Array(await response.arrayBuffer());
            else answer.text = await response.text();
          } else if (errorBody && (status === 429 || status >= 500)) {
            answer.text = await response.text().catch(() => '');
          }
          return answer;
        } catch (error) {
          if (signal?.aborted) throw abortError(signal.reason);
          if (timedOut) throw new TimeoutError(url, timeoutMs);
          if (isAbortError(error)) throw abortError(error);
          throw new OfflineError(url, error);
        } finally {
          clock.clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        }
      },
      signal,
    );
  }

  async function request(url: string, accept: string, binary: boolean, { signal, giveUp }: HttpRequestOptions): Promise<Answer> {
    for (let retry = 0; ; retry++) {
      const answer = await attempt(url, signal, accept, binary, giveUp !== undefined);
      const { status } = answer;
      if (status >= 200 && status < 300) return answer;
      if (status === 404) throw new NotFoundError(url);
      const retryable = status === 429 || status >= 500;
      if (!retryable) throw new HttpError(status, url);

      const retryAfter = parseRetryAfter(answer.headers.get('Retry-After'), clock.now());
      const fail = () => (status === 429 ? new RateLimitedError(url, retryAfter) : new HttpError(status, url));
      if (retry >= retryDelays.length) throw fail();
      if (giveUp?.(status, answer.text)) throw fail();
      if (retryAfter !== null && retryAfter > maxRetryAfterMs) throw fail();
      await sleep(Math.max(retryDelays[retry], retryAfter ?? 0), clock, signal);
    }
  }

  return {
    async getJson<T>(url: string, opts: HttpRequestOptions = {}): Promise<T> {
      const cache = opts.cacheTtl && opts.cacheTtl > 0 ? options.cache : undefined;
      if (cache) {
        const cached = await cache.read(opts.cacheKey ?? url, opts.cacheTtl!);
        if (cached !== null) {
          try {
            return JSON.parse(cached) as T;
          } catch {
            // A corrupt entry is refetched and overwritten.
          }
        }
      }
      const { status, text } = await request(url, 'application/json', false, opts);
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        throw new HttpError(status, url, `Invalid JSON from ${url}`);
      }
      if (cache) await cache.write(opts.cacheKey ?? url, text);
      return parsed;
    },
    async getBinary(url: string, opts: HttpRequestOptions = {}): Promise<BinaryResponse> {
      const { bytes, headers: responseHeaders } = await request(url, 'image/*,*/*', true, opts);
      return { bytes: bytes ?? new Uint8Array(), contentType: responseHeaders.get('Content-Type') };
    },
  };
}
