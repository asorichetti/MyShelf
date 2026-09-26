import type { Db } from '@/db';

/**
 * Android and iOS: no database fault injection (the database opens before
 * any deep link could ask for one). See databaseFault.web.ts.
 */
export function withE2eDatabaseFault(open: () => Promise<Db>): () => Promise<Db> {
  return open;
}
