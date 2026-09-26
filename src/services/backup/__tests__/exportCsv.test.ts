/**
 * @jest-environment node
 */
import { booksRepo, type Db } from '@/db';
import { setToday } from '@/domain';
import { csvFileName, exportCsv, parseCsv } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const table = async (includeLoans = false) => {
  const { text } = await exportCsv(db, { includeLoans });
  const [header, ...rows] = parseCsv(text);
  return { text, header, rows, get: (title: string, column: string) => rows.find((r) => r[0] === title)![header.indexOf(column)] };
};

describe('exportCsv', () => {
  it('writes a header and one row per book, with a BOM and CRLF', async () => {
    const { text, header, rows } = await table();
    expect(text.startsWith('﻿Title,Subtitle,Authors,ISBN-13,')).toBe(true);
    expect(text).toContain('\r\n');
    expect(header).toEqual(['Title', 'Subtitle', 'Authors', 'ISBN-13', 'ISBN-10', 'Publisher', 'Year', 'Pages', 'Format', 'Language', 'Genres', 'Series', 'Series position', 'Groups', 'Notes', 'Added']);
    expect(rows).toHaveLength(12);
  });

  it('flattens authors, genres, series and groups', async () => {
    const t = await table();
    expect(t.get('Good Omens', 'Authors')).toBe('Terry Pratchett; Neil Gaiman');
    expect(t.get('Mort', 'Series')).toBe('Discworld');
    expect(t.get('Mort', 'Series position')).toBe('4');
    expect(t.get('Mort', 'ISBN-13')).toBe('9780552131063');
    expect(t.get('Good Omens', 'Genres')).toBe('Fantasy');
    expect(t.get('Good Omens', 'Added')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('leaves the loan columns out unless asked for', async () => {
    const without = await table(false);
    expect(without.header).not.toContain('On loan to');
    expect(without.text).not.toContain('Sam');
    const withLoans = await table(true);
    expect(withLoans.header).toEqual(expect.arrayContaining(['On loan to', 'Lent on', 'Due on']));
    expect(withLoans.get('Dune', 'On loan to')).toBe('Sam');
    expect(withLoans.get('Dune', 'Due on')).toMatch(/^2026-/);
    expect(withLoans.get('Mort', 'On loan to')).toBe('');
  });

  it('quotes commas, quotes and line breaks so they survive', async () => {
    const [book] = await booksRepo.searchBooks(db, 'Mort');
    await booksRepo.updateBook(db, book.id, { notes: 'Lent twice, "never" again\nsecond line', subtitle: 'Death, and taxes' });
    const t = await table();
    expect(t.get('Mort', 'Notes')).toBe('Lent twice, "never" again\nsecond line');
    expect(t.get('Mort', 'Subtitle')).toBe('Death, and taxes');
    expect(t.text).toContain('"Lent twice, ""never"" again\nsecond line"');
  });

  it('names the file after the day', () => {
    expect(csvFileName(new Date(2026, 0, 5))).toBe('myshelf-books-2026-01-05.csv');
  });
});
