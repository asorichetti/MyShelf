import { systemClock, type Clock } from './clock';
import { abortError, HttpError, isAbortError, NotFoundError, OfflineError, RateLimitedError, TimeoutError } from './errors';
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
  /** Per attempt, from when the request is sent. Default 10 s. */
  timeoutMs?: number;
  /** Waits before each retry of a 429/5xx; its length is the retry count. Default 1 s, 2 s, 4 s. */
  retryDelaysMs?: readonly number[];
  /** A `Retry-After` longer than this is not waited for: the request fails at once. Default 30 s. */
  maxRetryAfterMs?: number;
}

export interface HttpRequestOptions {
  signal?: AbortSignal;
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

/** `Retry-After` is either delay-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return match ? match[1].toLowerCase() : url;
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

  /** One attempt, run inside the limiter slot. Resolves with the response or rejects with a typed error. */
  function attempt(url: string, signal: AbortSignal | undefined, accept: string): Promise<Response> {
    return limiter.schedule(
      hostOf(url),
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
          return await doFetch(url, { headers: { Accept: accept, ...headers }, signal: controller.signal });
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

  async function request(url: string, accept: string, { signal, giveUp }: HttpRequestOptions): Promise<Response> {
    for (let retry = 0; ; retry++) {
      const response = await attempt(url, signal, accept);
      const { status } = response;
      if (status >= 200 && status < 300) return response;
      if (status === 404) throw new NotFoundError(url);
      const retryable = status === 429 || status >= 500;
      if (!retryable) throw new HttpError(status, url);

      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'), clock.now());
      const body = giveUp ? await response.text().catch(() => '') : '';
      const fail = () => (status === 429 ? new RateLimitedError(url, retryAfter) : new HttpError(status, url));
      if (retry >= retryDelays.length) throw fail();
      if (giveUp?.(status, body)) throw fail();
      if (retryAfter !== null && retryAfter > maxRetryAfterMs) throw fail();
      await sleep(Math.max(retryDelays[retry], retryAfter ?? 0), clock, signal);
    }
  }

  return {
    async getJson<T>(url: string, opts: HttpRequestOptions = {}): Promise<T> {
      const response = await request(url, 'application/json', opts);
      const text = await response.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new HttpError(response.status, url, `Invalid JSON from ${url}`);
      }
    },
    async getBinary(url: string, opts: HttpRequestOptions = {}): Promise<BinaryResponse> {
      const response = await request(url, 'image/*,*/*', opts);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { bytes, contentType: response.headers.get('Content-Type') };
    },
  };
}
