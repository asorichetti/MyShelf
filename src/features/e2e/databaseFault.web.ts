import { MigrationError, type Db } from '@/db';

import { isE2eEnabled } from './e2eFlag';

let used = false;

/**
 * Web E2E hook (P09-04): loading the app with `?e2e-db-fault=open` or
 * `?e2e-db-fault=migrate` makes the first attempt to open the database fail
 * that way, so a journey can reach the "I couldn't open your library" screen
 * and prove "Try again" recovers. Once per page load; inert unless the E2E
 * loader is on (ADR 0015).
 */
export function withE2eDatabaseFault(open: () => Promise<Db>): () => Promise<Db> {
  return async () => {
    const fault = !used && isE2eEnabled() && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('e2e-db-fault') : null;
    if (fault === 'open' || fault === 'migrate') {
      used = true;
      throw fault === 'migrate' ? new MigrationError('E2E: a simulated migration failure') : new Error('E2E: a simulated failure opening the database');
    }
    return open();
  };
}
