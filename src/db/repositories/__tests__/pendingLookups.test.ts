/**
 * @jest-environment node
 */
import { getSchemaVersion, migrate, migrations, pendingLookupsRepo as repo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { createTestDb } from '@/testing/createTestDb';

const A = '9780552166591';
const B = '9780553418026';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('0003_pending_lookups migration', () => {
  it('upgrades a version 2 database and is idempotent', async () => {
    const old = await openNodeDatabase();
    await migrate(old, migrations.slice(0, 2));
    expect(await getSchemaVersion(old)).toBe(2);
    const result = await migrate(old);
    expect(result.applied).toContain(3);
    expect(await repo.enqueue(old, A)).toBe(true);
    expect((await migrate(old)).applied).toEqual([]);
    expect(await repo.list(old)).toHaveLength(1);
    await old.close();
  });

  it('rejects anything but a 13-character ISBN', async () => {
    await expect(repo.enqueue(db, '0552166596')).rejects.toThrow(/CHECK/);
  });
});

describe('pending lookups repository', () => {
  it('queues an ISBN once, never twice', async () => {
    expect(await repo.enqueue(db, A)).toBe(true);
    expect(await repo.enqueue(db, A)).toBe(false);
    const all = await repo.list(db);
    expect(all).toEqual([{ isbn13: A, requestedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), attempts: 0, lastError: null }]);
  });

  it('lists oldest first', async () => {
    await repo.enqueue(db, B);
    await db.run("UPDATE pending_lookups SET requested_at = '2026-01-01T00:00:00.000Z' WHERE isbn13 = ?", [B]);
    await repo.enqueue(db, A);
    expect((await repo.list(db)).map((p) => p.isbn13)).toEqual([B, A]);
  });

  it('counts failures up to the cap of five and then stops retrying', async () => {
    await repo.enqueue(db, A);
    for (let i = 1; i <= 6; i++) {
      const row = await repo.recordFailure(db, A, `HTTP 503 (${i})`);
      expect(row?.attempts).toBe(Math.min(i, repo.MAX_LOOKUP_ATTEMPTS));
    }
    expect(await repo.get(db, A)).toMatchObject({ attempts: 5, lastError: 'HTTP 503 (6)' });
    expect(await repo.listDue(db)).toEqual([]);
    expect((await repo.listFailed(db)).map((p) => p.isbn13)).toEqual([A]);
    expect(await repo.countDue(db)).toBe(0);
  });

  it('gives up at once with markFailed, and can be reset for another go', async () => {
    await repo.enqueue(db, A);
    await repo.enqueue(db, B);
    await repo.markFailed(db, A, 'not-found');
    expect((await repo.listDue(db)).map((p) => p.isbn13)).toEqual([B]);
    expect(await repo.countDue(db)).toBe(1);
    expect(await repo.resetAttempts(db, A)).toBe(true);
    expect(await repo.get(db, A)).toMatchObject({ attempts: 0, lastError: null });
    expect(await repo.countDue(db)).toBe(2);
  });

  it('removes a lookup', async () => {
    await repo.enqueue(db, A);
    expect(await repo.remove(db, A)).toBe(true);
    expect(await repo.remove(db, A)).toBe(false);
    expect(await repo.get(db, A)).toBeNull();
    expect(await repo.recordFailure(db, A, 'x')).toBeNull();
  });
});
