import { authorsRepo, booksRepo, coverAttemptsRepo, settingsRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { exportBackup, restoreBackup } from '@/services/backup';
import { images } from '@/services/covers/__fixtures__/images';
import { coverBatchUrl } from '@/services/covers/batchCoverIds';
import { olCoverByIdUrl } from '@/services/covers/coverUrls';
import { googleBooksRoutes } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import batch from '@/services/metadata/__fixtures__/openlibrary/search-isbn-batch.json';
import { OL_BOOKS, openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { isE2eEnabled } from '@/features/e2e/e2eFlag';
import { settleFixtureCovers } from '@/features/e2e/settleFixtureCovers';
import { loadFixture } from '@/testing/loadFixture';

import { backfillCoversNow, drainCoverBackfill, throttle } from '../index';

jest.mock('@/features/e2e/e2eFlag', () => ({ ...jest.requireActual('@/features/e2e/e2eFlag'), isE2eEnabled: jest.fn(() => false) }));

// Native storage is covered by downloadCover's own tests; here it only names the file.
jest.mock('@/services/covers/downloadCover', () => ({
  downloadCover: jest.fn(async (bookId: number) => `file:///doc/covers/${bookId}.jpg`),
  deleteCover: jest.fn(),
  isStoredCover: jest.fn(),
  storeCoverFile: jest.fn(),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.close();
});

describe('backfillCoversNow (app wiring)', () => {
  it('finds a hand-typed ISBN’s cover id with the batch search and stores the edition cover', async () => {
    await settingsRepo.setSetting(db, 'googleBooksEnabled', false);
    const book = await booksRepo.createBook(db, { title: 'The Colour of Magic', isbn13: OL_BOOKS.colourOfMagic, source: 'manual' });
    await authorsRepo.setBookAuthors(db, book.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, 'Terry Pratchett')).id }]);
    const cover = olCoverByIdUrl(14647238);
    const search = coverBatchUrl([OL_BOOKS.colourOfMagic]);
    const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes, { [search]: { body: batch }, [cover]: { bytes: images.large800 } });
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));

    await expect(backfillCoversNow(db)).resolves.toEqual({ checked: 1, attached: 1, none: 0, failed: 0, offline: false });

    expect(fixtures.unmocked).toEqual([]);
    expect(fixtures.calls.some((u) => u.includes('googleapis') || u.includes('books.google'))).toBe(false);
    // One search and the cover: no edition, work or author lookups.
    expect(fixtures.calls).toEqual([search, cover]);
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBe(`file:///doc/covers/${book.id}.jpg`);
    expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
  });
});

describe('fixture books in an E2E build', () => {
  it('are never searched for, even once any backoff would have run out', async () => {
    jest.mocked(isE2eEnabled).mockReturnValue(true);
    await loadFixture(db, 'demo');
    expect(await settleFixtureCovers(db)).toBe(1);
    // Forty days on (the backup reminder journey): any backoff is long over.
    await db.run("UPDATE cover_attempts SET retry_after = '2000-01-01T00:00:00.000Z'");
    const fixtures = createFixtureFetch({});
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));
    const list = jest.spyOn(coverAttemptsRepo, 'listBooksNeedingCover');
    await expect(backfillCoversNow(db)).resolves.toEqual({ checked: 0, attached: 0, none: 0, failed: 0, offline: false });
    expect(fixtures.calls).toEqual([]);
    expect(list).toHaveBeenLastCalledWith(db, expect.objectContaining({ skipFixtureBooks: true }));

    // A release build (no fixture loader) passes no such flag.
    jest.mocked(isE2eEnabled).mockReturnValue(false);
    list.mockResolvedValueOnce([]);
    await backfillCoversNow(db);
    expect(list).toHaveBeenLastCalledWith(db, expect.objectContaining({ skipFixtureBooks: false }));
  });
});

describe('drainCoverBackfill after a restore (P08-03)', () => {
  it('brings back real covers for books whose covers stayed on the old phone, announcing them as they come', async () => {
    const books = [
      { title: 'Good Omens', isbn13: '9780060853983', cover: 10482245 },
      { title: 'The Hobbit', isbn13: '9780547928227', cover: 14624642 },
      { title: '1984', isbn13: '9780451524935', cover: 15257452 },
    ];
    const oldPhone = await createTestDb();
    for (const b of books) await booksRepo.createBook(oldPhone, { title: b.title, isbn13: b.isbn13, source: 'manual', coverUri: `file:///old/covers/${b.title}.jpg` });
    const backup = await exportBackup(oldPhone, { appVersion: 'test' });
    await oldPhone.close();
    await restoreBackup(db, backup, { mode: 'replace', openScratch: () => openNodeDatabase() });
    expect((await booksRepo.listBooks(db)).map((b) => b.coverUri)).toEqual([null, null, null]);

    await settingsRepo.setSetting(db, 'googleBooksEnabled', false);
    const search = coverBatchUrl(books.map((b) => b.isbn13));
    const covers = books.map((b) => olCoverByIdUrl(b.cover));
    const fixtures = createFixtureFetch({ [search]: { body: batch } }, Object.fromEntries(covers.map((u) => [u, { bytes: images.large800 }])));
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));
    const onAttached = jest.fn();

    await expect(drainCoverBackfill(db, { onAttached })).resolves.toBe(3);

    expect(fixtures.unmocked).toEqual([]);
    expect(fixtures.calls).toEqual([search, ...covers.reverse()]); // newest first
    expect((await booksRepo.listBooks(db)).every((b) => b.coverUri?.startsWith('file:///doc/covers/'))).toBe(true);
    // At once for the first cover, then throttled, and once more at the end: never more than one per cover.
    expect(onAttached.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(onAttached.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls at once, then at most once per interval, and flushes a pending call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 500);
    t.call();
    expect(fn).toHaveBeenCalledTimes(1);
    t.call();
    t.call();
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2); // the calls made while waiting, as one
    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    t.call();
    expect(fn).toHaveBeenCalledTimes(3);
    t.call();
    t.flush();
    expect(fn).toHaveBeenCalledTimes(4);
    jest.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

