import { File, Paths } from 'expo-file-system';

import { MigrationError, type Db } from '@/db';

import { isE2eEnabled } from './e2eFlag';

/** The marker file a device test writes into the app's files folder (`adb root`, then `echo migrate > …`). */
export const DATABASE_FAULT_MARKER = 'e2e-db-fault';

let used = false;

/**
 * Android E2E hook (P09-04): the database opens before any deep link could
 * ask for a fault, so a device test asks by leaving a marker file,
 * `files/e2e-db-fault`, holding `open` or `migrate`. The next start's first
 * attempt to open the database then fails that way (and deletes the marker),
 * which reaches the recovery screen; "Try again" opens the real, untouched
 * library. Inert unless the build has the E2E loader (ADR 0015). The web
 * build uses `?e2e-db-fault=` instead (databaseFault.web.ts).
 */
export function withE2eDatabaseFault(open: () => Promise<Db>): () => Promise<Db> {
  return async () => {
    if (!used && isE2eEnabled()) {
      used = true;
      const fault = readMarker();
      if (fault === 'open' || fault === 'migrate') {
        throw fault === 'migrate' ? new MigrationError('E2E: a simulated migration failure') : new Error('E2E: a simulated failure opening the database');
      }
    }
    return open();
  };
}

function readMarker(): string | null {
  try {
    const marker = new File(Paths.document, DATABASE_FAULT_MARKER);
    if (!marker.exists) return null;
    const fault = marker.textSync().trim();
    marker.delete();
    return fault;
  } catch {
    return null;
  }
}
