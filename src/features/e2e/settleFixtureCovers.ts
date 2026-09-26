import { coverAttemptsRepo, type Db } from '@/db';

/**
 * A fixture is a library in a steady state: the cover backfill (P02-16) has
 * already looked for its books' covers. Recording that for every book
 * without a cover keeps the backfill away from fixture books, so journeys
 * and Maestro flows on any fixture never depend on how far the backfill got
 * (a cover appearing mid-assertion) and never ask the network about them.
 * Books added during the run are backfilled as usual.
 */
export async function settleFixtureCovers(db: Db, now = Date.now()): Promise<number> {
  const books = await coverAttemptsRepo.listBooksNeedingCover(db, { now: new Date(now).toISOString(), limit: 100_000 });
  for (const book of books) await coverAttemptsRepo.recordAttempt(db, book.id, 'none', { now });
  return books.length;
}
