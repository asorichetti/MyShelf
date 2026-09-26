import type { FetchLike } from '@/services/http';

/** A canned response: JSON `body`, raw `text`, binary `bytes` (an image), or a status alone. */
export interface FixtureResponse {
  status?: number;
  body?: unknown;
  text?: string;
  /** Sent as `image/jpeg` unless `headers` says otherwise. */
  bytes?: Uint8Array;
  headers?: Record<string, string>;
}

export type FixtureRoutes = Record<string, FixtureResponse | (() => FixtureResponse)>;

export interface FixtureFetch {
  fetch: FetchLike;
  /** Every URL requested, in order. */
  calls: string[];
  /** Requests with no route; they get a 501 so the test fails loudly rather than touching the network. */
  unmocked: string[];
}

/** A `fetch` that answers from recorded fixtures by exact URL. Never touches the network. */
export function createFixtureFetch(...tables: FixtureRoutes[]): FixtureFetch {
  const routes: FixtureRoutes = Object.assign({}, ...tables);
  const calls: string[] = [];
  const unmocked: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    if (init.signal.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    calls.push(url);
    const route = routes[url];
    if (!route) {
      unmocked.push(url);
      return new Response(`unmocked: ${url}`, { status: 501 });
    }
    const r = typeof route === 'function' ? route() : route;
    if (r.bytes) {
      return new Response(r.bytes as BodyInit, { status: r.status ?? 200, headers: { 'Content-Type': 'image/jpeg', ...r.headers } });
    }
    const text = r.text ?? (r.body === undefined ? '' : JSON.stringify(r.body));
    const type = r.body === undefined ? 'text/html' : 'application/json';
    return new Response(r.status === 204 ? null : text, { status: r.status ?? 200, headers: { 'Content-Type': type, ...r.headers } });
  };
  return { fetch, calls, unmocked };
}
