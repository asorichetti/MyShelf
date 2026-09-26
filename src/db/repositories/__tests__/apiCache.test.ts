/**
 * @jest-environment node
 */
import { apiCacheRepo, getSchemaVersion, migrate, migrations, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

describe('0002_api_cache migration', () => {
  it('creates the table on a fresh database and is idempotent', async () => {
    const fresh = await openNodeDatabase();
    await migrate(fresh);
    expect(await getSchemaVersion(fresh)).toBeGreaterThanOrEqual(2);
    expect(await fresh.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'api_cache'")).toEqual({ name: 'api_cache' });
    expect((await migrate(fresh)).applied).toEqual([]);
    await fresh.close();
  });

  it('upgrades a version 1 database and keeps its books', async () => {
    const old = await openNodeDatabase();
    await migrate(old, migrations.slice(0, 1));
    await old.run("INSERT INTO books (title) VALUES ('Kept')");
    const result = await migrate(old);
    expect(result.from).toBe(1);
    expect(result.applied).toContain(2);
    expect(await old.get('SELECT title FROM books')).toEqual({ title: 'Kept' });
    await apiCacheRepo.putEntry(old, 'https://x.test/a', '{}');
    expect(await apiCacheRepo.getEntry(old, 'https://x.test/a')).toMatchObject({ body: '{}' });
    await old.close();
  });
});

describe('api cache repository', () => {
  it('stores, reads, overwrites and deletes entries', async () => {
    expect(await apiCacheRepo.getEntry(db, 'https://openlibrary.org/isbn/1.json')).toBeNull();
    await apiCacheRepo.putEntry(db, 'https://openlibrary.org/isbn/1.json', '{"a":1}', '2026-09-01T00:00:00.000Z');
    expect(await apiCacheRepo.getEntry(db, 'https://openlibrary.org/isbn/1.json')).toEqual({
      url: 'https://openlibrary.org/isbn/1.json',
      body: '{"a":1}',
      fetchedAt: '2026-09-01T00:00:00.000Z',
    });
    await apiCacheRepo.putEntry(db, 'https://openlibrary.org/isbn/1.json', '{"a":2}', '2026-09-02T00:00:00.000Z');
    expect(await apiCacheRepo.getEntry(db, 'https://openlibrary.org/isbn/1.json')).toMatchObject({ body: '{"a":2}', fetchedAt: '2026-09-02T00:00:00.000Z' });
    expect(await apiCacheRepo.stats(db)).toEqual({ entries: 1, bytes: 'https://openlibrary.org/isbn/1.json'.length + 7 });
    expect(await apiCacheRepo.deleteEntry(db, 'https://openlibrary.org/isbn/1.json')).toBe(true);
    expect(await apiCacheRepo.deleteEntry(db, 'https://openlibrary.org/isbn/1.json')).toBe(false);
  });

  it('stamps entries with the current time by default', async () => {
    await apiCacheRepo.putEntry(db, 'u', 'b');
    const entry = await apiCacheRepo.getEntry(db, 'u');
    expect(Date.now() - Date.parse(entry!.fetchedAt)).toBeLessThan(60_000);
  });

  it('counts bytes, not characters', async () => {
    await apiCacheRepo.putEntry(db, 'u', 'ñ', '2026-09-01T00:00:00.000Z');
    expect(await apiCacheRepo.stats(db)).toEqual({ entries: 1, bytes: 1 + 2 });
  });

  it('prunes entries older than 30 days', async () => {
    const now = at('2026-09-30T12:00:00.000Z');
    await apiCacheRepo.putEntry(db, 'old', 'x', new Date(now.getTime() - 31 * DAY).toISOString());
    await apiCacheRepo.putEntry(db, 'edge', 'x', new Date(now.getTime() - 30 * DAY + 1000).toISOString());
    await apiCacheRepo.putEntry(db, 'new', 'x', new Date(now.getTime() - DAY).toISOString());
    expect(await apiCacheRepo.prune(db, { now })).toEqual({ expired: 1, evicted: 0 });
    const left = await db.all<{ url: string }>('SELECT url FROM api_cache ORDER BY url');
    expect(left.map((r) => r.url)).toEqual(['edge', 'new']);
  });

  it('caps the table size by evicting the oldest entries first', async () => {
    const now = at('2026-09-30T00:00:00.000Z');
    const body = 'x'.repeat(99); // 1-character URL + 99 bytes = 100 bytes a row
    for (let i = 0; i < 5; i++) {
      await apiCacheRepo.putEntry(db, String(i), body, new Date(now.getTime() - (5 - i) * 1000).toISOString());
    }
    expect(await apiCacheRepo.prune(db, { now, maxBytes: 250 })).toEqual({ expired: 0, evicted: 3 });
    const left = await db.all<{ url: string }>('SELECT url FROM api_cache ORDER BY url');
    expect(left.map((r) => r.url)).toEqual(['3', '4']);
    expect((await apiCacheRepo.stats(db)).bytes).toBeLessThanOrEqual(250);
  });

  it('prunes to the real 5 MB default', async () => {
    const now = new Date();
    const big = 'y'.repeat(1024 * 1024);
    for (let i = 0; i < 6; i++) await apiCacheRepo.putEntry(db, `u${i}`, big, new Date(now.getTime() - (6 - i) * 1000).toISOString());
    const { evicted } = await apiCacheRepo.prune(db, { now });
    expect(evicted).toBe(2);
    expect((await apiCacheRepo.stats(db)).bytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(await apiCacheRepo.getEntry(db, 'u5')).not.toBeNull();
  });

  it('clears everything', async () => {
    await apiCacheRepo.putEntry(db, 'a', '1');
    await apiCacheRepo.putEntry(db, 'b', '2');
    expect(await apiCacheRepo.clear(db)).toBe(2);
    expect(await apiCacheRepo.stats(db)).toEqual({ entries: 0, bytes: 0 });
  });

  it('exposes a store for the HTTP response cache', async () => {
    const store = apiCacheRepo.store(db);
    await store.put('u', 'b', '2026-09-01T00:00:00.000Z');
    expect(await store.get('u')).toEqual({ url: 'u', body: 'b', fetchedAt: '2026-09-01T00:00:00.000Z' });
  });
});
