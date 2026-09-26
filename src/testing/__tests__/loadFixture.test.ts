/**
 * @jest-environment node
 */
import { booksRepo, libraryRepo, loansRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import { isValidIsbn13, setToday } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { fixtureNames, fixtures, isFixtureName } from '@/testing/fixtures';
import { BROKEN_COVER } from '@/testing/fixtures/demo';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  setToday(null);
  await db.close();
});

describe('loadFixture', () => {
  it('knows the empty, first-run, demo, large, huge and series fixtures', () => {
    expect(fixtureNames).toEqual(['empty', 'first-run', 'demo', 'large', 'huge', 'series']);
    expect(isFixtureName('demo')).toBe(true);
    expect(isFixtureName('toString')).toBe(false);
    expect(isFixtureName('nope')).toBe(false);
  });

  it('first-run: no books, and the onboarding still to come; other fixtures skip it', async () => {
    await loadFixture(db, 'first-run');
    expect(await booksRepo.countBooks(db)).toBe(0);
    expect(await settingsRepo.getSetting(db, 'onboarding.done')).toBe(false);
    await loadFixture(db, 'demo');
    expect(await settingsRepo.getSetting(db, 'onboarding.done')).toBeNull();
  });

  it('empty: nothing in any table', async () => {
    await loadFixture(db, 'empty');
    expect(Object.values(await libraryRepo.countRows(db)).every((n) => n === 0)).toBe(true);
  });

  it('demo: the documented shape, row by row', async () => {
    await loadFixture(db, 'demo');
    expect(await libraryRepo.countRows(db)).toEqual({
      books: 12,
      authors: 7,
      book_authors: 13,
      genres: 4,
      book_genres: 13,
      series: 2,
      borrowers: 2,
      loans: 3,
      groups: 1,
      group_books: 3,
    });
  });

  it('demo: series gaps, loans relative to a frozen today, valid ISBNs', async () => {
    setToday('2026-06-15');
    await loadFixture(db, 'demo');
    const series = await seriesRepo.listSeries(db);
    const positions = await Promise.all(
      series.map(async (s) => [s.name, (await seriesRepo.listBooksInSeries(db, s.id)).map((b) => b.seriesPosition)]),
    );
    expect(Object.fromEntries(positions)).toEqual({ Discworld: [1, 2, 4], Earthsea: [1, 3] });

    const open = await loansRepo.listOpenLoans(db);
    expect(open.map((l) => [l.bookTitle, l.borrowerName, l.dueOn])).toEqual([
      ['The Murder of Roger Ackroyd', 'Priya', '2026-06-10'],
      ['Dune', 'Sam', '2026-06-26'],
    ]);
    expect((await loansRepo.listOverdueLoans(db, '2026-06-15')).map((l) => l.bookTitle)).toEqual(['The Murder of Roger Ackroyd']);

    const books = await booksRepo.listBooks(db);
    // Real covers are the norm; one book has none and one a broken URL, to prove the fallback.
    expect(books.filter((b) => b.coverUri?.startsWith('https://covers.openlibrary.org/'))).toHaveLength(11);
    expect(books.filter((b) => b.coverUri == null).map((b) => b.title)).toEqual(['The Farthest Shore']);
    expect(books.filter((b) => b.coverUri === BROKEN_COVER).map((b) => b.title)).toEqual(['The Murder of Roger Ackroyd']);
    for (const book of books) {
      expect(isValidIsbn13(book.isbn13!)).toBe(true);
      expect(book.isbn10).toHaveLength(10);
      expect(book.source).toBe('manual');
    }
  });

  it('large: 2,000 books', async () => {
    await loadFixture(db, 'large');
    const counts = await libraryRepo.countRows(db);
    expect(counts.books).toBe(2000);
    expect(counts.book_authors).toBe(2000);
    expect(counts.authors).toBe(200);
    expect(counts.series).toBe(40);
  }, 30_000);

  it('huge: 10,000 books, the large pattern with notes', async () => {
    await loadFixture(db, 'huge');
    const counts = await libraryRepo.countRows(db);
    expect(counts.books).toBe(10_000);
    expect(counts.authors).toBe(200);
    expect(counts.series).toBe(40);
    expect(fixtures.huge.books.slice(0, 2000).map((b) => b.title)).toEqual(fixtures.large.books.map((b) => b.title));
    expect(fixtures.huge.books.filter((b) => b.notes).length).toBe(Math.ceil(10_000 / 7));
  }, 60_000);

  it('replaces the previous library but keeps settings', async () => {
    await settingsRepo.setSetting(db, 'bookyMode', 'quiet');
    await loadFixture(db, 'demo');
    await loadFixture(db, 'demo');
    expect(await booksRepo.countBooks(db)).toBe(12);
    await loadFixture(db, 'empty');
    expect(await booksRepo.countBooks(db)).toBe(0);
    expect(await settingsRepo.getSetting(db, 'bookyMode')).toBe('quiet');
  });

  it('runs in one transaction: a failure leaves the old library in place', async () => {
    await loadFixture(db, 'demo');
    const broken = fixtures.empty;
    const saved = broken.loans;
    broken.loans = [{ book: 'No such book', borrower: 'Sam', lentDaysAgo: 1 }];
    try {
      await expect(loadFixture(db, 'empty')).rejects.toThrow(/No such book/);
    } finally {
      broken.loans = saved;
    }
    expect(await booksRepo.countBooks(db)).toBe(12);
  });
});
