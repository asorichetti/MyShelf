// API mocking (P02-13): recorded Open Library and Google Books responses,
// served from a fixture directory through Playwright routing so journeys are
// deterministic and never touch the real APIs. This file is the pure part:
// loading and validating a fixture index and matching URLs against it. The
// Playwright wiring is in route.ts.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The hosts whose requests are answered from the index (and only from it). */
export const MockedHosts = ['openlibrary.org', 'www.googleapis.com'] as const;

/** Covers are answered by the generated test JPEGs (browser/covers.ts) unless the index has an entry. */
export const CoversHost = 'covers.openlibrary.org';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** The fixture directory journeys use when --mock-api is not given. */
export const DefaultMockDir = join(repoRoot, 'src/services/metadata/__fixtures__');

/** One line of index.json, as written. */
export interface IndexEntry {
  /** The URL, exactly or as a pattern with `*` (any characters). */
  url: string;
  /** Default 200. */
  status?: number;
  /** Default from the body file's extension (json, html, jpg, png, txt). */
  contentType?: string;
  /** Body file, relative to the index. Omit for an empty body. */
  body?: string;
  /**
   * A deliberate error response (a 404 for an unknown ISBN, a 500 for the
   * partial-failure journey). The network and console gates skip it; any
   * other status >= 400 still fails them.
   */
  expected?: boolean;
  /** Free text for the reader: what the fixture is. */
  note?: string;
}

/** A loaded route: the entry plus its body bytes. */
export interface MockRoute {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
  expected: boolean;
  /** Compiled from `url` when it contains `*`. */
  pattern: RegExp | null;
}

/** A loaded fixture index. */
export interface MockIndex {
  dir: string;
  routes: MockRoute[];
}

const contentTypes: Record<string, string> = {
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const entryKeys = new Set(['url', 'status', 'contentType', 'body', 'expected', 'note']);

/**
 * A URL with its query parameters sorted, so `?a=1&b=2` and `?b=2&a=1` match
 * and percent-encoding differences (`%20` vs `+` aside) do not matter.
 */
export function canonicalUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  const params = [...u.searchParams.entries()].sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : av > bv ? 1 : 0) : a < b ? -1 : 1));
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${u.protocol}//${u.host}${u.pathname}${query ? `?${query}` : ''}`;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** Parses and validates index.json in `dir`, reading every body file. Throws with the entry at fault. */
export function loadMockIndex(dir: string): MockIndex {
  const abs = resolve(dir);
  const file = join(abs, 'index.json');
  if (!existsSync(file)) throw new Error(`--mock-api ${dir}: no index.json in ${abs}`);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`--mock-api: ${file} is not valid JSON: ${(err as Error).message}`);
  }
  const list = (raw as { routes?: unknown })?.routes;
  if (!Array.isArray(list)) throw new Error(`--mock-api: ${file} must be an object with a "routes" array`);
  const seen = new Set<string>();
  const routes = list.map((item, i): MockRoute => {
    const where = `${file} routes[${i}]`;
    if (!item || typeof item !== 'object') throw new Error(`${where}: not an object`);
    const e = item as IndexEntry;
    for (const k of Object.keys(e)) if (!entryKeys.has(k)) throw new Error(`${where}: unknown field "${k}"`);
    if (typeof e.url !== 'string' || !/^https:\/\//.test(e.url)) throw new Error(`${where}: "url" must be an https URL`);
    const host = new URL(e.url.replace(/\*/g, 'x')).host;
    if (![...MockedHosts, CoversHost].includes(host as never)) {
      throw new Error(`${where}: ${host} is not a mocked host (${[...MockedHosts, CoversHost].join(', ')})`);
    }
    const status = e.status ?? 200;
    if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error(`${where}: bad status ${String(e.status)}`);
    if (status >= 400 && !e.expected) {
      throw new Error(`${where}: status ${status} needs "expected": true (a deliberate error response), or the gates would fail every journey that hits it`);
    }
    if (e.expected !== undefined && typeof e.expected !== 'boolean') throw new Error(`${where}: "expected" must be a boolean`);
    let body = Buffer.alloc(0);
    let contentType = e.contentType ?? 'text/plain; charset=utf-8';
    if (e.body !== undefined) {
      if (typeof e.body !== 'string' || isAbsolute(e.body) || e.body.includes('..')) throw new Error(`${where}: "body" must be a path inside the fixture directory`);
      const path = join(abs, e.body);
      if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${where}: body file ${e.body} does not exist`);
      body = readFileSync(path);
      const ext = extname(path).toLowerCase();
      if (!e.contentType) {
        const t = contentTypes[ext];
        if (!t) throw new Error(`${where}: cannot tell the content type of ${e.body}; set "contentType"`);
        contentType = t;
      }
      if (ext === '.json') {
        try {
          JSON.parse(body.toString('utf8'));
        } catch (err) {
          throw new Error(`${where}: ${e.body} is not valid JSON: ${(err as Error).message}`);
        }
      }
    }
    const key = e.url.includes('*') ? e.url : canonicalUrl(e.url);
    if (seen.has(key)) throw new Error(`${where}: duplicate url ${e.url}`);
    seen.add(key);
    return { url: key, status, contentType, body, expected: e.expected === true, pattern: e.url.includes('*') ? globToRegExp(e.url) : null };
  });
  return { dir: abs, routes };
}

/** The route answering `url`: an exact match first, then the first pattern that matches. */
export function matchRoute(index: MockIndex, url: string): MockRoute | undefined {
  const canon = canonicalUrl(url);
  return index.routes.find((r) => !r.pattern && r.url === canon) ?? index.routes.find((r) => r.pattern?.test(url) || r.pattern?.test(canon));
}

/** How a request leaving the page's origin is handled. */
export type Disposition = 'same-origin' | 'mocked-host' | 'covers' | 'external';

/** Classifies a request URL against the base URL the suite is testing. */
export function classify(url: string, baseOrigin: string): Disposition {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'same-origin'; // data:, blob: and the like never leave the page
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'same-origin';
  if (u.origin === baseOrigin) return 'same-origin';
  if (u.host === CoversHost) return 'covers';
  if ((MockedHosts as readonly string[]).includes(u.host)) return 'mocked-host';
  return 'external';
}

/**
 * Resolves the --mock-api flag: `off` disables mocking, an empty value means
 * the default fixture directory, anything else is a directory holding
 * index.json (relative to the current directory).
 */
export function resolveMockApiFlag(value: string): MockIndex | null {
  const v = value.trim();
  if (v.toLowerCase() === 'off') return null;
  return loadMockIndex(v === '' ? DefaultMockDir : v);
}
