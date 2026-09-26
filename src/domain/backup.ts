/**
 * The MyShelf backup file (P08-02, P08-03): one JSON document holding every
 * table of the library, row by row, with the schema version it was taken at.
 *
 * ```json
 * {
 *   "format": "myshelf-backup",
 *   "formatVersion": 1,
 *   "schemaVersion": 7,
 *   "appVersion": "1.0.0",
 *   "exportedAt": "2026-10-12T09:30:00.000Z",
 *   "covers": "…",
 *   "counts": { "books": 12, … },
 *   "tables": { "books": [{ "id": 1, "title": "Dune", … }], … }
 * }
 * ```
 *
 * Rows use the database's own column names, so a restore writes them back
 * unchanged (same ids, same links). Derived data is left out: `api_cache`,
 * `cover_attempts`, `backup_snapshots`, `schema_migrations`, and the
 * settings in `deviceSettingKeys`.
 *
 * Covers: a cover saved on the phone (`file://…`) is not in the file, so its
 * `cover_uri` is written as null and the cover backfill fetches a real cover
 * again after a restore. Web covers (remote URLs) and pictures stored as
 * `data:` URIs travel as they are.
 */

export const BACKUP_FORMAT = 'myshelf-backup';
/** The shape of the document itself. Bump it for changes outside `tables`. */
export const BACKUP_FORMAT_VERSION = 1;

export type BackupColumnType = 'integer' | 'real' | 'text';

export interface BackupColumn {
  name: string;
  type: BackupColumnType;
  /** Whether null is allowed. Columns with a database default may still be omitted from a row. */
  nullable: boolean;
  /** The database fills it in when missing (timestamps, flags). */
  hasDefault?: boolean;
  /** The schema version that added the column to an existing table; older backups do not have it. */
  since?: number;
}

export interface BackupReference {
  column: string;
  table: BackupTableName;
  /** Null is allowed (an optional link, e.g. a book's series). */
  optional?: boolean;
}

export interface BackupTableSpec {
  name: BackupTableName;
  columns: readonly BackupColumn[];
  /** The primary key: unique across rows. */
  key: readonly string[];
  references: readonly BackupReference[];
  /** The schema version that created the table; older backups do not have it. */
  since: number;
}

export type BackupTableName =
  | 'series'
  | 'books'
  | 'authors'
  | 'book_authors'
  | 'genres'
  | 'book_genres'
  | 'groups'
  | 'group_books'
  | 'borrowers'
  | 'loans'
  | 'pending_lookups'
  | 'settings';

const int = (name: string, nullable = false, hasDefault = false): BackupColumn => ({ name, type: 'integer', nullable, hasDefault });
const real = (name: string): BackupColumn => ({ name, type: 'real', nullable: true });
const text = (name: string, nullable = true, hasDefault = false): BackupColumn => ({ name, type: 'text', nullable, hasDefault });

/**
 * Every backed-up table, parents before children (the order a restore
 * inserts them). Columns match the current schema. When a migration adds a
 * column, the column gets `since` (the migration's version) and the file's
 * `schemaVersion` moves up with the database's: a backup from before it has
 * no such field, is checked against the columns of its own version
 * (`backupColumnsAt`), and is brought forward by the real migrations in a
 * scratch database before it is restored.
 */
export const backupTables: readonly BackupTableSpec[] = [
  { name: 'series', since: 1, key: ['id'], references: [], columns: [int('id'), text('name', false), int('total_count', true)] },
  {
    name: 'books',
    since: 1,
    key: ['id'],
    references: [{ column: 'series_id', table: 'series', optional: true }],
    columns: [
      int('id'),
      text('title', false),
      text('subtitle'),
      text('isbn13'),
      text('isbn10'),
      text('edition'),
      text('publisher'),
      int('publication_year', true),
      int('page_count', true),
      text('summary'),
      text('cover_uri'),
      text('language'),
      text('format'),
      int('series_id', true),
      real('series_position'),
      text('source'),
      text('source_id'),
      text('notes'),
      text('created_at', false, true),
      text('updated_at', false, true),
      { ...int('rating', true), since: 7 },
    ],
  },
  { name: 'authors', since: 1, key: ['id'], references: [], columns: [int('id'), text('name', false), text('sort_name')] },
  {
    name: 'book_authors',
    since: 1,
    key: ['book_id', 'author_id'],
    references: [
      { column: 'book_id', table: 'books' },
      { column: 'author_id', table: 'authors' },
    ],
    columns: [int('book_id'), int('author_id'), text('role', false, true), int('position', false, true)],
  },
  { name: 'genres', since: 1, key: ['id'], references: [], columns: [int('id'), text('name', false)] },
  {
    name: 'book_genres',
    since: 1,
    key: ['book_id', 'genre_id'],
    references: [
      { column: 'book_id', table: 'books' },
      { column: 'genre_id', table: 'genres' },
    ],
    columns: [int('book_id'), int('genre_id'), int('user_edited', false, true)],
  },
  {
    name: 'groups',
    since: 1,
    key: ['id'],
    references: [],
    columns: [int('id'), text('name', false), text('colour'), text('icon'), text('created_at', false, true)],
  },
  {
    name: 'group_books',
    since: 1,
    key: ['group_id', 'book_id'],
    references: [
      { column: 'group_id', table: 'groups' },
      { column: 'book_id', table: 'books' },
    ],
    columns: [int('group_id'), int('book_id'), int('position', false, true)],
  },
  { name: 'borrowers', since: 1, key: ['id'], references: [], columns: [int('id'), text('name', false), text('contact')] },
  {
    name: 'loans',
    since: 1,
    key: ['id'],
    references: [
      { column: 'book_id', table: 'books' },
      { column: 'borrower_id', table: 'borrowers' },
    ],
    columns: [int('id'), int('book_id'), int('borrower_id'), text('lent_on', false), text('due_on'), text('returned_on'), text('note')],
  },
  {
    name: 'pending_lookups',
    since: 3,
    key: ['isbn13'],
    references: [],
    columns: [text('isbn13', false), text('requested_at', false, true), int('attempts', false, true), text('last_error')],
  },
  { name: 'settings', since: 1, key: ['key'], references: [], columns: [text('key', false), text('value')] },
];

export const backupTableNames: readonly BackupTableName[] = backupTables.map((t) => t.name);

export function backupTableSpec(name: BackupTableName): BackupTableSpec {
  return backupTables.find((t) => t.name === name)!;
}

/** The tables a backup taken at `schemaVersion` holds. */
export function backupTablesAt(schemaVersion: number): readonly BackupTableSpec[] {
  return backupTables.filter((t) => t.since <= schemaVersion);
}

/** A table's columns as a backup taken at `schemaVersion` has them. */
export function backupColumnsAt(spec: BackupTableSpec, schemaVersion: number): readonly BackupColumn[] {
  return spec.columns.filter((c) => (c.since ?? spec.since) <= schemaVersion);
}

export type BackupRow = Record<string, string | number | null>;
export type BackupTables = Partial<Record<BackupTableName, BackupRow[]>>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  /** The database schema version (`PRAGMA user_version`) the rows follow. */
  schemaVersion: number;
  appVersion: string;
  /** ISO-8601 UTC. */
  exportedAt: string;
  /** How covers were handled, for anyone reading the file. */
  covers?: string;
  /** Rows per table, for anyone reading the file (and a quick summary before a restore). */
  counts?: Partial<Record<BackupTableName, number>>;
  tables: BackupTables;
}

export const BACKUP_COVERS_NOTE =
  'Covers saved on the phone are not included (cover_uri is null for them); MyShelf fetches covers again after a restore. Web addresses and embedded pictures are kept.';

/** Whether a stored cover lives on this device only (so a backup cannot carry it). */
export function isDeviceCoverUri(uri: string | null | undefined): boolean {
  return !!uri && /^(file|content|ph|assets-library):/i.test(uri);
}

/** `myshelf-backup-2026-10-12.json`. */
export function backupFileName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `myshelf-backup-${y}-${m}-${d}.json`;
}

/** What a backup holds, in words: "12 books, 4 loans, 2 groups". */
export function describeCounts(counts: Partial<Record<BackupTableName, number>>): string {
  const parts: string[] = [];
  const add = (n: number | undefined, one: string, many: string) => {
    if (n) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(counts.books ?? 0, 'book', 'books');
  add(counts.series, 'series', 'series');
  add(counts.groups, 'group', 'groups');
  add(counts.borrowers, 'borrower', 'borrowers');
  add(counts.loans, 'loan', 'loans');
  if (!parts.length) return 'no books';
  return parts.join(', ');
}
