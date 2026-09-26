import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  backupColumnsAt,
  isRating,
  backupTableNames,
  backupTablesAt,
  joinNames,
  type BackupColumn,
  type BackupFile,
  type BackupRow,
  type BackupTableName,
  type BackupTables,
  type BackupTableSpec,
} from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';

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

/** One row, for messages ("book 7"). */
const ROW_NAME: Record<BackupTableName, MessageKey> = {
  series: 'restore.rowNames.series',
  books: 'restore.rowNames.books',
  authors: 'restore.rowNames.authors',
  book_authors: 'restore.rowNames.bookAuthors',
  genres: 'restore.rowNames.genres',
  book_genres: 'restore.rowNames.bookGenres',
  groups: 'restore.rowNames.groups',
  group_books: 'restore.rowNames.groupBooks',
  borrowers: 'restore.rowNames.borrowers',
  loans: 'restore.rowNames.loans',
  pending_lookups: 'restore.rowNames.pendingLookups',
  settings: 'restore.rowNames.settings',
};

/** A whole table, for messages ("its book authors are missing"). */
const TABLE_NAME: Record<BackupTableName, MessageKey> = {
  series: 'restore.tableNames.series',
  books: 'restore.tableNames.books',
  authors: 'restore.tableNames.authors',
  book_authors: 'restore.tableNames.bookAuthors',
  genres: 'restore.tableNames.genres',
  book_genres: 'restore.tableNames.bookGenres',
  groups: 'restore.tableNames.groups',
  group_books: 'restore.tableNames.groupBooks',
  borrowers: 'restore.tableNames.borrowers',
  loans: 'restore.tableNames.loans',
  pending_lookups: 'restore.tableNames.pendingLookups',
  settings: 'restore.tableNames.settings',
};

const rowName = (table: BackupTableName, number: string | number) => translate(ROW_NAME[table], { number });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function typeOk(col: BackupColumn, v: unknown): boolean {
  if (v === null) return col.nullable;
  if (col.type === 'text') return typeof v === 'string';
  if (col.type === 'integer') return typeof v === 'number' && Number.isSafeInteger(v);
  return typeof v === 'number' && Number.isFinite(v);
}

function checkRow(spec: BackupTableSpec, columns: readonly BackupColumn[], raw: unknown, index: number): BackupRow {
  const row = rowName(spec.name, index + 1);
  if (!isObject(raw)) throw new BackupError('bad-row', t('restore.errors.notARecord', { row }));
  const known = new Set(columns.map((c) => c.name));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) throw new BackupError('bad-row', t('restore.errors.unknownField', { row, field: key }));
  }
  for (const col of columns) {
    const v = raw[col.name];
    if (v === undefined) {
      if (col.hasDefault) continue;
      throw new BackupError('bad-row', t('restore.errors.missingField', { row, field: col.name }));
    }
    if (!typeOk(col, v)) throw new BackupError('bad-row', t('restore.errors.unexpectedField', { row, field: col.name }));
    if (col.type === 'text' && !col.nullable && (col.name === 'title' || col.name === 'name') && !(v as string).trim()) {
      throw new BackupError('bad-row', t('restore.errors.emptyField', { row, field: col.name }));
    }
    if (spec.name === 'books' && col.name === 'rating' && v !== null && !isRating(v)) {
      throw new BackupError('bad-row', t('restore.errors.badRating', { row, value: String(v) }));
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
    throw new BackupError('not-backup', t('restore.errors.notBackup'));
  }
  const { formatVersion, schemaVersion, tables } = doc;
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new BackupError('bad-version', t('restore.errors.noFormatVersion'));
  }
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new BackupError('bad-version', t('restore.errors.noSchemaVersion'));
  }
  if (formatVersion > BACKUP_FORMAT_VERSION || schemaVersion > currentSchemaVersion) {
    throw new BackupError('newer-version', t('restore.errors.newerVersion'));
  }
  if (!isObject(tables)) throw new BackupError('missing-table', t('restore.errors.noTables'));

  const specs = backupTablesAt(schemaVersion);
  for (const name of Object.keys(tables)) {
    if (!specs.some((s) => s.name === name)) {
      const known = (backupTableNames as readonly string[]).includes(name);
      throw new BackupError(
        'unknown-table',
        known ? t('restore.errors.tableTooNew', { name }) : t('restore.errors.unknownTable', { name }),
      );
    }
  }

  const out: BackupTables = {};
  const keys = new Map<BackupTableName, Set<string>>();
  for (const spec of specs) {
    const raw = tables[spec.name];
    if (!Array.isArray(raw)) throw new BackupError('missing-table', t('restore.errors.tableMissing', { tables: translate(TABLE_NAME[spec.name]) }));
    const seen = new Set<string>();
    const columns = backupColumnsAt(spec, schemaVersion);
    const rows = raw.map((r, i) => {
      const row = checkRow(spec, columns, r, i);
      const key = spec.key.map((k) => String(row[k])).join('|');
      if (seen.has(key)) {
        throw new BackupError(
          'duplicate-key',
          t('restore.errors.duplicateKey', { tables: translate(TABLE_NAME[spec.name]), columns: joinNames(spec.key), values: key.replace('|', ', ') }),
        );
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
            t('restore.errors.brokenLink', { row: rowName(spec.name, i + 1), target: rowName(ref.table, String(v)) }),
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
  if (!body.trim()) throw new BackupError('empty', t('restore.errors.empty'));
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    throw new BackupError('not-json', t('restore.errors.notJson'));
  }
  return validateBackup(doc, options);
}
