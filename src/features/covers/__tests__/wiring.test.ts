import { authorsRepo, booksRepo, coverAttemptsRepo, settingsRepo, type Db } from '@/db';
import { images } from '@/services/covers/__fixtures__/images';
import { olCoverByIdUrl } from '@/services/covers/coverUrls';
import { googleBooksRoutes } from '@/services/metadata/__fixtures__/googleBooksRoutes';
import { OL_BOOKS, openLibraryRoutes } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { backfillCoversNow } from '../index';

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
  it('looks up a hand-typed ISBN through the app services and stores the edition cover', async () => {
    await settingsRepo.setSetting(db, 'googleBooksEnabled', false);
    const book = await booksRepo.createBook(db, { title: 'The Colour of Magic', isbn13: OL_BOOKS.colourOfMagic, source: 'manual' });
    await authorsRepo.setBookAuthors(db, book.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, 'Terry Pratchett')).id }]);
    const cover = olCoverByIdUrl(14647238);
    const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes, { [cover]: { bytes: images.large800 } });
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));

    await expect(backfillCoversNow(db)).resolves.toEqual({ checked: 1, attached: 1, none: 0, failed: 0, offline: false });

    expect(fixtures.unmocked).toEqual([]);
    expect(fixtures.calls.some((u) => u.includes('googleapis') || u.includes('books.google'))).toBe(false);
    expect(fixtures.calls[fixtures.calls.length - 1]).toBe(cover);
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBe(`file:///doc/covers/${book.id}.jpg`);
    expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
  });
});
