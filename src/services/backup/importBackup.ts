import { backupRepo, LATEST_VERSION, type Db, type MergeSummary, type SnapshotInfo } from '@/db';
import type { BackupFile, BackupTableName, BackupTables } from '@/domain';

import { exportBackup, serializeBackup } from './exportBackup';
import { BackupError, parseBackup } from './validateBackup';

export type RestoreMode = 'replace' | 'merge';

export interface RestoreOptions {
  mode: RestoreMode;
  /**
   * Opens an empty in-memory database, used to bring a backup from an older
   * schema up to date with the real migrations. Needed only for such backups.
   */
  openScratch?: () => Promise<Db>;
  /** For the safety copy's metadata. */
  appVersion?: string;
  now?: () => Date;
}

export interface RestoreResult {
  mode: RestoreMode;
  /** Rows per table in the backup (after bringing it up to date). */
  counts: Record<BackupTableName, number>;
  /** Merge only: what was added and skipped. */
  merge?: MergeSummary;
  /** Replace only: the automatic copy of the library as it was, for "Undo restore". */
  safetyCopy?: SnapshotInfo;
  /** The backup came from an older schema and was brought forward. */
  upgradedFrom?: number;
}

/** Brings a validated backup's tables to the current schema (running the migrations in a scratch database when it is older). */
export async function currentTables(backup: BackupFile, openScratch?: () => Promise<Db>): Promise<BackupTables> {
  if (backup.schemaVersion === LATEST_VERSION) return backup.tables;
  if (backup.schemaVersion > LATEST_VERSION) {
    throw new BackupError('newer-version', 'This backup was made by a newer version of MyShelf. Update the app, then try again.');
  }
  if (!openScratch) throw new Error('Restoring an older backup needs a scratch database');
  return backupRepo.upgradeTables(backup.tables, backup.schemaVersion, openScratch);
}

function friendlyDbError(error: unknown): BackupError {
  const detail = error instanceof Error ? error.message : String(error);
  const what = /UNIQUE/i.test(detail)
    ? 'two records clash'
    : /CHECK|NOT NULL/i.test(detail)
      ? 'a record has a value MyShelf can’t accept'
      : /FOREIGN KEY/i.test(detail)
        ? 'a link points at something missing'
        : 'something in it couldn’t be saved';
  return new BackupError('bad-row', `This backup looks damaged: ${what}. Nothing was changed.`);
}

/**
 * Restores a validated backup (P08-03). **Replace** swaps the whole library
 * for the backup's, keeping every id, after saving the current library as a
 * safety copy (both in the same transaction). **Merge** adds the backup's
 * books that are not on the shelf yet. Either way it is one transaction: on
 * any failure nothing changes, and the error is a friendly `BackupError`.
 */
export async function restoreBackup(db: Db, backup: BackupFile, options: RestoreOptions): Promise<RestoreResult> {
  const { mode, openScratch, appVersion = 'unknown', now = () => new Date() } = options;
  const tables = await currentTables(backup, openScratch);
  const counts = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows?.length ?? 0])) as Record<BackupTableName, number>;
  const upgradedFrom = backup.schemaVersion < LATEST_VERSION ? backup.schemaVersion : undefined;

  if (mode === 'merge') {
    try {
      const merge = await db.transaction((tx) => backupRepo.mergeTables(tx, tables));
      return { mode, counts, merge, upgradedFrom };
    } catch (error) {
      throw friendlyDbError(error);
    }
  }

  try {
    const safetyCopy = await db.transaction(async (tx) => {
      const before = await exportBackup(tx, { appVersion, now, keepDeviceCovers: true });
      const info = await backupRepo.saveSnapshot(tx, {
        body: serializeBackup(before),
        bookCount: before.tables.books?.length ?? 0,
        createdAt: now().toISOString(),
      });
      await backupRepo.replaceAllTables(tx, tables);
      return info;
    });
    return { mode, counts, safetyCopy, upgradedFrom };
  } catch (error) {
    throw friendlyDbError(error);
  }
}

/**
 * "Undo restore": puts the library back as it was before the last Replace,
 * from the safety copy. The copy is then removed. Returns false when there
 * is no copy with that id (already undone, or erased).
 */
export async function undoRestore(db: Db, snapshotId: number, { openScratch }: { openScratch?: () => Promise<Db> } = {}): Promise<boolean> {
  const snapshot = await backupRepo.getSnapshot(db, snapshotId);
  if (!snapshot) return false;
  const backup = parseBackup(snapshot.body, { currentSchemaVersion: LATEST_VERSION });
  const tables = await currentTables(backup, openScratch);
  await db.transaction(async (tx) => {
    await backupRepo.replaceAllTables(tx, tables);
    await backupRepo.deleteSnapshots(tx);
  });
  return true;
}
