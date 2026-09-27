import { pendingLookupsRepo, type Db } from '@/db';

/**
 * Drops an ISBN from the offline queue once its book is saved (P02-10): its
 * details, if they arrived, are no longer waiting. True when it was queued.
 * Never throws.
 */
export async function clearPendingLookup(db: Db, isbn13: string | null | undefined): Promise<boolean> {
  if (!isbn13) return false;
  return pendingLookupsRepo.remove(db, isbn13).catch(() => false);
}
