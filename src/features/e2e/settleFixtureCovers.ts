import { coverAttemptsRepo, type Db } from '@/db';

/**
 * A fixture is a library in a steady state: the cover backfill (P02-16) has
 * already looked for its books' covers. Marking every book without a cover
 * as a fixture book keeps the backfill away from it for good in E2E builds
 * (`backfillCoversNow` passes `skipFixtureBooks` when `isE2eEnabled()`), not
 * just for a backoff a journey can outrun by moving the clock (the backup
 * reminder is 40 days on). So journeys and Maestro flows on any fixture never
 * depend on how far the backfill got (a cover appearing mid-assertion) and
 * never ask the network about them. Books added or restored during the run
 * are backfilled as usual.
 */
export async function settleFixtureCovers(db: Db, now = Date.now()): Promise<number> {
  const books = await coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now).toISOString(), limit: 100_000 });
  for (const book of books) await coverAttemptsRepo.markFixtureBook(db, book.id, now);
  return books.length;
}
