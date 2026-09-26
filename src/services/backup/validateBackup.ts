import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupTableNames,
  backupTablesAt,
  type BackupColumn,
  type BackupFile,
  type BackupRow,
  type BackupTableName,
  type BackupTables,
  type BackupTableSpec,
} from '@/domain';

export type BackupErrorCode =
  | 'empty'
  | 'not-json'
  | 'not-backup'
  | 'newer-version'
  | 'bad-version'
  | 'unknown-table'
  | 'missing-table'
  | 'bad-row'
  | 'duplicate-key'
  | 'broken-link';

/** Why a file cannot be restored, in words for the person holding the phone. Nothing is ever changed when this is thrown. */
export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

const DAMAGED = 'This backup looks damaged';

/** Singular names for messages ("book 7"). */
const ROW_NOUN: Record<BackupTableName, string> = {
  series: 'series',
  books: 'book',
  authors: 'author',
  book_authors: 'book–author link',
  genres: 'genre',
  book_genres: 'book–genre link',
  groups: 'group',
  group_books: 'group–book link',
  borrowers: 'borrower',
  loans: 'loan',
  pending_lookups: 'pending lookup',
  settings: 'setting',
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function typeOk(col: BackupColumn, v: unknown): boolean {
  if (v === null) return col.nullable;
  if (col.type === 'text') return typeof v === 'string';
  if (col.type === 'integer') return typeof v === 'number' && Number.isSafeInteger(v);
  return typeof v === 'number' && Number.isFinite(v);
}

function checkRow(spec: BackupTableSpec, raw: unknown, index: number): BackupRow {
  const where = `${ROW_NOUN[spec.name]} ${index + 1}`;
  if (!isObject(raw)) throw new BackupError('bad-row', `${DAMAGED}: ${where} isn’t a record. Nothing was changed.`);
  const known = new Set(spec.columns.map((c) => c.name));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) throw new BackupError('bad-row', `${DAMAGED}: ${where} has an unknown field “${key}”. Nothing was changed.`);
  }
  for (const col of spec.columns) {
    const v = raw[col.name];
    if (v === undefined) {
      if (col.hasDefault) continue;
      throw new BackupError('bad-row', `${DAMAGED}: ${where} is missing “${col.name}”. Nothing was changed.`);
    }
    if (!typeOk(col, v)) throw new BackupError('bad-row', `${DAMAGED}: ${where} has an unexpected “${col.name}”. Nothing was changed.`);
    if (col.type === 'text' && !col.nullable && (col.name === 'title' || col.name === 'name') && !(v as string).trim()) {
      throw new BackupError('bad-row', `${DAMAGED}: ${where} has an empty ${col.name}. Nothing was changed.`);
    }
  }
  return raw as BackupRow;
}

export interface ValidateOptions {
  /** The app's schema version (`LATEST_VERSION`); a backup from a newer schema is refused. */
  currentSchemaVersion: number;
}

/**
 * Checks a parsed backup document: the format name and versions, that every
 * table of its schema version is there and nothing else, every row's fields
 * and types, unique keys, and that every link points at a row in the file.
 * Returns the document typed; throws `BackupError` with a friendly message.
 */
export function validateBackup(doc: unknown, { currentSchemaVersion }: ValidateOptions): BackupFile {
  if (!isObject(doc) || doc.format !== BACKUP_FORMAT) {
    throw new BackupError('not-backup', 'That file isn’t a MyShelf backup. Choose a file named like myshelf-backup-2026-10-12.json.');
  }
  const { formatVersion, schemaVersion, tables } = doc;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new BackupError('bad-version', `${DAMAGED}: its format version is missing. Nothing was changed.`);
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new BackupError('bad-version', `${DAMAGED}: its schema version is missing. Nothing was changed.`);
  }
  if (formatVersion > BACKUP_FORMAT_VERSION || schemaVersion > currentSchemaVersion) {
    throw new BackupError('newer-version', 'This backup was made by a newer version of MyShelf. Update the app, then try again.');
  }
  if (!isObject(tables)) throw new BackupError('missing-table', `${DAMAGED}: it has no tables. Nothing was changed.`);

  const specs = backupTablesAt(schemaVersion);
  for (const name of Object.keys(tables)) {
    if (!specs.some((s) => s.name === name)) {
      const known = (backupTableNames as readonly string[]).includes(name);
      throw new BackupError(
        'unknown-table',
        known
          ? `${DAMAGED}: it has “${name}”, which its version shouldn’t have. Nothing was changed.`
          : `${DAMAGED}: it has a table MyShelf doesn’t know (“${name}”). Nothing was changed.`,
      );
    }
  }

  const out: BackupTables = {};
  const keys = new Map<BackupTableName, Set<string>>();
  for (const spec of specs) {
    const raw = tables[spec.name];
    if (!Array.isArray(raw)) throw new BackupError('missing-table', `${DAMAGED}: its ${spec.name.replace(/_/g, ' ')} are missing. Nothing was changed.`);
    const seen = new Set<string>();
    const rows = raw.map((r, i) => {
      const row = checkRow(spec, r, i);
      const key = spec.key.map((k) => String(row[k])).join('|');
      if (seen.has(key)) {
        throw new BackupError('duplicate-key', `${DAMAGED}: two ${spec.name.replace(/_/g, ' ')} share the same ${spec.key.join(' and ')} (${key.replace('|', ', ')}). Nothing was changed.`);
      }
      seen.add(key);
      return row;
    });
    keys.set(spec.name, seen);
    out[spec.name] = rows;
  }

  for (const spec of specs) {
    for (const ref of spec.references) {
      const targets = keys.get(ref.table)!;
      (out[spec.name] ?? []).forEach((row, i) => {
        const v = row[ref.column];
        if (v == null && ref.optional) return;
        if (!targets.has(String(v))) {
          throw new BackupError(
            'broken-link',
            `${DAMAGED}: ${ROW_NOUN[spec.name]} ${i + 1} points at ${ROW_NOUN[ref.table]} ${String(v)}, which isn’t in the file. Nothing was changed.`,
          );
        }
      });
    }
  }

  return {
    format: BACKUP_FORMAT,
    formatVersion,
    schemaVersion,
    appVersion: typeof doc.appVersion === 'string' ? doc.appVersion : 'unknown',
    exportedAt: typeof doc.exportedAt === 'string' ? doc.exportedAt : '',
    ...(typeof doc.covers === 'string' ? { covers: doc.covers } : {}),
    tables: out,
  };
}

/** Parses a backup file's text (a UTF-8 BOM is allowed) and validates it. Throws `BackupError`. */
export function parseBackup(text: string, options: ValidateOptions): BackupFile {
  const body = text.replace(/^﻿/, '');
  if (!body.trim()) throw new BackupError('empty', 'That file is empty. Choose the backup file MyShelf saved.');
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    throw new BackupError(
      'not-json',
      'That file couldn’t be read as a MyShelf backup. It may be incomplete or a different kind of file. Nothing was changed.',
    );
  }
  return validateBackup(doc, options);
}
