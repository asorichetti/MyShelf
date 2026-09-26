import { migrations as allMigrations, type Migration } from './migrations';
import type { Db } from './types';

export interface MigrationResult {
  from: number;
  to: number;
  applied: number[];
}

export class MigrationError extends Error {}

function validate(list: readonly Migration[]) {
  list.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version < 1) throw new MigrationError(`Invalid migration version ${m.version}`);
    if (i > 0 && m.version <= list[i - 1].version) {
      throw new MigrationError(`Migrations must have strictly increasing versions (${list[i - 1].version} then ${m.version})`);
    }
  });
}

/** Current schema version (0 for a fresh database). */
export async function getSchemaVersion(db: Db): Promise<number> {
  const table = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  );
  if (!table) return 0;
  const row = await db.get<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations');
  return row?.v ?? 0;
}

/**
 * Brings the database up to the latest schema. Each migration runs in its own
 * transaction together with its schema_migrations row (and PRAGMA
 * user_version), so a failure leaves the database at the last good version.
 * Safe to call on every start.
 */
export async function migrate(db: Db, migrations: readonly Migration[] = allMigrations): Promise<MigrationResult> {
  validate(migrations);
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const from = await getSchemaVersion(db);
  const known = migrations.length ? migrations[migrations.length - 1].version : 0;
  if (from > known) {
    throw new MigrationError(`Database schema v${from} is newer than this app understands (v${known})`);
  }
  const appliedRows = await db.all<{ version: number }>('SELECT version FROM schema_migrations');
  const done = new Set(appliedRows.map((r) => r.version));
  const applied: number[] = [];
  for (const m of migrations) {
    if (done.has(m.version)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.up);
      await tx.run('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
      // Mirror the version in the file header too, so tools (and backups) can read it without a query.
      await tx.exec(`PRAGMA user_version = ${m.version}`);
    });
    applied.push(m.version);
  }
  return { from, to: await getSchemaVersion(db), applied };
}
