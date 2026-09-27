import { useState } from 'react';

import { NoDatabaseFileError, readDatabaseFile } from '@/db/databaseFile';
import { useMounted } from '@/hooks/useMounted';
import { t } from '@/i18n';
import { SQLITE_MIME } from '@/services/backup/fileTypes';
import { shareBinaryFile } from '@/services/backup/shareFile';

export type DatabaseExportStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; fileName: string; how: 'shared' | 'downloaded' }
  | { kind: 'error'; message: string };

/** `myshelf-library-YYYY-MM-DD.db`, dated in local time. */
export function databaseFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `myshelf-library-${y}-${m}-${d}.db`;
}

/**
 * "Save a copy of the library file" on the recovery screen (P09-04): reads
 * the raw database file and opens the share sheet with it (a download on the
 * web), so a library the app cannot open can still be kept safe or sent for
 * help. Nothing leaves the device unless the user sends it.
 */
export function useDatabaseFileExport(now: () => Date = () => new Date()) {
  const [status, setStatus] = useState<DatabaseExportStatus>({ kind: 'idle' });
  const mounted = useMounted();

  const save = async () => {
    setStatus({ kind: 'busy' });
    let next: DatabaseExportStatus;
    try {
      const bytes = await readDatabaseFile();
      const fileName = databaseFileName(now());
      const outcome = await shareBinaryFile({ fileName, mimeType: SQLITE_MIME, bytes, dialogTitle: t('navigation.databaseError.shareDialogTitle') });
      next = outcome === 'unavailable' ? { kind: 'error', message: t('navigation.databaseError.cantShare') } : { kind: 'done', fileName, how: outcome };
    } catch (e) {
      if (e instanceof NoDatabaseFileError) {
        next = { kind: 'error', message: t('navigation.databaseError.noFile') };
      } else {
        console.error('Could not save a copy of the database file', e);
        next = { kind: 'error', message: t('navigation.databaseError.exportFailed') };
      }
    }
    if (mounted.current) setStatus(next);
  };

  return { status, save };
}
