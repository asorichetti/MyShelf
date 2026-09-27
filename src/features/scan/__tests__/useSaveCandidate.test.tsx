import { act, renderHook } from '@testing-library/react-native';

import { BookyProvider, useBooky } from '@/components/booky';
import { booksRepo, pendingLookupsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { attachCoverFromCandidate } from '@/features/covers';
import { subscribe } from '@/features/events';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { makeCandidate } from '@/services/metadata/candidate';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata } from '@/testing/fixtureMetadata';

import { bookAddedEvent, isBookMilestone, saveCandidate, useSaveCandidate } from '../useSaveCandidate';

import type { ReactNode } from 'react';

jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  jest.mocked(attachCoverFromCandidate).mockReset();
});
afterEach(() => db.close());

async function colourOfMagic() {
  return (await createFixtureMetadata().service.lookupIsbn(OL_BOOKS.colourOfMagic)).candidates[0];
}

describe('saveCandidate (P03-09)', () => {
  it('saves the book, links its series and stores its real cover afterwards', async () => {
    jest.mocked(attachCoverFromCandidate).mockImplementation(async (d, id) => {
      await booksRepo.updateBook(d, id, { coverUri: 'https://covers.openlibrary.org/b/id/1-L.jpg' });
      return { status: 'attached', coverUri: 'https://covers.openlibrary.org/b/id/1-L.jpg', cover: {} as never };
    });
    const changed = jest.fn();
    const off = subscribe('library-changed', changed);
    const saved = await saveCandidate(db, await colourOfMagic());
    expect(saved).toMatchObject({ title: 'The Colour of Magic', count: 1 });
    const book = await booksRepo.getBookDetail(db, saved.id);
    expect(book?.series?.name).toBe('Discworld');
    expect(book?.seriesPosition).toBe(1);
    expect(book?.source).toBe('openlibrary');
    await expect(saved.cover).resolves.toMatchObject({ status: 'attached' });
    expect((await booksRepo.getBook(db, saved.id))?.coverUri).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
    expect(changed).toHaveBeenCalledTimes(2); // the save, then the cover
    off();
  });

  it('takes a book scanned offline out of the queue once it is saved', async () => {
    jest.mocked(attachCoverFromCandidate).mockResolvedValue({ status: 'none', tried: [] });
    await pendingLookupsRepo.enqueue(db, OL_BOOKS.colourOfMagic);
    const pendingChanged = jest.fn();
    const off = subscribe('pending-changed', pendingChanged);
    await saveCandidate(db, await colourOfMagic());
    expect(await pendingLookupsRepo.list(db)).toEqual([]);
    expect(pendingChanged).toHaveBeenCalledTimes(1);
    off();
  });

  it('a cover that cannot be fetched leaves the book saved with its generated cover', async () => {
    jest.mocked(attachCoverFromCandidate).mockRejectedValue(new Error('network down'));
    const saved = await saveCandidate(db, await colourOfMagic());
    await expect(saved.cover).resolves.toBeNull();
    expect((await booksRepo.getBook(db, saved.id))?.coverUri).toBeNull();
    expect(await booksRepo.countBooks(db)).toBe(1);
  });

  it('tells the caller when no online cover exists (for the cover photo, P03-14)', async () => {
    jest.mocked(attachCoverFromCandidate).mockResolvedValue({ status: 'none', tried: [] });
    const onNoOnlineCover = jest.fn();
    const saved = await saveCandidate(db, await colourOfMagic(), { onNoOnlineCover });
    await saved.cover;
    expect(onNoOnlineCover).toHaveBeenCalledWith(saved.id);
  });

  it('reuses an existing series, case-insensitively', async () => {
    jest.mocked(attachCoverFromCandidate).mockResolvedValue({ status: 'none', tried: [] });
    const first = await saveCandidate(db, await colourOfMagic());
    const mort = makeCandidate({ title: 'Mort', source: 'openlibrary', sourceId: 'OL2M', seriesHints: [{ name: 'discworld', position: 4, source: 'openlibrary' }] });
    const second = await saveCandidate(db, mort);
    const a = await booksRepo.getBook(db, first.id);
    const b = await booksRepo.getBook(db, second.id);
    expect(b?.seriesId).toBe(a?.seriesId);
    expect(b?.seriesPosition).toBe(4);
  });
});

describe('useSaveCandidate', () => {
  it('Booky is excited: "Shelved! That’s N books."', async () => {
    jest.mocked(attachCoverFromCandidate).mockResolvedValue({ status: 'none', tried: [] });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StaticDatabaseProvider db={db}>
        <BookyProvider>{children}</BookyProvider>
      </StaticDatabaseProvider>
    );
    const { result } = renderHook(() => ({ save: useSaveCandidate().save, booky: useBooky() }), { wrapper });
    const candidate = await colourOfMagic();
    await act(async () => {
      await result.current.save(candidate);
    });
    expect(result.current.booky.tip).toMatchObject({ tip: { id: 'book-added', expression: 'excited' }, text: 'Shelved! That’s 1 book.' });
    expect(bookAddedEvent(12)).toEqual({ type: 'book-added', variant: undefined, vars: { books: '12 books' } });
    expect(bookAddedEvent(50).variant).toBe('milestone');
    expect([10, 50, 100, 300].every(isBookMilestone)).toBe(true);
    expect([1, 11, 150].some(isBookMilestone)).toBe(false);
  });
});
