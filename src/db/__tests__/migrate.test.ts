/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getSchemaVersion, LATEST_VERSION, migrate, MigrationError, migrations, type Db, type Migration } from '@/db';
import { openNodeDatabase } from '@/db/node';

const EXPECTED_TABLES = [
  'authors',
  'book_authors',
  'book_genres',
  'books',
  'borrowers',
  'genres',
  'group_books',
  'groups',
  'loans',
  'schema_migrations',
  'series',
  'settings',
];

async function tables(db: Db) {
  const rows = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('migrate', () => {
  let db: Db;
  beforeEach(async () => {
    db = await openNodeDatabase();
  });
  afterEach(() => db.close());

  it('takes a fresh database to the latest version', async () => {
    expect(await getSchemaVersion(db)).toBe(0);
    const result = await migrate(db);
    expect(result).toEqual({ from: 0, to: LATEST_VERSION, applied: migrations.map((m) => m.version) });
    expect(await tables(db)).toEqual(EXPECTED_TABLES);
    const rows = await db.all<{ version: number; name: string; applied_at: string }>('SELECT * FROM schema_migrations');
    expect(rows.map((r) => [r.version, r.name])).toEqual(migrations.map((m) => [m.version, m.name]));
    expect(rows[0].applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is idempotent: a second run applies nothing and keeps data', async () => {
    await migrate(db);
    await db.run("INSERT INTO books (title) VALUES ('Kept')");
    const again = await migrate(db);
    expect(again).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION, applied: [] });
    expect(await db.get('SELECT title FROM books')).toEqual({ title: 'Kept' });
    expect(await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM schema_migrations')).toEqual({ n: migrations.length });
  });

  it('is idempotent across reopening a database file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'myshelf-'));
    const path = join(dir, 'test.db');
    try {
      const first = await openNodeDatabase(path);
      await migrate(first);
      await first.close();
      const second = await openNodeDatabase(path);
      expect(await migrate(second)).toEqual({ from: LATEST_VERSION, to: LATEST_VERSION, applied: [] });
      await second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies only pending migrations', async () => {
    const extra: Migration = { version: LATEST_VERSION + 1, name: 'add_test', up: 'CREATE TABLE extra (id INTEGER PRIMARY KEY);' };
    await migrate(db);
    const result = await migrate(db, [...migrations, extra]);
    expect(result).toEqual({ from: LATEST_VERSION, to: extra.version, applied: [extra.version] });
    expect(await tables(db)).toContain('extra');
  });

  it('rolls back a failing migration and stays at the last good version', async () => {
    const bad: Migration = {
      version: LATEST_VERSION + 1,
      name: 'broken',
      up: 'CREATE TABLE half_done (id INTEGER); THIS IS NOT SQL;',
    };
    await expect(migrate(db, [...migrations, bad])).rejects.toThrow();
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await tables(db)).not.toContain('half_done');
  });

  it('refuses a database newer than the app', async () => {
    await migrate(db);
    await db.run("INSERT INTO schema_migrations (version, name) VALUES (999, 'future')");
    await expect(migrate(db)).rejects.toThrow(MigrationError);
  });

  it('rejects out-of-order migration lists', async () => {
    const list: Migration[] = [
      { version: 2, name: 'b', up: '' },
      { version: 1, name: 'a', up: '' },
    ];
    await expect(migrate(db, list)).rejects.toThrow(/strictly increasing/);
  });
});

describe('schema 001', () => {
  let db: Db;
  beforeEach(async () => {
    db = await openNodeDatabase();
    await migrate(db);
  });
  afterEach(() => db.close());

  it('has the one-open-loan-per-book partial unique index', async () => {
    const idx = await db.get<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'loans_one_open_per_book'");
    expect(idx?.sql).toMatch(/UNIQUE INDEX/i);
    expect(idx?.sql).toMatch(/WHERE returned_on IS NULL/i);
  });

  it('declares useful indexes', async () => {
    const rows = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'");
    const names = rows.map((r) => r.name);
    for (const n of ['books_title_idx', 'books_isbn13_idx', 'books_series_idx', 'book_authors_author_idx', 'book_genres_genre_idx', 'group_books_book_idx', 'loans_borrower_idx']) {
      expect(names).toContain(n);
    }
  });

  it('rejects blank titles and bad formats', async () => {
    await expect(db.run("INSERT INTO books (title) VALUES ('  ')")).rejects.toThrow(/CHECK/);
    await expect(db.run("INSERT INTO books (title, format) VALUES ('x', 'scroll')")).rejects.toThrow(/CHECK/);
  });

  it('rejects dangling foreign keys', async () => {
    await expect(db.run('INSERT INTO books (title, series_id) VALUES (?, ?)', ['x', 42])).rejects.toThrow(/FOREIGN KEY/);
  });
});
