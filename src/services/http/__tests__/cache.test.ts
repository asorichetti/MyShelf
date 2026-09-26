/**
 * @jest-environment node
 */
import { apiCacheRepo, type Db } from '@/db';
import { OL_BOOKS, openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createOpenLibrary } from '@/services/metadata/openLibrary';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { createResponseCache, DEFAULT_CACHE_TTL_MS, memoryCacheStore } from '../cache';
import { createHttpClient } from '../client';
import { createRateLimiter } from '../rateLimiter';

const DAY = 24 * 60 * 60 * 1000;

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function setup(now: { t: number }) {
  const fixtures = createFixtureFetch(openLibraryRoutes);
  const clock = { now: () => now.t };
  const http = createHttpClient({
    fetch: fixtures.fetch,
    limiter: createRateLimiter({ minIntervalMs: 0 }),
    cache: createResponseCache(apiCacheRepo.store(db), clock),
  });
  return { fixtures, ol: createOpenLibrary({ http }), http };
}

describe('HTTP response cache backed by api_cache', () => {
  it('answers a second identical lookup with zero network calls', async () => {
    const now = { t: Date.parse('2026-09-26T10:00:00Z') };
    const first = setup(now);
    const [a] = await first.ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(first.fixtures.calls).toHaveLength(3);

    // A new provider (no in-memory author memo) on the same database.
    const second = setup(now);
    const [b] = await second.ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(second.fixtures.calls).toEqual([]);
    expect(b).toEqual(a);
    expect((await apiCacheRepo.stats(db)).entries).toBe(3);
  });

  it('refetches an expired entry and refreshes it', async () => {
    const now = { t: Date.parse('2026-09-01T00:00:00Z') };
    await setup(now).ol.lookupIsbn(OL_BOOKS.theMartian);
    now.t += DEFAULT_CACHE_TTL_MS + DAY;
    const later = setup(now);
    await later.ol.lookupIsbn(OL_BOOKS.theMartian);
    expect(later.fixtures.calls).toHaveLength(3);
    const entry = await apiCacheRepo.getEntry(db, `https://openlibrary.org/isbn/${OL_BOOKS.theMartian}.json`);
    expect(entry?.fetchedAt).toBe(new Date(now.t).toISOString());
  });

  it('does not cache 404s', async () => {
    const now = { t: Date.now() };
    await setup(now).ol.lookupIsbn(OL_BOOKS.unknown);
    const again = setup(now);
    await again.ol.lookupIsbn(OL_BOOKS.unknown);
    expect(again.fixtures.calls).toHaveLength(1);
    expect((await apiCacheRepo.stats(db)).entries).toBe(0);
  });

  it('only caches requests that ask for it', async () => {
    const { http, fixtures } = setup({ t: Date.now() });
    const url = `https://openlibrary.org/works/OL453657W.json`;
    await http.getJson(url);
    await http.getJson(url);
    expect(fixtures.calls).toEqual([url, url]);
    expect(await apiCacheRepo.getEntry(db, url)).toBeNull();
  });

  it('refetches over a corrupt entry', async () => {
    const { http, fixtures } = setup({ t: Date.now() });
    const url = `https://openlibrary.org/works/OL453657W.json`;
    await apiCacheRepo.putEntry(db, url, '{not json', new Date().toISOString());
    const work = await http.getJson<{ title: string }>(url, { cacheTtl: DAY });
    expect(work.title).toBe('The Colour of Magic');
    expect(fixtures.calls).toEqual([url]);
    expect((await apiCacheRepo.getEntry(db, url))?.body).toContain('The Colour of Magic');
  });
});

describe('createResponseCache', () => {
  it('treats storage failures as a miss and keeps going', async () => {
    const broken = {
      get: async () => Promise.reject(new Error('database is locked')),
      put: async () => Promise.reject(new Error('disk full')),
    };
    const cache = createResponseCache(broken);
    await expect(cache.read('u', DAY)).resolves.toBeNull();
    await expect(cache.write('u', 'b')).resolves.toBeUndefined();
  });

  it('ignores entries from the future or with bad timestamps', async () => {
    const store = memoryCacheStore();
    const cache = createResponseCache(store, { now: () => Date.parse('2026-09-01T00:00:00Z') });
    await store.put('future', 'b', '2027-01-01T00:00:00Z');
    await store.put('bad', 'b', 'yesterday');
    await store.put('fresh', 'b', '2026-08-31T00:00:00Z');
    expect(await cache.read('future', DAY * 365)).toBeNull();
    expect(await cache.read('bad', DAY * 365)).toBeNull();
    expect(await cache.read('fresh', 2 * DAY)).toBe('b');
    expect(await cache.read('fresh', DAY)).toBeNull();
  });
});
