/**
 * @jest-environment node
 */
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { authorsRepo, backupRepo, booksRepo, genresRepo, LATEST_VERSION, libraryRepo, migrate, seriesRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { callNumberSortKey, ensureSortKeys, getCallNumber, SORT_KEY_RULES } from '@/db/sortKeyStore';
import { CALL_NUMBER_RULES, callNumber, draftFromDetail, setToday, sortableTitle, stripDiacritics, validateBookDraft, type BookDetail, type ValidBookDraft } from '@/domain';
import { exportBackup, importPlannedBooks, mappingFor, parseBackup, planImport, readCsvTable, restoreBackup, serializeBackup, undoRestore } from '@/services/backup';
import { createTestDb } from '@/testing/createTestDb';
import type { Fixture } from '@/testing/fixtures';
import { loadFixture } from '@/testing/loadFixture';
import { oneKey } from '@/testing/sorts';

/** Accents in titles, authors, genres and series; a co-written book; two genres; a book with nothing but a title. */
const library: Fixture = {
  books: [
    { title: 'The Colour of Magic', authors: ['Terry Pratchett'], genres: ['Fantasy'], series: { name: 'Discworld', position: 1 }, publicationYear: 1983 },
    { title: 'Mort', authors: ['Terry Pratchett'], genres: ['Fantasy', 'Humour'], series: { name: 'Discworld', position: 4 }, publicationYear: 1987 },
    { title: 'Good Omens', authors: ['Terry Pratchett', 'Neil Gaiman'], genres: ['Fantasy'], publicationYear: 1990 },
    { title: 'Émile', authors: ['Jean-Jacques Rousseau'], genres: ['Philosophy', 'Éducation'], publicationYear: 1762 },
    { title: 'Fjord', authors: ['Lise Øster'], genres: ['Fiction'], series: { name: 'Ångström Cycle', position: 2 } },
    { title: 'A Memoir', authors: ['Virginia Roberts Giuffre'], genres: ['Memoir', 'Fiction'], publicationYear: 2025 },
    { title: 'Untitled Notes' },
  ],
};

/** The stored rows, as SQL holds them. */
const stored = (db: Db) =>
  db.all<Record<string, unknown>>('SELECT book_id, rules, title, author, author_names, genre, series, call_number, call_key FROM book_sort_keys ORDER BY book_id');

/** Case and accents folded, as the stored keys fold them (for the letters this library uses). */
const fold = (s: string) => stripDiacritics(s).toLowerCase();
const lower = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : s);

/** What each stored value should be, worked out from the book page's data. */
function expectedFor(d: BookDetail) {
  const first = d.authors[0];
  return {
    title: fold(sortableTitle(d.title)),
    author: first ? fold(first.sortName ?? first.name) : null,
    author_names: d.authors.length ? d.authors.map((a) => a.name).join('\u001f') : null,
    genre: d.genres.length ? fold(d.genres[0].name) : null,
    series: d.series ? fold(d.series.name) : null,
    call_number: callNumber({ genres: d.genres.map((g) => g.name), author: first ? (first.sortName ?? first.name) : null, title: d.title, year: d.publicationYear }),
  };
}

/**
 * The stored keys are current: one row per book, each the same as a row
 * made from nothing (so no trigger missed a change), each what the book's
 * own data says, and the page prints the call number the sort uses.
 */
async function expectCurrent(db: Db): Promise<void> {
  await ensureSortKeys(db);
  const rows = await stored(db);
  const books = await db.all<{ id: number }>('SELECT id FROM books ORDER BY id');
  expect(rows.map((r) => r.book_id)).toEqual(books.map((b) => b.id));

  await db.run('UPDATE book_sort_keys SET rules = 0');
  await ensureSortKeys(db);
  expect(await stored(db)).toEqual(rows);

  for (const row of rows) {
    const d = (await booksRepo.getBookDetail(db, row.book_id as number))!;
    const want = expectedFor(d);
    expect({ id: d.id, ...row, title: lower(row.title), author: lower(row.author), genre: lower(row.genre), series: lower(row.series) }).toMatchObject({ id: d.id, ...want });
    expect(d.callNumber).toBe(row.call_number);
    expect(row.call_key).toBe(callNumberSortKey(want.call_number));
  }
}

let db: Db;
let ids: Map<string, number>;
beforeEach(async () => {
  setToday('2026-06-20');
  db = await createTestDb();
  await loadFixture(db, library);
  ids = new Map((await booksRepo.listBooks(db)).map((b) => [b.title, b.id]));
  // Made now, so each test's first change has rows to mark.
  await ensureSortKeys(db);
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

const id = (title: string) => {
  const found = ids.get(title);
  if (found == null) throw new Error(`No book "${title}"`);
  return found;
};

async function formDraft(bookId: number, patch: Partial<ValidBookDraft>): Promise<ValidBookDraft> {
  const v = validateBookDraft(draftFromDetail((await booksRepo.getBookDetail(db, bookId))!));
  if (!v.ok) throw new Error('invalid draft');
  return { ...v.value, ...patch };
}

const titles = async (key: Parameters<typeof oneKey>[0]) => (await booksRepo.listBookItems(db, { sort: oneKey(key) })).map((b) => b.title);

describe('book_sort_keys', () => {
  it('holds every book’s keys once a list is read', async () => {
    await expectCurrent(db);
    const rows = await stored(db);
    const mort = rows.find((r) => r.book_id === id('Mort'))!;
    expect(mort).toMatchObject({ title: 'Mort', author: 'Pratchett, Terry', genre: 'Fantasy', series: 'Discworld', call_number: 'FIC PRA 1987' });
    expect(rows.find((r) => r.book_id === id('Good Omens'))!.author_names).toBe('Terry Pratchett\u001fNeil Gaiman');
    // Folded letters come out in lower case (compared ignoring case); the primary genre is the first by name, as the book page lists them.
    expect(rows.find((r) => r.book_id === id('Émile'))).toMatchObject({ title: 'emile', genre: 'Philosophy' });
    expect(rows.find((r) => r.book_id === id('Untitled Notes'))).toMatchObject({ author: null, author_names: null, genre: null, series: null, call_number: 'GEN UNT' });
  });

  it('marks a book out of date on every write that changes what its keys are made from, and only then', async () => {
    await expectCurrent(db);
    const pending = async () => (await db.all<{ book_id: number }>('SELECT book_id FROM book_sort_keys WHERE rules = 0 ORDER BY book_id')).map((r) => r.book_id);
    await booksRepo.setRating(db, id('Mort'), 5);
    await booksRepo.updateBook(db, id('Mort'), { notes: 'Signed', pageCount: 300 });
    expect(await pending()).toEqual([]);
    await booksRepo.updateBook(db, id('Mort'), { title: 'Mort' });
    expect(await pending()).toEqual([]);
    await booksRepo.updateBook(db, id('Mort'), { publicationYear: 1988 });
    expect(await pending()).toEqual([id('Mort')]);
  });

  describe('stays current through', () => {
    it('the form: title, year, authors, genres and series', async () => {
      await booksRepo.saveBookDraft(db, await formDraft(id('Mort'), { title: 'The Mort', publicationYear: 1988 }), id('Mort'));
      await expectCurrent(db);
      await booksRepo.saveBookDraft(
        db,
        await formDraft(id('Mort'), { authors: [{ name: 'Neil Gaiman', sortName: null, role: 'author' }, { name: 'Terry Pratchett', sortName: null, role: 'author' }] }),
        id('Mort'),
      );
      await expectCurrent(db);
      await booksRepo.saveBookDraft(db, await formDraft(id('Mort'), { genres: ['Humour', 'Biography'], series: { name: 'Death', position: 1 } }), id('Mort'));
      await expectCurrent(db);
      await booksRepo.saveBookDraft(db, await formDraft(id('Mort'), { genres: [], series: null, authors: [] }), id('Mort'));
      await expectCurrent(db);
      expect((await booksRepo.getBookDetail(db, id('Mort')))!.callNumber).toBe('GEN MOR 1988');
      const added = await booksRepo.saveBookDraft(db, await formDraft(id('Fjord'), { title: 'Fjord Two' }));
      await expectCurrent(db);
      expect(added).toBeGreaterThan(0);
    });

    it('renaming an author or changing a sort name, merging and deleting authors', async () => {
      const pratchett = (await authorsRepo.findAuthorByName(db, 'Terry Pratchett'))!;
      await authorsRepo.updateAuthor(db, pratchett.id, { sortName: 'Zzz, Terry' });
      await expectCurrent(db);
      await authorsRepo.updateAuthor(db, pratchett.id, { name: 'Sir Terry Pratchett' });
      await expectCurrent(db);
      const gaiman = (await authorsRepo.findAuthorByName(db, 'Neil Gaiman'))!;
      await authorsRepo.mergeAuthors(db, pratchett.id, gaiman.id);
      await expectCurrent(db);
      expect((await stored(db)).find((r) => r.book_id === id('Good Omens'))!.author_names).toBe('Neil Gaiman');
      await authorsRepo.deleteAuthor(db, gaiman.id);
      await expectCurrent(db);
      expect((await booksRepo.getBookDetail(db, id('Mort')))!.callNumber).toBe('FIC MOR 1987');
    });

    it('setting, renaming, merging and deleting genres', async () => {
      const bio = await genresRepo.findOrCreateGenre(db, 'Biography');
      await genresRepo.addBookGenre(db, id('Mort'), bio.id);
      await expectCurrent(db);
      const fantasy = (await genresRepo.findGenreByName(db, 'Fantasy'))!;
      await genresRepo.renameGenre(db, fantasy.id, 'Ævintýri');
      await expectCurrent(db);
      const humour = (await genresRepo.findGenreByName(db, 'Humour'))!;
      await genresRepo.mergeGenres(db, humour.id, fantasy.id);
      await expectCurrent(db);
      await genresRepo.removeBookGenre(db, id('Mort'), bio.id);
      await expectCurrent(db);
      await genresRepo.setBookGenres(db, id('Untitled Notes'), [bio.id]);
      await expectCurrent(db);
      await genresRepo.deleteGenre(db, fantasy.id);
      await expectCurrent(db);
      expect((await stored(db)).find((r) => r.book_id === id('Mort'))).toMatchObject({ genre: null, call_number: 'GEN PRA 1987' });
    });

    it('setting, renaming, merging and deleting series', async () => {
      const discworld = (await seriesRepo.findSeriesByName(db, 'Discworld'))!;
      await seriesRepo.renameSeries(db, discworld.id, 'Ånkh-Morpork');
      await expectCurrent(db);
      await seriesRepo.setBookSeries(db, id('Good Omens'), discworld.id, 2);
      await expectCurrent(db);
      const cycle = (await seriesRepo.findSeriesByName(db, 'Ångström Cycle'))!;
      await seriesRepo.mergeSeries(db, cycle.id, discworld.id);
      await expectCurrent(db);
      await seriesRepo.deleteSeries(db, discworld.id);
      await expectCurrent(db);
      expect((await stored(db)).every((r) => r.series === null)).toBe(true);
    });

    it('an author or genre link changed in place (reordered, moved to another book or genre)', async () => {
      const [gaiman] = (await db.all<{ author_id: number }>('SELECT author_id FROM book_authors WHERE book_id = ? AND position = 1', [id('Good Omens')])).map((r) => r.author_id);
      await db.run('UPDATE book_authors SET position = -1 WHERE book_id = ? AND author_id = ?', [id('Good Omens'), gaiman]);
      await expectCurrent(db);
      expect((await stored(db)).find((r) => r.book_id === id('Good Omens'))).toMatchObject({ author: 'Gaiman, Neil', author_names: 'Neil Gaiman\u001fTerry Pratchett' });
      await db.run('UPDATE book_authors SET book_id = ? WHERE book_id = ? AND author_id = ?', [id('Untitled Notes'), id('Good Omens'), gaiman]);
      await expectCurrent(db);
      const humour = (await genresRepo.findGenreByName(db, 'Humour'))!;
      const fantasy = (await genresRepo.findGenreByName(db, 'Fantasy'))!;
      await db.run('UPDATE book_genres SET genre_id = ? WHERE book_id = ? AND genre_id = ?', [humour.id, id('Good Omens'), fantasy.id]);
      await expectCurrent(db);
      await db.run('UPDATE book_genres SET book_id = ? WHERE book_id = ?', [id('Untitled Notes'), id('Good Omens')]);
      await expectCurrent(db);
    });

    it('deleting a book and undoing it', async () => {
      const snapshot = (await booksRepo.removeBook(db, id('Good Omens')))!;
      await expectCurrent(db);
      await booksRepo.restoreBook(db, snapshot);
      await expectCurrent(db);
      expect((await stored(db)).find((r) => r.book_id === id('Good Omens'))!.author_names).toBe('Terry Pratchett\u001fNeil Gaiman');
    });

    it('a CSV import', async () => {
      const table = readCsvTable(readFileSync(join(__dirname, '../../services/backup/__fixtures__/goodreads_library_export.csv'), 'utf8'));
      const report = await importPlannedBooks(db, planImport(table.rows, mappingFor(table.headers, table.preset)));
      expect(report.imported).toBeGreaterThan(10);
      await expectCurrent(db);
    });

    it('restoring a backup (replace, merge and undo) and erasing the library', async () => {
      const other = await createTestDb();
      await loadFixture(other, 'demo');
      const backup = parseBackup(serializeBackup(await exportBackup(other, { appVersion: '1' })), { currentSchemaVersion: LATEST_VERSION });
      await other.close();
      const replaced = await restoreBackup(db, backup, { mode: 'replace' });
      await expectCurrent(db);
      await undoRestore(db, replaced.safetyCopy!.id);
      await expectCurrent(db);
      await restoreBackup(db, backup, { mode: 'merge' });
      await expectCurrent(db);
      expect(await backupRepo.countTables(db)).not.toHaveProperty('book_sort_keys');
      await libraryRepo.eraseLibrary(db);
      await expectCurrent(db);
      expect(await stored(db)).toEqual([]);
    });
  });

  it('sorts and prints the call number from the same stored value', async () => {
    const got = await titles('callNumber');
    const calls = await Promise.all(got.map(async (t) => (await getCallNumber(db, id(t)))!));
    expect(calls).toEqual([
      'BIO GIU 2025', // A Memoir: Memoir wins over Fiction
      'FIC OST', // Fjord (Øster)
      'FIC PRA 1983',
      'FIC PRA 1987',
      'FIC PRA 1990',
      'GEN UNT',
      'PHI ROU 1762',
    ]);
    for (const t of got) expect((await booksRepo.getBookDetail(db, id(t)))!.callNumber).toBe(calls[got.indexOf(t)]);
  });

  it('makes every row again when the rules change', async () => {
    await expectCurrent(db);
    await db.run("UPDATE book_sort_keys SET rules = rules - 1, call_number = 'OLD', title = 'old'");
    expect(await titles('title')).toEqual(['The Colour of Magic', 'Émile', 'Fjord', 'Good Omens', 'A Memoir', 'Mort', 'Untitled Notes']);
    expect((await stored(db)).every((r) => r.rules === SORT_KEY_RULES + CALL_NUMBER_RULES && r.call_number !== 'OLD')).toBe(true);
  });

  it('forgets rows left behind by a book that is gone', async () => {
    await db.run('INSERT INTO book_sort_keys (book_id) VALUES (999999)');
    await ensureSortKeys(db);
    expect(await db.get('SELECT 1 AS n FROM book_sort_keys WHERE book_id = 999999')).toBeNull();
  });
});

describe('callNumberSortKey', () => {
  it('orders class, then mark, then year as a number, with no year last', () => {
    const calls = ['GN ABC 2001', 'GEN ZZZ', 'FIC PRA', 'FIC PRA 1983', 'FIC PR 2000', 'FIC PRA -500', 'FIC PRA 20000', 'FI ZZZ 1', 'FIC PRA 999'];
    const sorted = [...calls].sort((a, b) => (callNumberSortKey(a) < callNumberSortKey(b) ? -1 : 1));
    expect(sorted).toEqual(['FI ZZZ 1', 'FIC PR 2000', 'FIC PRA -500', 'FIC PRA 999', 'FIC PRA 1983', 'FIC PRA 20000', 'FIC PRA', 'GEN ZZZ', 'GN ABC 2001']);
  });
});

describe('a fresh database', () => {
  it('works on web’s SQLite stand-in with nothing in it', async () => {
    const empty = await openNodeDatabase();
    await migrate(empty);
    expect(await booksRepo.listBookItems(empty)).toEqual([]);
    await empty.close();
  });
});
