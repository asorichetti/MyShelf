import { act, renderHook, waitFor } from '@testing-library/react-native';

import { booksRepo, settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
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
});
