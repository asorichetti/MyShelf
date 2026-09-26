import { act, renderHook, waitFor } from '@testing-library/react-native';

import { booksRepo, settingsRepo, shelfSectionsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { emit } from '@/features/events';
import { SEARCH_DEBOUNCE_MS, useShelf } from '@/features/shelf/useShelf';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

async function renderShelf() {
  const hook = renderHook(() => useShelf(), { wrapper });
  await waitFor(() => expect(hook.result.current.items).toHaveLength(12));
  return hook;
}

describe('useShelf', () => {
  it('loads every book and the catalogue size, sorted by title', async () => {
    const { result } = await renderShelf();
    expect(result.current.total).toBe(12);
    expect(result.current.sort).toEqual({ sort: 'title', direction: 'asc' });
    expect(result.current.items![0].title).toBe('The Colour of Magic');
  });

  it('searches after the debounce', async () => {
    const { result } = await renderShelf();
    act(() => result.current.setQuery('prat'));
    expect(result.current.query).toBe('prat');
    expect(result.current.items).toHaveLength(12);
    await waitFor(() => expect(result.current.items).toHaveLength(4), { timeout: SEARCH_DEBOUNCE_MS * 5 });
    expect(result.current.activeQuery).toBe('prat');
    expect(result.current.total).toBe(12);
  });

  it('changes the sort and remembers it in settings', async () => {
    const { result } = await renderShelf();
    act(() => result.current.setSort({ sort: 'year', direction: 'desc' }));
    await waitFor(() => expect(result.current.items![0].title).toBe('Good Omens'));
    await waitFor(async () => expect(await settingsRepo.getSetting(db, 'shelfSort')).toEqual({ sort: 'year', direction: 'desc' }));
  });

  it('starts from the saved sort', async () => {
    await settingsRepo.setSetting(db, 'shelfSort', { sort: 'author', direction: 'asc' });
    const { result } = await renderShelf();
    expect(result.current.sort).toEqual({ sort: 'author', direction: 'asc' });
    expect(result.current.items![0].authors[0]).toBe('Jane Austen');
  });

  it('reloads when the library changes', async () => {
    const { result } = await renderShelf();
    await booksRepo.createBook(db, { title: 'Aardvarks' });
    await act(async () => emit('library-changed'));
    await waitFor(() => expect(result.current.items).toHaveLength(13));
    expect(result.current.total).toBe(13);
    expect(result.current.items![0].title).toBe('Aardvarks');
  });

  it('shows each reload as it arrives, even while a newer one is still loading', async () => {
    const { result } = await renderShelf();
    const real = shelfSectionsRepo.listShelfSections;
    const held: (() => void)[] = [];
    const spy = jest.spyOn(shelfSectionsRepo, 'listShelfSections').mockImplementation((...args) => {
      const answer = real(...args);
      return new Promise((resolve) => held.push(() => resolve(answer)));
    });
    try {
      await booksRepo.createBook(db, { title: 'Aardvarks' });
      await act(async () => emit('library-changed'));
      await booksRepo.createBook(db, { title: 'Aardwolves' });
      await act(async () => emit('library-changed'));
      await waitFor(() => expect(held).toHaveLength(2));
      // The first reload answers while the second is still loading: it is shown, not thrown away.
      await act(async () => held[0]());
      await waitFor(() => expect(result.current.items).toHaveLength(13));
      await act(async () => held[1]());
      await waitFor(() => expect(result.current.items).toHaveLength(14));
    } finally {
      spy.mockRestore();
    }
  });

  it('drops a late answer for a search that has since changed', async () => {
    const { result } = await renderShelf();
    const real = shelfSectionsRepo.listShelfSections;
    const held: (() => void)[] = [];
    const spy = jest.spyOn(shelfSectionsRepo, 'listShelfSections').mockImplementation((...args) => {
      const answer = real(...args);
      return new Promise((resolve) => held.push(() => resolve(answer)));
    });
    try {
      act(() => result.current.setSort({ sort: 'year', direction: 'desc' }));
      await waitFor(() => expect(held).toHaveLength(1));
      act(() => result.current.setSort({ sort: 'title', direction: 'desc' }));
      await waitFor(() => expect(held).toHaveLength(2));
      await act(async () => held[1]());
      await waitFor(() => expect(result.current.items![0].title).not.toBe('The Colour of Magic'));
      const newest = result.current.items![0].title;
      await act(async () => held[0]());
      expect(result.current.items![0].title).toBe(newest);
    } finally {
      spy.mockRestore();
    }
  });
});

