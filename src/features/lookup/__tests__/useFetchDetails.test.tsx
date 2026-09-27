import { act, renderHook, waitFor } from '@testing-library/react-native';

import { authorsRepo, booksRepo, StaticDatabaseProvider, type Db } from '@/db';
import { subscribe } from '@/features/events';
import { checkBooks, useFetchDetails } from '@/features/lookup/useFetchDetails';
import { OfflineError } from '@/services/http';
import type { BookCandidate, MetadataService } from '@/services/metadata';
import { createTestDb } from '@/testing/createTestDb';

jest.mock('@/features/lookup/metadataService', () => ({ useMetadataService: () => null }));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(async () => ({ status: 'none', tried: [] })),
}));

const candidate = (patch: Partial<BookCandidate>): BookCandidate => ({
  kind: 'edition',
  title: 'Untitled',
  subtitle: null,
  authors: [],
  publisher: null,
  publicationYear: null,
  pageCount: null,
  isbn13: null,
  isbn10: null,
  edition: null,
  language: null,
  format: null,
  summary: null,
  coverUrl: null,
  coverRefs: { olEditionCoverIds: [], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null },
  subjects: [],
  seriesHints: [],
  workKey: null,
  editionCount: null,
  source: 'openlibrary',
  sourceId: 'OL1M',
  confidence: 1,
  ...patch,
});

const DUNE = candidate({
  title: 'Dune',
  authors: ['Frank Herbert'],
  isbn13: '9780441172719',
  publisher: 'Ace Books',
  pageCount: 604,
  publicationYear: 1990,
  summary: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.',
  coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
  subjects: ['Science fiction'],
});
const MORT = candidate({ title: 'Mort', authors: ['Terry Pratchett'], summary: 'Death takes an apprentice.' });

let db: Db;
let service: jest.Mocked<Pick<MetadataService, 'lookupIsbn' | 'search'>>;
let ids: { dune: number; mort: number; unknown: number };

async function addBook(title: string, author: string, extra: Parameters<typeof booksRepo.createBook>[1] extends infer T ? Partial<T> : never) {
  const book = await booksRepo.createBook(db, { title, ...extra });
  await authorsRepo.setBookAuthors(db, book.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, author)).id, role: 'author' }]);
  return book.id;
}

beforeEach(async () => {
  db = await createTestDb();
  // As a spreadsheet leaves them: Dune has its publisher, a rating and a note; Mort has no ISBN.
  ids = {
    dune: await addBook('Dune', 'Frank Herbert', { isbn13: '9780441172719', publisher: 'Chilton', rating: 5, notes: 'Signed copy' }),
    mort: await addBook('Mort', 'Terry Pratchett', {}),
    unknown: await addBook('A Book Nobody Knows', 'Anon', { isbn13: '9780000000002' }),
  };
  service = {
    lookupIsbn: jest.fn<ReturnType<MetadataService['lookupIsbn']>, Parameters<MetadataService['lookupIsbn']>>(async (isbn) => ({ candidates: isbn === '9780441172719' ? [DUNE] : [], warnings: [] })),
    search: jest.fn<ReturnType<MetadataService['search']>, Parameters<MetadataService['search']>>(async () => ({ candidates: [MORT], warnings: [] })),
  };
});
afterEach(() => db.close());

const wrapper = ({ children }: { children: React.ReactNode }) => <StaticDatabaseProvider db={db}>{children}</StaticDatabaseProvider>;

async function render(bookIds = [ids.dune, ids.mort, ids.unknown]) {
  const hook = renderHook(() => useFetchDetails(bookIds, { service: service as unknown as MetadataService }), { wrapper });
  await waitFor(() => expect(hook.result.current.state.status).toBe('review'));
  return hook;
}

const fields = (hook: Awaited<ReturnType<typeof render>>, bookId: number) => {
  const state = hook.result.current.state;
  return state.status === 'review' ? state.proposals.find((p) => p.book.id === bookId)?.changes.map((c) => `${c.field}:${c.kind}`) : undefined;
};

describe('useFetchDetails', () => {
  it('offers only what each book lacks, never replacing what the file held', async () => {
    const hook = await render();
    const state = hook.result.current.state;
    expect(state.status === 'review' && state.counts).toEqual({ found: 2, upToDate: 0, notFound: 1, failed: 0 });
    // Chilton stays: the publisher is not offered; the year was not asked for.
    expect(fields(hook, ids.dune)).toEqual(['cover:add', 'pages:add', 'genres:add', 'summary:add']);
    expect(fields(hook, ids.mort)).toEqual(['summary:add']);
    expect(service.search).toHaveBeenCalledWith({ title: 'Mort', author: 'Terry Pratchett' }, expect.anything());
    // Everything offered starts ticked.
    expect([...hook.result.current.ticked.get(ids.dune)!]).toHaveLength(4);
  });

  it('saves the ticked details only, and keeps the rating, notes and the file’s own fields', async () => {
    const hook = await render();
    const events: string[] = [];
    const stop = subscribe('library-changed', (e) => events.push(e));
    act(() => hook.result.current.toggle(ids.dune, 'pages'));
    await act(async () => {
      expect(await hook.result.current.apply()).toBe(2);
    });
    stop();
    const dune = (await booksRepo.getBookDetail(db, ids.dune))!;
    expect(dune.summary).toMatch(/^Set on the desert planet Arrakis/);
    expect(dune.pageCount).toBeNull();
    expect(dune.publisher).toBe('Chilton');
    expect(dune.rating).toBe(5);
    expect(dune.notes).toBe('Signed copy');
    expect(dune.publicationYear).toBeNull();
    expect(dune.genres.map((g) => g.name)).toEqual(['Science Fiction']);
    expect((await booksRepo.getBookDetail(db, ids.mort))!.summary).toBe('Death takes an apprentice.');
    expect(hook.result.current.state).toEqual({ status: 'saved', books: 2, details: 4 });
    expect(events).toEqual(['library-changed']);
  });

  it('keeps a cover or a summary that arrived after the lookup', async () => {
    const hook = await render();
    // While the review is open, the cover backfill stores Dune's cover and the user types Mort's summary.
    await booksRepo.updateBook(db, ids.dune, { coverUri: 'file:///covers/dune.jpg' });
    await booksRepo.updateBook(db, ids.mort, { summary: 'My own words.' });
    await act(async () => {
      await hook.result.current.apply();
    });
    const dune = (await booksRepo.getBookDetail(db, ids.dune))!;
    expect(dune.coverUri).toBe('file:///covers/dune.jpg');
    expect(dune.summary).toMatch(/^Set on the desert planet/);
    expect((await booksRepo.getBookDetail(db, ids.mort))!.summary).toBe('My own words.');
    // Dune's pages, genres and summary; its cover and Mort were left alone.
    expect(hook.result.current.state).toEqual({ status: 'saved', books: 1, details: 3 });
  });

  it('stops at being offline and reviews what it found', async () => {
    service.lookupIsbn.mockImplementation(async (isbn: string) => {
      if (isbn === '9780441172719') return { candidates: [DUNE], warnings: [] };
      throw new OfflineError('https://openlibrary.org/isbn/x.json');
    });
    const onProgress = jest.fn();
    const result = await checkBooks(db, [ids.dune, ids.unknown, ids.mort], { service: service as unknown as MetadataService, signal: new AbortController().signal, concurrency: 1, onProgress });
    expect(result.offline).toBe(true);
    expect(result.proposals.map((p) => p.book.title)).toEqual(['Dune']);
    // The offline book and the one never reached.
    expect(result.counts).toEqual({ found: 1, upToDate: 0, notFound: 0, failed: 2 });
    expect(service.search).not.toHaveBeenCalled();
  });

  it('counts a failed lookup and carries on', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    service.search.mockRejectedValue(new Error('500 from the catalogue'));
    const hook = await render();
    const state = hook.result.current.state;
    expect(state.status === 'review' && state.counts).toEqual({ found: 1, upToDate: 0, notFound: 1, failed: 1 });
    warn.mockRestore();
  });

  it('never has more than two lookups in flight', async () => {
    let inFlight = 0;
    let most = 0;
    service.lookupIsbn.mockImplementation(async () => {
      most = Math.max(most, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { candidates: [], warnings: [] };
    });
    const many = [ids.dune, ids.unknown, ids.dune, ids.unknown, ids.dune];
    await checkBooks(db, many, { service: service as unknown as MetadataService, signal: new AbortController().signal, onProgress: () => {} });
    expect(most).toBe(2);
  });

  it('can be stopped, reviewing what was found so far', async () => {
    let release!: () => void;
    service.search.mockImplementation(
      (_q, options) =>
        new Promise((_resolve, reject) => {
          release = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          options?.signal?.addEventListener('abort', () => release());
        }),
    );
    const hook = renderHook(() => useFetchDetails([ids.dune, ids.mort, ids.unknown], { service: service as unknown as MetadataService }), { wrapper });
    await waitFor(() => expect(service.search).toHaveBeenCalled());
    await act(async () => hook.result.current.stop());
    await waitFor(() => expect(hook.result.current.state.status).toBe('review'));
    const state = hook.result.current.state;
    expect(state.status === 'review' && state.proposals.map((p) => p.book.title)).toEqual(['Dune']);
  });
});
