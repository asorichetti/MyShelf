import {
  backupTables,
  backupTablesAt,
  backupTableSpec,
  deviceSettingKeys,
  isDeviceCoverUri,
  normaliseText,
  type BackupRow,
  type BackupTableName,
  type BackupTables,
  type BackupTableSpec,
} from '@/domain';

import { migrate } from '../migrate';
import { migrations } from '../migrations';
import { findAuthorByName } from './authors';
import { findGenreByName } from './genres';
import { findBorrowerByName } from './loans';
import { findSeriesByName } from './series';

import type { Db, SqlValue } from '../types';

/** SQLite's default limit on bound parameters is 999 in older builds; stay under it. */
const MAX_PARAMS = 900;

const DEVICE_KEYS: readonly string[] = deviceSettingKeys;
const deviceKeyList = DEVICE_KEYS.map((k) => `'${k.replace(/'/g, "''")}'`).join(', ');

export interface DumpOptions {
  /** Write `cover_uri` as null for covers stored on this device (default true; see `BACKUP_COVERS_NOTE`). */
  stripDeviceCovers?: boolean;
}

/**
 * Every backed-up table, row by row with its database column names, in key
 * order. Settings that describe this phone (`deviceSettingKeys`) are left out.
 */
export async function dumpTables(db: Db, { stripDeviceCovers = true }: DumpOptions = {}): Promise<Record<BackupTableName, BackupRow[]>> {
  const out = {} as Record<BackupTableName, BackupRow[]>;
  for (const spec of backupTables) {
    const cols = spec.columns.map((c) => c.name).join(', ');
    const where = spec.name === 'settings' ? ` WHERE key NOT IN (${deviceKeyList})` : '';
    const rows = await db.all<BackupRow>(`SELECT ${cols} FROM ${spec.name}${where} ORDER BY ${spec.key.join(', ')}`);
    out[spec.name] = rows.map((r) => ({ ...r }));
  }
  if (stripDeviceCovers) {
    for (const book of out.books) if (isDeviceCoverUri(book.cover_uri as string | null)) book.cover_uri = null;
  }
  return out;
}

/** Row counts per backed-up table. */
export async function countTables(db: Db): Promise<Record<BackupTableName, number>> {
  const out = {} as Record<BackupTableName, number>;
  for (const spec of backupTables) {
    const where = spec.name === 'settings' ? ` WHERE key NOT IN (${deviceKeyList})` : '';
    out[spec.name] = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${spec.name}${where}`))?.n ?? 0;
  }
  return out;
}

/** Inserts rows as they are (ids included), in batches of one statement per column set. */
async function insertRows(tx: Db, spec: BackupTableSpec, rows: readonly BackupRow[]): Promise<void> {
  const known = spec.columns.map((c) => c.name);
  const bySignature = new Map<string, BackupRow[]>();
  for (const row of rows) {
    const cols = known.filter((c) => row[c] !== undefined);
    const sig = cols.join(',');
    let list = bySignature.get(sig);
    if (!list) bySignature.set(sig, (list = []));
    list.push(row);
  }
  for (const [sig, list] of bySignature) {
    const cols = sig.split(',');
    const perStatement = Math.max(1, Math.floor(MAX_PARAMS / cols.length));
    for (let i = 0; i < list.length; i += perStatement) {
      const chunk = list.slice(i, i + perStatement);
      const placeholders = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
      const params: SqlValue[] = [];
      for (const row of chunk) for (const c of cols) params.push(row[c] ?? null);
      await tx.run(`INSERT INTO ${spec.name} (${cols.join(', ')}) VALUES ${placeholders}`, params);
    }
  }
}

/**
 * Replaces the whole library with `tables`, keeping every id. Call inside a
 * transaction: a constraint failure half-way must roll everything back.
 * Settings in the backup replace the stored ones, except this phone's own
 * (`deviceSettingKeys`), which are kept. Cover-search bookkeeping is cleared
 * so restored books without a cover are searched again.
 */
export async function replaceAllTables(tx: Db, tables: BackupTables): Promise<void> {
  await tx.run('DELETE FROM cover_attempts');
  for (const spec of [...backupTables].reverse()) {
    if (spec.name === 'settings') await tx.run(`DELETE FROM settings WHERE key NOT IN (${deviceKeyList})`);
    else await tx.run(`DELETE FROM ${spec.name}`);
  }
  for (const spec of backupTables) {
    let rows = tables[spec.name] ?? [];
    if (spec.name === 'settings') rows = rows.filter((r) => !DEVICE_KEYS.includes(String(r.key)));
    if (rows.length) await insertRows(tx, spec, rows);
  }
}

export interface MergeSummary {
  booksAdded: number;
  /** Books already in the library (same ISBN-13 and title) that were left alone. */
  booksSkipped: number;
  loansAdded: number;
}

const bookKey = (isbn13: unknown, title: unknown) => `${isbn13 ?? ''}|${normaliseText(String(title ?? ''), { dropArticle: false })}`;

/**
 * Adds the backup's books to the library without touching what is there
 * (P08-03 "Merge"): books whose ISBN-13 and title already exist are skipped;
 * authors, genres, series, groups and borrowers are matched by name and
 * reused, or created; every id is remapped. Settings are not merged. Call
 * inside a transaction.
 */
export async function mergeTables(tx: Db, tables: BackupTables): Promise<MergeSummary> {
  const rows = (name: BackupTableName) => tables[name] ?? [];
  const summary: MergeSummary = { booksAdded: 0, booksSkipped: 0, loansAdded: 0 };

  const mapByName = async (
    name: BackupTableName,
    find: (row: BackupRow) => Promise<{ id: number } | null>,
    insert: (row: BackupRow) => Promise<number>,
  ) => {
    const ids = new Map<number, number>();
    for (const row of rows(name)) {
      const hit = await find(row);
      ids.set(Number(row.id), hit ? hit.id : await insert(row));
    }
    return ids;
  };
  const insertOne = async (table: string, row: BackupRow, cols: string[]) =>
    (await tx.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null)))
      .lastInsertRowId;
  const present = (row: BackupRow, cols: string[]) => cols.filter((c) => row[c] !== undefined);

  const seriesIds = await mapByName('series', (r) => findSeriesByName(tx, String(r.name)), (r) => insertOne('series', r, ['name', 'total_count']));
  const authorIds = await mapByName('authors', (r) => findAuthorByName(tx, String(r.name)), (r) => insertOne('authors', r, ['name', 'sort_name']));
  const genreIds = await mapByName('genres', (r) => findGenreByName(tx, String(r.name)), (r) => insertOne('genres', r, ['name']));
  const existingGroups = await tx.all<{ id: number; name: string }>('SELECT id, name FROM groups ORDER BY id');
  const groupIds = await mapByName(
    'groups',
    async (r) => existingGroups.find((g) => normaliseText(g.name, { dropArticle: false }) === normaliseText(String(r.name), { dropArticle: false })) ?? null,
    (r) => insertOne('groups', r, present(r, ['name', 'colour', 'icon', 'created_at'])),
  );
  const borrowerIds = await mapByName('borrowers', (r) => findBorrowerByName(tx, String(r.name)), (r) => insertOne('borrowers', r, ['name', 'contact']));

  const existing = new Set(
    (await tx.all<{ isbn13: string | null; title: string }>('SELECT isbn13, title FROM books')).map((b) => bookKey(b.isbn13, b.title)),
  );
  const bookIds = new Map<number, number>();
  const bookCols = backupTableSpec('books').columns.map((c) => c.name).filter((c) => c !== 'id');
  for (const row of rows('books')) {
    const key = bookKey(row.isbn13, row.title);
    if (existing.has(key)) {
      summary.booksSkipped++;
      continue;
    }
    existing.add(key);
    const mapped: BackupRow = { ...row, series_id: row.series_id == null ? null : (seriesIds.get(Number(row.series_id)) ?? null) };
    bookIds.set(Number(row.id), await insertOne('books', mapped, present(mapped, bookCols)));
    summary.booksAdded++;
  }

  const link = async (table: BackupTableName, remap: Record<string, Map<number, number>>, adjust: (row: BackupRow) => BackupRow = (row) => row) => {
    const spec = backupTableSpec(table);
    for (const row of rows(table)) {
      let mapped: BackupRow = { ...row };
      let skip = false;
      for (const [col, ids] of Object.entries(remap)) {
        const id = ids.get(Number(row[col]));
        if (id == null) skip = true;
        else mapped[col] = id;
      }
      if (skip) continue;
      mapped = adjust(mapped);
      const cols = present(mapped, spec.columns.map((c) => c.name));
      await tx.run(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => mapped[c] ?? null));
    }
  };
  await link('book_authors', { book_id: bookIds, author_id: authorIds });
  await link('book_genres', { book_id: bookIds, genre_id: genreIds });
  // A group that is already here keeps its own books first: the backup's follow them, in the backup's order.
  const groupEnds = new Map(
    (await tx.all<{ group_id: number; next: number }>('SELECT group_id, MAX(position) + 1 AS next FROM group_books GROUP BY group_id')).map((r) => [r.group_id, r.next]),
  );
  await link('group_books', { book_id: bookIds, group_id: groupIds }, (row) => {
    const end = groupEnds.get(Number(row.group_id)) ?? 0;
    return end ? { ...row, position: end + Number(row.position ?? 0) } : row;
  });

  for (const row of rows('loans')) {
    const bookId = bookIds.get(Number(row.book_id));
    const borrowerId = borrowerIds.get(Number(row.borrower_id));
    if (bookId == null || borrowerId == null) continue;
    await insertOne('loans', { ...row, book_id: bookId, borrower_id: borrowerId }, ['book_id', 'borrower_id', 'lent_on', 'due_on', 'returned_on', 'note']);
    summary.loansAdded++;
  }

  for (const row of rows('pending_lookups')) {
    const cols = present(row, ['isbn13', 'requested_at', 'attempts', 'last_error']);
    await tx.run(`INSERT OR IGNORE INTO pending_lookups (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c] ?? null));
  }
  return summary;
}

/**
 * Brings tables from an older backup up to the current schema: loads them
 * into a scratch database migrated to `fromVersion`, runs the remaining
 * migrations over them (the same SQL that upgrades a phone), and reads them
 * back. `openScratch` opens an empty in-memory database; it is closed after.
 */
export async function upgradeTables(
  tables: BackupTables,
  fromVersion: number,
  openScratch: () => Promise<Db>,
): Promise<Record<BackupTableName, BackupRow[]>> {
  const scratch = await openScratch();
  try {
    await migrate(scratch, migrations.filter((m) => m.version <= fromVersion));
    await scratch.transaction(async (tx) => {
      for (const spec of backupTablesAt(fromVersion)) {
        const rows = tables[spec.name] ?? [];
        if (rows.length) await insertRows(tx, spec, rows);
      }
    });
    await migrate(scratch);
    return await dumpTables(scratch, { stripDeviceCovers: false });
  } finally {
    await scratch.close().catch(() => undefined);
  }
}

// ---- Safety snapshots (taken before a restore replaces the library) ----

export interface SnapshotInfo {
  id: number;
  createdAt: string;
  bookCount: number;
}

export interface Snapshot extends SnapshotInfo {
  /** The library as a backup document (JSON). */
  body: string;
}

/** Keeps `body` as the one safety snapshot, replacing any older one. */
export async function saveSnapshot(db: Db, { body, bookCount, createdAt }: { body: string; bookCount: number; createdAt: string }): Promise<SnapshotInfo> {
  await db.run('DELETE FROM backup_snapshots');
  const { lastInsertRowId } = await db.run(
    "INSERT INTO backup_snapshots (reason, created_at, book_count, body) VALUES ('before-restore', ?, ?, ?)",
    [createdAt, bookCount, body],
  );
  return { id: lastInsertRowId, createdAt, bookCount };
}

interface SnapshotRow {
  id: number;
  created_at: string;
  book_count: number;
  body: string;
}

export async function latestSnapshotInfo(db: Db): Promise<SnapshotInfo | null> {
  const row = await db.get<Omit<SnapshotRow, 'body'>>('SELECT id, created_at, book_count FROM backup_snapshots ORDER BY id DESC LIMIT 1');
  return row ? { id: row.id, createdAt: row.created_at, bookCount: row.book_count } : null;
}

export async function getSnapshot(db: Db, id: number): Promise<Snapshot | null> {
  const row = await db.get<SnapshotRow>('SELECT id, created_at, book_count, body FROM backup_snapshots WHERE id = ?', [id]);
  return row ? { id: row.id, createdAt: row.created_at, bookCount: row.book_count, body: row.body } : null;
}

export async function deleteSnapshots(db: Db): Promise<number> {
  return (await db.run('DELETE FROM backup_snapshots')).changes;
}
