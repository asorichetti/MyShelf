/**
 * @jest-environment node
 */
import { LATEST_VERSION, type Db } from '@/db';
import type { BackupFile } from '@/domain';
import { BackupError, exportBackup, parseBackup, serializeBackup, validateBackup } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

import schema1 from '../__fixtures__/backup-schema1.json';

const options = { currentSchemaVersion: LATEST_VERSION };
let db: Db;
let text: string;
let good: BackupFile;
beforeAll(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
  good = await exportBackup(db, { appVersion: '1', now: () => new Date('2026-06-20T09:00:00Z') });
  text = serializeBackup(good);
});
afterAll(() => db.close());

const clone = (): BackupFile => JSON.parse(text);

/** The code of the BackupError `fn` throws. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof BackupError) return e.code;
    throw e;
  }
  return 'accepted';
}
const check = (doc: unknown) => codeOf(() => validateBackup(doc, options));

describe('parseBackup', () => {
  it('accepts a current backup, with or without a BOM', () => {
    expect(parseBackup(text, options).tables.books).toHaveLength(12);
    expect(parseBackup(`﻿${text}`, options).tables.books).toHaveLength(12);
  });

  it('accepts ratings, and a schema 6 backup (from before ratings) without them', () => {
    const doc = clone();
    doc.tables.books![0].rating = 5;
    doc.tables.books![1].rating = null;
    expect(validateBackup(doc, options).tables.books![0].rating).toBe(5);
    const old = clone();
    old.schemaVersion = 6;
    for (const b of old.tables.books!) delete b.rating;
    expect(validateBackup(old, options).schemaVersion).toBe(6);
  });

  it('accepts the older schema 1 fixture', () => {
    expect(validateBackup(schema1, options).schemaVersion).toBe(1);
  });

  it('refuses an empty file and a file that is not JSON', () => {
    expect(codeOf(() => parseBackup('', options))).toBe('empty');
    expect(codeOf(() => parseBackup('   \n', options))).toBe('empty');
    expect(codeOf(() => parseBackup('Title,Author\nDune,Herbert', options))).toBe('not-json');
  });

  it('refuses every truncation of a real backup with a friendly error', () => {
    // Cut the file at many points: none may be accepted, none may throw anything but a BackupError.
    const step = Math.max(1, Math.floor(text.length / 150));
    for (let cut = 0; cut < text.length - 2; cut += step) {
      const code = codeOf(() => parseBackup(text.slice(0, cut), options));
      expect(['empty', 'not-json']).toContain(code);
    }
  });

  it('explains the error in words', () => {
    expect(() => parseBackup('{"hello": 1}', options)).toThrow('That file isn’t a MyShelf backup');
    expect(() => parseBackup(text.slice(0, 500), options)).toThrow(/may be incomplete/);
  });
});

describe('validateBackup', () => {
  it('refuses foreign JSON', () => {
    expect(check([])).toBe('not-backup');
    expect(check(null)).toBe('not-backup');
    expect(check({ books: [] })).toBe('not-backup');
    expect(check({ format: 'goodreads-export', tables: {} })).toBe('not-backup');
  });

  it('refuses a backup from a newer app, and missing versions', () => {
    expect(check({ ...clone(), schemaVersion: LATEST_VERSION + 1 })).toBe('newer-version');
    expect(check({ ...clone(), formatVersion: 2 })).toBe('newer-version');
    expect(check({ ...clone(), schemaVersion: '5' })).toBe('bad-version');
    expect(check({ ...clone(), formatVersion: undefined })).toBe('bad-version');
    expect(() => validateBackup({ ...clone(), schemaVersion: 99 }, options)).toThrow('Update the app, then try again.');
  });

  it('refuses unknown or missing tables', () => {
    const extra = clone();
    (extra.tables as Record<string, unknown>).wishlist = [];
    expect(check(extra)).toBe('unknown-table');
    const missing = clone();
    delete missing.tables.loans;
    expect(check(missing)).toBe('missing-table');
    // A schema 1 backup cannot hold a table added in schema 3.
    expect(check({ ...schema1, tables: { ...schema1.tables, pending_lookups: [] } })).toBe('unknown-table');
    expect(check({ ...clone(), tables: null })).toBe('missing-table');
  });

  it('refuses rows with wrong types, unknown fields or missing required fields', () => {
    const cases: [string, (b: BackupFile) => void][] = [
      ['title a number', (b) => (b.tables.books![0].title = 42)],
      ['blank title', (b) => (b.tables.books![0].title = '  ')],
      ['id a string', (b) => (b.tables.books![0].id = '1')],
      ['fractional id', (b) => (b.tables.books![0].id = 1.5)],
      ['unknown field', (b) => (b.tables.books![0].stars = 5)],
      ['rating out of range', (b) => (b.tables.books![0].rating = 6)],
      ['rating zero', (b) => (b.tables.books![0].rating = 0)],
      ['fractional rating', (b) => (b.tables.books![0].rating = 4.5)],
      ['rating as text', (b) => (b.tables.books![0].rating = '4')],
      ['missing rating', (b) => delete b.tables.books![0].rating],
      // A schema 6 backup predates the column.
      ['rating in a schema 6 backup', (b) => (b.schemaVersion = 6)],
      ['missing lent_on', (b) => delete b.tables.loans![0].lent_on],
      ['row not an object', (b) => ((b.tables.genres as unknown[])[0] = 'Fantasy')],
      ['null name', (b) => (b.tables.authors![0].name = null)],
    ];
    for (const [what, tamper] of cases) {
      const doc = clone();
      tamper(doc);
      expect({ what, code: check(doc) }).toEqual({ what, code: 'bad-row' });
    }
  });

  it('refuses series numbers far beyond any series, which would hang the Series screens', () => {
    const cases: [string, (b: BackupFile) => void][] = [
      ['series of a billion books', (b) => (b.tables.series![0].total_count = 1_000_000_000)],
      ['book number a billion', (b) => (b.tables.books!.find((r) => r.series_id != null)!.series_position = 1e9)],
      ['book number 10,000', (b) => (b.tables.books!.find((r) => r.series_id != null)!.series_position = 10_000)],
    ];
    for (const [what, tamper] of cases) {
      const doc = clone();
      tamper(doc);
      expect({ what, code: check(doc) }).toEqual({ what, code: 'bad-row' });
    }
    const fine = clone();
    fine.tables.series![0].total_count = 10_000;
    fine.tables.books!.find((r) => r.series_id != null)!.series_position = 9_999.5;
    expect(check(fine)).toBe('accepted');
  });

  it('allows columns the database fills in to be left out', () => {
    const doc = clone();
    delete doc.tables.books![0].created_at;
    delete doc.tables.book_authors![0].role;
    expect(check(doc)).toBe('accepted');
  });

  it('refuses duplicate ids and duplicate links', () => {
    const books = clone();
    books.tables.books![1].id = books.tables.books![0].id;
    expect(check(books)).toBe('duplicate-key');
    const links = clone();
    links.tables.book_authors!.push({ ...links.tables.book_authors![0] });
    expect(check(links)).toBe('duplicate-key');
    const settings = clone();
    settings.tables.settings!.push({ key: 'x', value: '1' }, { key: 'x', value: '2' });
    expect(check(settings)).toBe('duplicate-key');
  });

  it('refuses tampered ids that break a link', () => {
    const loan = clone();
    loan.tables.loans![0].book_id = 999;
    expect(check(loan)).toBe('broken-link');
    expect(() => validateBackup(loan, options)).toThrow('points at book 999, which isn’t in the file');
    const series = clone();
    const inSeries = series.tables.books!.find((b) => b.series_id != null)!;
    inSeries.series_id = 777;
    expect(check(series)).toBe('broken-link');
    const optional = clone();
    optional.tables.books![0].series_id = null;
    expect(check(optional)).toBe('accepted');
  });
});
