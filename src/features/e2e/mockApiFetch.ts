/**
 * The Android E2E build's stand-in for Open Library, Google Books and their
 * cover hosts (docs/device-testing.md, "Recorded API responses"): a `fetch`
 * that answers from the recorded fixtures the web auto test suite serves with
 * --mock-api (src/services/metadata/__fixtures__/index.json), bundled by
 * `npm run e2eapi:gen` into src/generated/e2eApiFixtures.json.
 *
 * Pure (no app imports), so the auto test suite's own tests can check it
 * answers exactly as the web mock does (tools/auto-test-suite/src/mockapi/native.test.ts).
 */

/** The hosts answered from the routes, and only from them. */
export const MOCKED_HOSTS = ['openlibrary.org', 'www.googleapis.com'] as const;
/** Cover hosts: a route when there is one, else the synthetic test covers. */
export const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com'] as const;

/** One recorded response, as `npm run e2eapi:gen` writes it. */
export interface MockApiRoute {
  /** The canonical URL (`canonicalUrl`), or a pattern with `*` when `glob` is set. */
  url: string;
  glob?: boolean;
  status: number;
  contentType: string;
  /** A deliberate error response (a 404 for an unknown ISBN). */
  expected?: boolean;
  /** The body as text (JSON is minified), or… */
  text?: string;
  /** …as base64 (an image). */
  base64?: string;
}

/** The generated fixture bundle (src/generated/e2eApiFixtures.json). */
export interface MockApiBundle {
  marker: string;
  routes: MockApiRoute[];
  covers: {
    /** base64 JPEGs: the plain 2:3 test cover and the padded square scan. */
    cover: string;
    padded: string;
    /** base64 GIF: Open Library's 1x1 "no cover" answer. */
    noCover: string;
    paddedIds: string[];
    /** URLs carrying it are deliberately missing covers. */
    expectedMissingMarker: string;
  };
}

type Fetch = (url: string, init: { signal: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;

export interface MockApiFetchOptions {
  /** True while the E2E network switch says the phone is offline: every request fails as with no network. */
  offline?: () => boolean;
  /** Told about each request no route answers (it then fails, as on web). */
  onUnmocked?: (url: string) => void;
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A URL with its query parameters decoded, sorted and re-encoded, so the
 * app's `withQuery` URLs match the index's whatever their order or escaping.
 * The same result as the web mock's `canonicalUrl` (which uses `URL`, not
 * dependable in React Native), for the http(s) URLs the app requests.
 */
export function canonicalUrl(raw: string): string {
  const m = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/i.exec(raw);
  if (!m) return raw;
  const [, protocol, authority, path, query = ''] = m;
  const scheme = protocol.toLowerCase();
  let host = authority.toLowerCase();
  if ((scheme === 'https:' && host.endsWith(':443')) || (scheme === 'http:' && host.endsWith(':80'))) host = host.replace(/:\d+$/, '');
  const params = query
    .split('&')
    .filter(Boolean)
    .map((pair): [string, string] => {
      const i = pair.indexOf('=');
      return i < 0 ? [decode(pair), ''] : [decode(pair.slice(0, i)), decode(pair.slice(i + 1))];
    })
    .sort(([a, av], [b, bv]) => (a === b ? compare(av, bv) : compare(a, b)));
  const q = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${scheme}//${host}${path || '/'}${q ? `?${q}` : ''}`;
}

/** `*` matches any characters; everything else literally (as the web mock's patterns). */
export function globToRegExp(glob: string): RegExp {
  return new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
}

function hostOf(url: string): string {
  return (/^[a-z]+:\/\/([^/?#]+)/i.exec(url)?.[1] ?? '').toLowerCase();
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 → bytes, without `atob` or `Buffer` (neither is certain in every runtime). */
export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let n = 0;
  for (const ch of clean) {
    value = (value << 6) | BASE64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (value >> bits) & 0xff;
    }
  }
  return n === out.length ? out : out.slice(0, n);
}

function networkFailure(url: string): TypeError {
  // React Native's fetch rejects this way when there is no network; the HTTP client makes it an OfflineError.
  return new TypeError(`Network request failed (${url})`);
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * A `fetch` answering from the bundle, never from the network: mocked hosts
 * from their routes (exact URL, then patterns), cover hosts from a route or
 * the test covers (as the web suite's covers.ts does), and anything else
 * refused as unmocked, like the web mock's `network/unmocked` rule, so a gap
 * in the fixtures shows instead of quietly going online.
 */
export function createMockApiFetch(bundle: MockApiBundle, options: MockApiFetchOptions = {}): Fetch {
  const exact = new Map<string, MockApiRoute>();
  const patterns: { re: RegExp; route: MockApiRoute }[] = [];
  for (const route of bundle.routes) {
    if (route.glob) patterns.push({ re: globToRegExp(route.url), route });
    else exact.set(route.url, route);
  }
  const images = new Map<string, Uint8Array>();
  const image = (key: 'cover' | 'padded' | 'noCover') => {
    let bytes = images.get(key);
    if (!bytes) images.set(key, (bytes = fromBase64(bundle.covers[key])));
    return bytes;
  };

  const match = (url: string): MockApiRoute | undefined => {
    const canon = canonicalUrl(url);
    return exact.get(canon) ?? patterns.find(({ re }) => re.test(url) || re.test(canon))?.route;
  };

  const answer = (route: MockApiRoute): Response => {
    const headers = { 'Content-Type': route.contentType };
    if (route.status === 204) return new Response(null, { status: 204, headers });
    const body = route.base64 !== undefined ? fromBase64(route.base64).buffer : (route.text ?? '');
    return new Response(body as BodyInit, { status: route.status, headers });
  };

  const cover = (url: string): Response => {
    if (url.includes(bundle.covers.expectedMissingMarker)) {
      return /[?&]default=false\b/.test(url)
        ? new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
        : new Response(image('noCover').slice().buffer as BodyInit, { status: 200, headers: { 'Content-Type': 'image/gif' } });
    }
    const id = /\/b\/id\/(\d+)-/.exec(url)?.[1];
    const bytes = id && bundle.covers.paddedIds.includes(id) ? image('padded') : image('cover');
    // A copy per response: whoever reads it cannot change the next one.
    return new Response(bytes.slice().buffer as BodyInit, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  };

  return async (url, init) => {
    if (init.signal.aborted) throw abortError();
    if (options.offline?.()) throw networkFailure(url);
    const host = hostOf(url);
    if ((COVER_HOSTS as readonly string[]).includes(host)) {
      const route = match(url);
      return route ? answer(route) : cover(url);
    }
    const route = (MOCKED_HOSTS as readonly string[]).includes(host) ? match(url) : undefined;
    if (route) return answer(route);
    options.onUnmocked?.(url);
    throw new TypeError(`e2e mock API: no recorded response for ${url}`);
  };
}
