/** Typed errors raised by the HTTP client (`client.ts`). */

/** A response with a status the caller did not ask for (after any retries). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message = `HTTP ${status} for ${url}`,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** 404: the resource (an ISBN, a work) is unknown to the provider. */
export class NotFoundError extends HttpError {
  constructor(url: string) {
    super(404, url, `Not found: ${url}`);
    this.name = 'NotFoundError';
  }
}

/**
 * 429 that persisted through every retry, or one the caller chose not to
 * retry (e.g. a daily quota). `retryAfterMs` is the server's hint, when given.
 */
export class RateLimitedError extends HttpError {
  constructor(
    url: string,
    readonly retryAfterMs: number | null = null,
    message = `Rate limited: ${url}`,
  ) {
    super(429, url, message);
    this.name = 'RateLimitedError';
  }
}

/** The request never got a response: no network, DNS failure, connection reset. */
export class OfflineError extends Error {
  constructor(
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(`Could not reach ${url}`);
    this.name = 'OfflineError';
  }
}

/** No response within the timeout. A kind of OfflineError: the network is too poor to use. */
export class TimeoutError extends OfflineError {
  constructor(
    url: string,
    readonly timeoutMs: number,
  ) {
    super(url);
    this.message = `No response from ${url} within ${timeoutMs} ms`;
    this.name = 'TimeoutError';
  }
}

/** The standard error `fetch` rejects with when its signal is aborted. */
export function abortError(reason?: unknown): Error {
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** True for a cancelled request (the caller aborted); never a failure to report. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
