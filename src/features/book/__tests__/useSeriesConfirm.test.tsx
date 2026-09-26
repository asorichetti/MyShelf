import { act, renderHook } from '@testing-library/react-native';

import { booksRepo, seriesRepo, settingsRepo, StaticDatabaseProvider, type Db } from '@/db';
import { useSeriesConfirm } from '@/features/book/useSeriesConfirm';
import { subscribe } from '@/features/events';
import { applyDetectedSeries } from '@/features/series/detectedSeries';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

async function guessed(confidence: 'high' | 'medium' | 'low' = 'low') {
  const book = await booksRepo.createBook(db, { title: 'Guards! Guards!' });
  const result = await applyDetectedSeries(db, book.id, { name: 'Discworld', position: 8, confidence });
  return { book: (await booksRepo.getBook(db, book.id))!, result };
}

async function render(bookId: number, seriesId: number | null) {
  const hook = renderHook(() => useSeriesConfirm(bookId, seriesId), { wrapper });
  await act(async () => {});
  return hook;
}

describe('applyDetectedSeries', () => {
  it('applies a high-confidence series directly, without asking', async () => {
    const { book, result } = await guessed('high');
    expect(result).toBe('applied');
    expect(book).toMatchObject({ seriesPosition: 8 });
    expect(await settingsRepo.getSetting(db, 'series.pendingConfirmBookIds')).toEqual([]);
  });

  it('links a low- or medium-confidence series and queues the question', async () => {
    const { book, result } = await guessed('medium');
    expect(result).toBe('needs-confirmation');
    expect(book.seriesId).toBe((await seriesRepo.findSeriesByName(db, 'discworld'))!.id);
    expect(await settingsRepo.getSetting(db, 'series.pendingConfirmBookIds')).toEqual([book.id]);
  });

  it('does nothing without a series', async () => {
    const book = await booksRepo.createBook(db, { title: 'Dune' });
    expect(await applyDetectedSeries(db, book.id, null)).toBe('none');
  });
});

describe('useSeriesConfirm', () => {
  it('asks for a guessed series, and "Yes" keeps it and stops asking', async () => {
    const { book } = await guessed();
    const { result } = await render(book.id, book.seriesId);
    expect(result.current.asking).toBe(true);
    await act(() => result.current.yes());
    expect(result.current.asking).toBe(false);
    expect((await booksRepo.getBook(db, book.id))!.seriesId).toBe(book.seriesId);
    expect(await settingsRepo.getSetting(db, 'series.pendingConfirmBookIds')).toEqual([]);
  });

  it('does not ask for a series the user typed', async () => {
    const s = await seriesRepo.createSeries(db, 'Discworld');
    const book = await booksRepo.createBook(db, { title: 'Mort', seriesId: s.id, seriesPosition: 4 });
    const { result } = await render(book.id, s.id);
    expect(result.current.asking).toBe(false);
  });

  it('"Not a series" unlinks the book, remembers it, and a later refresh does not re-add it', async () => {
    const changed = jest.fn();
    const off = subscribe('library-changed', changed);
    const { book } = await guessed();
    const { result } = await render(book.id, book.seriesId);
    await act(() => result.current.no());
    expect(result.current.asking).toBe(false);
    expect(await booksRepo.getBook(db, book.id)).toMatchObject({ seriesId: null, seriesPosition: null });
    expect(await settingsRepo.getSetting(db, 'series.dismissedBookIds')).toEqual([book.id]);
    expect(changed).toHaveBeenCalled();
    // "Refresh details" runs the detection again: the book stays out of the series.
    expect(await applyDetectedSeries(db, book.id, { name: 'Discworld', position: 8, confidence: 'high' })).toBe('dismissed');
    expect((await booksRepo.getBook(db, book.id))!.seriesId).toBeNull();
    off();
  });

  it('"Change" links a different series and number', async () => {
    const { book } = await guessed();
    const { result } = await render(book.id, book.seriesId);
    let error: unknown;
    await act(async () => {
      error = await result.current.change('The Watch', '1');
    });
    expect(error).toBeNull();
    const watch = (await seriesRepo.findSeriesByName(db, 'The Watch'))!;
    expect(await booksRepo.getBook(db, book.id)).toMatchObject({ seriesId: watch.id, seriesPosition: 1 });
    expect(result.current.asking).toBe(false);
  });

  it('"Change" reports a missing name or a bad number', async () => {
    const { book } = await guessed();
    const { result } = await render(book.id, book.seriesId);
    await act(async () => {
      expect(await result.current.change('  ', '1')).toMatchObject({ field: 'name' });
      expect(await result.current.change('Discworld', 'abc')).toMatchObject({ field: 'position' });
    });
    expect(result.current.asking).toBe(true);
  });
});
