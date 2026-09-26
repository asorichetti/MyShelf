import { backupRepo, getSchemaVersion, type Db } from '@/db';
import { BACKUP_COVERS_NOTE, BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupFile, type BackupTableName } from '@/domain';

export interface ExportBackupOptions {
  appVersion: string;
  /** Injectable clock for tests. */
  now?: () => Date;
  /** Keep covers stored on this phone (`file://`) as they are. Only the safety copy before a restore does this. */
  keepDeviceCovers?: boolean;
}

/**
 * The whole library as a backup document (P08-02): every table except
 * derived data, with the schema version, so it can be restored here or on
 * another phone (see `src/domain/backup.ts` for the format and covers).
 */
export async function exportBackup(db: Db, { appVersion, now = () => new Date(), keepDeviceCovers = false }: ExportBackupOptions): Promise<BackupFile> {
  // One transaction, so the snapshot is consistent even if something writes meanwhile.
  return db.transaction(async (tx) => {
    const tables = await backupRepo.dumpTables(tx, { stripDeviceCovers: !keepDeviceCovers });
    const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])) as Record<BackupTableName, number>;
    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: await getSchemaVersion(tx),
      appVersion,
      exportedAt: now().toISOString(),
      covers: BACKUP_COVERS_NOTE,
      counts,
      tables,
    };
  });
}

/** The file's text: readable JSON (two-space indent) ending in a newline. */
export function serializeBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}
