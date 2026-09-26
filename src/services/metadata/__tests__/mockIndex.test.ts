/**
 * @jest-environment node
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FixtureResponse } from '@/testing/fixtureFetch';

import { googleBooksRoutes } from '../__fixtures__/googleBooksRoutes';
import { openLibraryRoutes } from '../__fixtures__/openLibraryRoutes';


/**
 * The auto test suite serves the same recordings from `__fixtures__/index.json`
 * (`--mock-api`, P02-13). Jest and the journeys must agree on what each URL
 * returns, so every Jest route is in the index with the same status and body.
 */
const dir = join(__dirname, '..', '__fixtures__');
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as {
  routes: { url: string; status?: number; body?: string; expected?: boolean }[];
};

const byUrl = new Map(index.routes.map((r) => [r.url, r]));

describe('the mock API index', () => {
  const tables: [string, Record<string, FixtureResponse | (() => FixtureResponse)>][] = [
    ['Open Library', openLibraryRoutes],
    ['Google Books', googleBooksRoutes],
  ];
  for (const [name, table] of tables) {
    it(`serves every ${name} Jest fixture with the same status and body`, () => {
      for (const [url, route] of Object.entries(table)) {
        const r = typeof route === 'function' ? route() : route;
        const entry = byUrl.get(url);
        expect({ url, indexed: Boolean(entry) }).toEqual({ url, indexed: true });
        expect({ url, status: entry!.status ?? 200 }).toEqual({ url, status: r.status ?? 200 });
        const text = readFileSync(join(dir, entry!.body!), 'utf8');
        if (r.body !== undefined) expect(JSON.parse(text)).toEqual(r.body);
        else expect(text).toBe(r.text);
      }
    });
  }

  it('points only at files that exist, and marks every error response as expected', () => {
    for (const r of index.routes) {
      if (r.body) expect({ url: r.url, exists: existsSync(join(dir, r.body)) }).toEqual({ url: r.url, exists: true });
      if ((r.status ?? 200) >= 400) expect({ url: r.url, expected: r.expected }).toEqual({ url: r.url, expected: true });
    }
    expect(new Set(index.routes.map((r) => r.url)).size).toBe(index.routes.length);
  });
});
