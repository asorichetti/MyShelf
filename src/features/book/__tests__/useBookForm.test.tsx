import { act, renderHook, waitFor } from '@testing-library/react-native';

import { booksRepo, StaticDatabaseProvider, type Db } from '@/db';
import { useBookForm } from '@/features/book/useBookForm';
import { subscribe } from '@/features/events';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

describe('useBookForm', () => {
  it('starts empty and clean for a new book', async () => {
    const { result } = renderHook(() => useBookForm(null), { wrapper });
    await act(async () => {});
    expect(result.current.status).toBe('ready');
    expect(result.current.draft.title).toBe('');
    expect(result.current.dirty).toBe(false);
  });

  it('saves a new book, including a typed-but-not-added author and genre, and emits library-changed', async () => {
    const changed = jest.fn();
    const off = subscribe('library-changed', changed);
    const { result } = renderHook(() => useBookForm(null), { wrapper });
    await act(async () => {});
    act(() => {
      result.current.setField('title', 'The Hobbit');
      result.current.setField('year', '1937');
      result.current.setAuthorText('J. R. R. Tolkien');
      result.current.setGenreText('Fantasy');
    });
    expect(result.current.dirty).toBe(true);
    let saved: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      saved = await result.current.submit();
    });
    expect(saved).toMatchObject({ ok: true, title: 'The Hobbit' });
    const detail = (await booksRepo.getBookDetail(db, (saved as { id: number }).id))!;
    expect(detail).toMatchObject({ title: 'The Hobbit', publicationYear: 1937, source: 'manual' });
    expect(detail.authors.map((a) => a.name)).toEqual(['J. R. R. Tolkien']);
    expect(detail.genres.map((g) => g.name)).toEqual(['Fantasy']);
    expect(changed).toHaveBeenCalled();
    expect(result.current.dirty).toBe(false);
    off();
  });

  it('blocks an invalid ISBN, reports the first invalid field and saves nothing', async () => {
    const { result } = renderHook(() => useBookForm(null), { wrapper });
    await act(async () => {});
    act(() => {
      result.current.setField('title', 'Mystery');
      result.current.setField('isbn', '9780000000000');
    });
    let res: Awaited<ReturnType<typeof result.current.submit>> | undefined;
    await act(async () => {
      res = await result.current.submit();
    });
    expect(res).toEqual({ ok: false, firstInvalid: 'isbn' });
    expect(result.current.errors.isbn).toMatch(/check the last digit/);
    expect(await booksRepo.countBooks(db)).toBe(0);
    // Fixing the field clears its error.
    act(() => result.current.setField('isbn', '9780441172719'));
    expect(result.current.errors.isbn).toBeUndefined();
  });

  it('loads an existing book, edits it and round-trips every field', async () => {
    await loadFixture(db, 'demo');
    const [omens] = await booksRepo.findBooksByIsbn(db, '9780575048003');
    const { result } = renderHook(() => useBookForm(omens.id), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.draft;
    expect(before).toMatchObject({ title: 'Good Omens', year: '1990', format: 'hardcover', language: 'en', genres: ['Fantasy'] });
    expect(before.authors.map((a) => a.name)).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setField('year', '1991'));
    await act(async () => {
      await result.current.submit();
    });
    const { result: again } = renderHook(() => useBookForm(omens.id), { wrapper });
    await waitFor(() => expect(again.current.status).toBe('ready'));
    expect(again.current.draft).toEqual({ ...before, year: '1991' });
  });

  it('reports a missing book', async () => {
    const { result } = renderHook(() => useBookForm(12345), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });

  it('suggests authors and knows the library’s genres', async () => {
    await loadFixture(db, 'demo');
    const { result } = renderHook(() => useBookForm(null), { wrapper });
    await waitFor(() => expect(result.current.existingGenres).toEqual(['Classics', 'Fantasy', 'Mystery', 'Science Fiction']));
    expect(await result.current.suggestAuthors('prat')).toEqual(['Terry Pratchett']);
  });
});
