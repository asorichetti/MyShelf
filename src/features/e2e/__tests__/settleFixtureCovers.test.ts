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
const DAY = 24 * 60 * 60 * 1000;
const due = (now: number, skipFixtureBooks = true) =>
  coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now).toISOString(), limit: 100, skipFixtureBooks });

describe('settleFixtureCovers', () => {
  it('marks every fixture book without a cover as a fixture book, and only those', async () => {
    await loadFixture(db, 'demo');
    expect((await due(NOW)).map((b) => b.title)).toEqual(['The Farthest Shore']);
    expect(await settleFixtureCovers(db, NOW)).toBe(1);
    expect(await due(NOW)).toEqual([]);
  });

  it('keeps the backfill away from them for good in an E2E build, whatever the clock says', async () => {
    await loadFixture(db, 'demo');
    await settleFixtureCovers(db, NOW);
    // Journeys move the clock on (the backup reminder is 40 days away); a backoff would have run out.
    for (const later of [NOW + 60 * 60 * 1000, NOW + 40 * DAY, NOW + 3650 * DAY]) expect(await due(later)).toEqual([]);
    // It is the E2E build's flag that exempts them, not a date: without it they are ordinary books.
    expect((await due(NOW + 40 * DAY, false)).map((b) => b.title)).toEqual(['The Farthest Shore']);
  });

  it('leaves books added afterwards to the backfill', async () => {
    await loadFixture(db, 'demo');
    await settleFixtureCovers(db, NOW);
    const added = await booksRepo.createBook(db, { title: 'Added during the run', isbn13: '9780552166591' });
    expect((await due(NOW)).map((b) => b.id)).toEqual([added.id]);
    expect((await due(NOW + 40 * DAY)).map((b) => b.id)).toEqual([added.id]);
  });

  it('stops exempting a book once the backfill or the user has searched for it', async () => {
    await loadFixture(db, 'demo');
    await settleFixtureCovers(db, NOW);
    const [book] = await coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(NOW).toISOString(), limit: 1 });
    await coverAttemptsRepo.recordAttempt(db, book.id, 'none', { now: NOW });
    expect((await due(NOW + 40 * DAY)).map((b) => b.id)).toEqual([book.id]);
  });
});
