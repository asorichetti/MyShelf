import type { Db } from '@/db';
import { openExpoDatabase } from '@/db/expo';


/**
 * An empty in-memory database, for bringing a backup from an older version
 * of the app up to date with the real migrations before it is restored.
 */
export function openScratchDatabase(): Promise<Db> {
  return openExpoDatabase(':memory:');
}
