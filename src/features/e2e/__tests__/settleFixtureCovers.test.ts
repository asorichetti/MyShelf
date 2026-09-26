/**
 * @jest-environment node
 */
import { booksRepo, coverAttemptsRepo, type Db } from '@/db';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

import { settleFixtureCovers } from '../settleFixtureCovers';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const NOW = Date.parse('2026-09-26T12:00:00Z');
const due = (now: number) => coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now).toISOString(), limit: 100 });

describe('settleFixtureCovers', () => {
  it('marks every fixture book without a cover as already searched, and only those', async () => {
    await loadFixture(db, 'demo');
    expect((await due(NOW)).map((b) => b.title)).toEqual(['The Farthest Shore']);
    expect(await settleFixtureCovers(db, NOW)).toBe(1);
    expect(await due(NOW)).toEqual([]);
    // An hour into a run the backfill still leaves them alone.
    expect(await due(NOW + 60 * 60 * 1000)).toEqual([]);
  });

  it('leaves books added afterwards to the backfill', async () => {
    await loadFixture(db, 'demo');
    await settleFixtureCovers(db, NOW);
    const added = await booksRepo.createBook(db, { title: 'Added during the run', isbn13: '9780552166591' });
    expect((await due(NOW)).map((b) => b.id)).toEqual([added.id]);
  });
});
