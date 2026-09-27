/**
 * @jest-environment node
 */
import { createHttpClient, parseRetryAfter, type FetchLike } from '../client';
import { HttpError, NotFoundError, OfflineError, RateLimitedError, TimeoutError } from '../errors';
import { formatUserAgent } from '../userAgent.shared';

const URL_A = 'https://openlibrary.org/isbn/9780552166591.json';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** A fetch that answers from a list of responses (or functions producing them), recording each call. */
function scriptedFetch(...script: (Response | Error | ((signal: AbortSignal) => Promise<Response>))[]) {
  const calls: { url: string; headers: Record<string, string>; signal: AbortSignal; at: number }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, signal: init.signal, at: Date.now() });
    const next = script.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next(init.signal);
    return next;
  };
  return { fetch, calls };
}

/** Never settles until the signal aborts, like a hung connection. */
const hang = (signal: AbortSignal) =>
  new Promise<Response>((_, reject) => {
    signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });

type Caught = Error & { status: number; url: string; retryAfterMs: number | null };

/** Resolves with the rejection reason so tests can inspect typed errors. */
async function failure(promise: Promise<unknown>): Promise<Caught> {
  try {
    await promise;
  } catch (error) {
    return error as Caught;
  }
  throw new Error('expected the request to fail');
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('createHttpClient', () => {
  it('sends the User-Agent and parses JSON', async () => {
    const { fetch, calls } = scriptedFetch(json({ title: 'The Colour of Magic' }));
    const client = createHttpClient({ fetch, userAgent: formatUserAgent('1.0.0') });
    await expect(client.getJson(URL_A)).resolves.toEqual({ title: 'The Colour of Magic' });
    expect(calls[0].headers).toEqual({
      Accept: 'application/json',
      'User-Agent': 'MyShelf/1.0.0 (+https://github.com/asorichetti/MyShelf)',
    });
  });

  it('omits the User-Agent when none is given (web)', async () => {
    const { fetch, calls } = scriptedFetch(json({}));
    await createHttpClient({ fetch }).getJson(URL_A);
    expect(calls[0].headers).toEqual({ Accept: 'application/json' });
  });

  it('maps 404 to NotFoundError without retrying', async () => {
    const { fetch, calls } = scriptedFetch(new Response('<!DOCTYPE html>', { status: 404 }));
    const error = await failure(createHttpClient({ fetch }).getJson(URL_A));
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ status: 404, url: URL_A });
    expect(calls).toHaveLength(1);
  });

  it('maps other 4xx to HttpError without retrying', async () => {
    const { fetch, calls } = scriptedFetch(new Response('', { status: 400 }));
    const error = await failure(createHttpClient({ fetch }).getJson(URL_A));
    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  it('retries 429 three times with 1 s, 2 s, 4 s backoff, then throws RateLimitedError', async () => {
    const { fetch, calls } = scriptedFetch(...Array.from({ length: 4 }, () => json({}, 429)));
    const result = failure(createHttpClient({ fetch }).getJson(URL_A));
    await jest.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(calls.map((c) => c.at)).toEqual([0, 1000, 3000, 7000]);
  });

  it('retries a 5xx and returns the later success', async () => {
    const { fetch, calls } = scriptedFetch(new Response('', { status: 503 }), json({ ok: true }));
    const result = createHttpClient({ fetch }).getJson(URL_A);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it('throws HttpError with the status after persistent 5xx', async () => {
    const { fetch } = scriptedFetch(...Array.from({ length: 4 }, () => new Response('', { status: 502 })));
    const result = failure(createHttpClient({ fetch }).getJson(URL_A));
    await jest.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(RateLimitedError);
    expect(error.status).toBe(502);
  });

  it('honours a Retry-After longer than the backoff', async () => {
    const { fetch, calls } = scriptedFetch(json({}, 429, { 'Retry-After': '5' }), json({ ok: 1 }));
    const result = createHttpClient({ fetch }).getJson(URL_A);
    await jest.advanceTimersByTimeAsync(4999);
    expect(calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: 1 });
    expect(calls[1].at).toBe(5000);
  });

  it('fails at once when Retry-After is longer than it is willing to wait', async () => {
    const { fetch, calls } = scriptedFetch(json({}, 429, { 'Retry-After': '3600' }));
    const error = await failure(createHttpClient({ fetch }).getJson(URL_A));
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(error.retryAfterMs).toBe(3_600_000);
    expect(calls).toHaveLength(1);
  });

  it('fails at once when giveUp says the limit will not lift soon', async () => {
    const body = { error: { code: 429, message: "Quota exceeded ... limit 'Queries per day'" } };
    const { fetch, calls } = scriptedFetch(json(body, 429));
    const giveUp = jest.fn((status: number, text: string) => text.includes('per day'));
    const error = await failure(createHttpClient({ fetch }).getJson(URL_A, { giveUp }));
    expect(error).toBeInstanceOf(RateLimitedError);
    expect(giveUp).toHaveBeenCalledWith(429, JSON.stringify(body));
    expect(calls).toHaveLength(1);
  });

  it('maps a network failure to OfflineError', async () => {
    const { fetch } = scriptedFetch(new TypeError('Network request failed'));
    const error = await failure(createHttpClient({ fetch }).getJson(URL_A));
    expect(error).toBeInstanceOf(OfflineError);
    expect(error.url).toBe(URL_A);
  });

  it('times out after 10 s with a TimeoutError, which is an OfflineError', async () => {
    const { fetch, calls } = scriptedFetch(hang);
    const result = failure(createHttpClient({ fetch }).getJson(URL_A));
    await jest.advanceTimersByTimeAsync(9999);
    expect(calls[0].signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(OfflineError);
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('cancels an in-flight request when the caller aborts', async () => {
    const { fetch, calls } = scriptedFetch(hang);
    const controller = new AbortController();
    const result = failure(createHttpClient({ fetch }).getJson(URL_A, { signal: controller.signal }));
    await jest.advanceTimersByTimeAsync(100);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('cancels a queued request before it is sent', async () => {
    const { fetch, calls } = scriptedFetch(json({ n: 1 }), json({ n: 3 }));
    const client = createHttpClient({ fetch });
    const controller = new AbortController();
    const first = client.getJson(URL_A);
    const second = failure(client.getJson(`${URL_A}?2`, { signal: controller.signal }));
    const third = client.getJson(`${URL_A}?3`);
    await first;
    controller.abort();
    expect(await second).toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(1000);
    await expect(third).resolves.toEqual({ n: 3 });
    expect(calls.map((c) => c.url)).toEqual([URL_A, `${URL_A}?3`]);
  });

  it('cancels a request waiting to retry', async () => {
    const { fetch, calls } = scriptedFetch(json({}, 503));
    const controller = new AbortController();
    const result = failure(createHttpClient({ fetch }).getJson(URL_A, { signal: controller.signal }));
    await jest.advanceTimersByTimeAsync(500);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);
  });

  it('spaces successive requests to one host through the limiter', async () => {
    const { fetch, calls } = scriptedFetch(json(1), json(2), json(3));
    const client = createHttpClient({ fetch });
    const all = Promise.all([client.getJson(URL_A), client.getJson(URL_A), client.getJson(URL_A)]);
    await jest.advanceTimersByTimeAsync(2000);
    await expect(all).resolves.toEqual([1, 2, 3]);
    expect(calls.map((c) => c.at)).toEqual([0, 1000, 2000]);
  });

  it('reports invalid JSON as an HttpError', async () => {
    const { fetch } = scriptedFetch(new Response('<html>', { status: 200 }));
    await expect(createHttpClient({ fetch }).getJson(URL_A)).rejects.toThrow('Invalid JSON');
  });

  it('downloads bytes with getBinary', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const { fetch, calls } = scriptedFetch(new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }));
    const result = await createHttpClient({ fetch }).getBinary('https://covers.openlibrary.org/b/id/14647238-L.jpg');
    expect(result).toEqual({ bytes, contentType: 'image/jpeg' });
    expect(calls[0].headers.Accept).toBe('image/*,*/*');
  });
});

describe('createHttpClient, while the body arrives', () => {
  // Web streams settle through microtasks and immediates, which must stay real here.
  beforeEach(() => {
    jest.useFakeTimers({ now: 0, doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });

  /** Headers arrive at once (as `fetch` resolves in a browser), then the body stalls until the signal aborts. */
  const stalledBody = (signal: AbortSignal) =>
    Promise.resolve(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"title":'));
            signal.addEventListener('abort', () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              controller.error(error);
            });
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

  it('times out a response whose body stops arriving', async () => {
    const { fetch, calls } = scriptedFetch(stalledBody);
    const result = failure(createHttpClient({ fetch }).getJson(URL_A));
    await jest.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(TimeoutError);
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('cancels a request whose body is still arriving when the caller aborts', async () => {
    const { fetch, calls } = scriptedFetch(stalledBody);
    const controller = new AbortController();
    const result = failure(createHttpClient({ fetch }).getBinary(URL_A, { signal: controller.signal }));
    await jest.advanceTimersByTimeAsync(100);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('maps a connection lost while the body arrives to OfflineError', async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('terminated'));
        },
      }),
      { status: 200 },
    );
    const { fetch } = scriptedFetch(broken);
    const error = await failure(createHttpClient({ fetch }).getBinary(URL_A));
    expect(error).toBeInstanceOf(OfflineError);
  });
});

describe('parseRetryAfter', () => {
  it.each([
    [null, null],
    ['', null],
    ['0', 0],
    ['120', 120_000],
    ['soon', null],
    ['Thu, 01 Jan 1970 00:00:30 GMT', 30_000],
    ['Thu, 01 Jan 1970 00:00:00 GMT', 0],
  ])('%p → %p ms', (value, expected) => {
    expect(parseRetryAfter(value, 0)).toBe(expected);
  });
});
