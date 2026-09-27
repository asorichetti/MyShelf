import { act, fireEvent, screen, within } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { AddBookScreen, EditBookScreen } from '@/features/book/BookFormScreen';
import { pickCover } from '@/features/book/pickCover';
import { attachBestCover } from '@/features/covers';
import { resolveCover } from '@/services/covers';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { makeCandidate } from '@/services/metadata/candidate';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let mockMetadata: FixtureMetadata;

jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));
jest.mock('@/features/book/pickCover', () => ({ pickCover: jest.fn() }));
jest.mock('@/services/covers', () => ({
  ...jest.requireActual('@/services/covers'),
  resolveCover: jest.fn(async () => ({ cover: null, tried: [] })),
  // A picked photo is copied next to the book's other files; here it only names the copy.
  storeCoverFile: jest.fn((bookId: number) => `file:///docs/covers/${bookId}.jpg`),
}));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachBestCover: jest.fn(async () => ({ status: 'none', tried: [] })),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  mockMetadata = createFixtureMetadata();
  jest.mocked(attachBestCover).mockClear();
});
afterEach(() => db.close());

const routes = { 'book/new': AddBookScreen, 'book/[id]': BookDetailScreen, 'book/[id]/edit': EditBookScreen };
const f = Testids.bookForm;
const l = Testids.lookup;

async function press(testID: string) {
  // Not awaiting the handler: a lookup that never settles must not hang the test.
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await advance(0);
}

async function openAddForm() {
  await loadFixture(db, 'empty');
  const r = renderApp(db, '/book/new', routes);
  await advance(0);
  return r;
}

async function lookUp(isbn: string) {
  fireEvent.changeText(screen.getByTestId(l.isbnInput), isbn);
  await press(l.isbnSubmit);
  await advance(0);
}

const value = (testID: string) => screen.getByTestId(testID).props.value;

describe('Look up by ISBN on the add form', () => {
  it('fills every mapped field from the chosen candidate, keeps the user’s edits, and records the source', async () => {
    const r = await openAddForm();
    await lookUp('978-0-552-16659-1');
    const cards = screen.getAllByTestId(l.candidate);
    expect(cards).toHaveLength(1);
    expect(cards[0].props.accessibilityLabel).toMatch(/^The Colour of Magic, by Terry Pratchett, 1985, Corgi Books.*ISBN 9780552166591, from Open Library$/);

    await press(l.candidate);
    expect(screen.getByTestId(l.chosen)).toHaveTextContent(/Filled in from Open Library/);
    expect(value(f.title)).toBe('The Colour of Magic');
    expect(value(f.isbn)).toBe('9780552166591');
    expect(value(f.publisher)).toBe('Corgi Books');
    expect(value(f.year)).toBe('1985');
    expect(value(Testids.seriesInput.search)).toBe('Discworld');
    expect(value(Testids.seriesInput.position)).toBe('1');
    expect(value(f.summary).length).toBeGreaterThan(40);
    expect(screen.getAllByTestId(f.authorChip).map((c) => c.props.accessibilityLabel ?? '')).toHaveLength(1);
    expect(screen.getByText('Terry Pratchett')).toBeOnTheScreen();
    expect(within(screen.getByTestId(f.root)).getAllByTestId(f.genreChip).length).toBeGreaterThan(0);
    expect(screen.getByText('Fantasy')).toBeOnTheScreen();
    // The real cover goes on the card straight away.
    expect(screen.getByTestId(Testids.cover.image, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.cover.fallback, { includeHiddenElements: true })).toBeNull();

    // The user's edits after choosing are what gets saved.
    fireEvent.changeText(screen.getByTestId(f.title), 'The Colour of Magic (signed)');
    fireEvent.changeText(screen.getByTestId(f.notes), 'From the Oxfam shop');
    await press(f.save);
    await advance(0);

    const [book] = await booksRepo.listBooks(db);
    expect(r.getPathname()).toBe(`/book/${book.id}`);
    expect(book).toMatchObject({
      title: 'The Colour of Magic (signed)',
      notes: 'From the Oxfam shop',
      isbn13: '9780552166591',
      publisher: 'Corgi Books',
      publicationYear: 1985,
      source: 'openlibrary',
      sourceId: 'OL28477029M',
    });
    const detail = await booksRepo.getBookDetail(db, book.id);
    expect(detail?.series?.name).toBe('Discworld');
    expect(detail?.seriesPosition).toBe(1);
    // The best real version of the cover is stored after the save.
    expect(attachBestCover).toHaveBeenCalledWith(db, book.id, expect.objectContaining({ isbn13: '9780552166591' }), expect.objectContaining({ replace: true }));
  });

  it('shows Booky thinking while it looks, and Cancel stops the lookup', async () => {
    jest.spyOn(mockMetadata.service, 'lookupIsbn').mockImplementation(
      (_isbn, { signal } = {}) =>
        new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
    );
    await openAddForm();
    await lookUp(OL_BOOKS.colourOfMagic);
    expect(screen.getByTestId(l.loading)).toHaveTextContent(/Looking up 978-0-552-16659-1…/);
    await press(l.cancel);
    expect(screen.queryByTestId(l.loading)).toBeNull();
    expect(screen.queryByTestId(l.candidate)).toBeNull();
  });

  it('offers to add an unknown ISBN by hand, keeping the ISBN', async () => {
    await openAddForm();
    await lookUp(OL_BOOKS.unknown);
    expect(screen.getByTestId(l.noResults)).toHaveTextContent(/I couldn’t find that one/);
    await press(l.addManually);
    await advance(20);
    expect(screen.queryByTestId(l.noResults)).toBeNull();
    expect(value(f.isbn)).toBe(OL_BOOKS.unknown);
    expect(await booksRepo.countBooks(db)).toBe(0);
  });

  it('searches online and fills the form from a work', async () => {
    await openAddForm();
    fireEvent.changeText(screen.getByTestId(l.searchInput), 'colour of magic pratchett');
    await press(l.searchSubmit);
    await advance(0);
    const cards = screen.getAllByTestId(l.candidate);
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0].props.accessibilityLabel).toMatch(/^The Colour of Magic, by Terry Pratchett/);
    await act(async () => fireEvent.press(cards[0]));
    expect(value(f.title)).toBe('The Colour of Magic');
  });

  it('a manually typed book saves as manual, with no lookup', async () => {
    await openAddForm();
    fireEvent.changeText(screen.getByTestId(f.title), 'Typed');
    await press(f.save);
    const [book] = await booksRepo.listBooks(db);
    expect(book.source).toBe('manual');
    expect(attachBestCover).not.toHaveBeenCalled();
  });
});

describe('A weaker series guess', () => {
  it('is suggested, not filled in, and the chip fills both fields', async () => {
    jest.spyOn(mockMetadata.service, 'lookupIsbn').mockResolvedValue({
      candidates: [makeCandidate({ title: 'Mort (Discworld, #4)', authors: ['Terry Pratchett'], isbn13: '9780552131063', source: 'openlibrary', sourceId: 'OL1M' })],
      warnings: [],
    });
    await openAddForm();
    await lookUp('9780552131063');
    await press(l.candidate);
    expect(value(Testids.seriesInput.search)).toBe('');
    const chip = screen.getByTestId(Testids.seriesInput.suggestion);
    expect(chip.props.accessibilityLabel).toBe('Use the suggested series, Discworld #4');
    await press(Testids.seriesInput.suggestion);
    expect(value(Testids.seriesInput.search)).toBe('Discworld');
    expect(value(Testids.seriesInput.position)).toBe('4');
  });
});

describe('Find a cover online', () => {
  it('puts the best real cover on the card from the ISBN, and stores it on save', async () => {
    const resolve = jest.mocked(resolveCover);
    resolve.mockResolvedValueOnce({
      cover: { url: 'https://covers.openlibrary.org/b/id/14647238-L.jpg', origin: 'openlibrary-edition', width: 400, height: 600, shape: 'portrait', format: 'jpeg', contentType: 'image/jpeg', bytes: new Uint8Array() },
      tried: [],
    });
    await openAddForm();
    fireEvent.changeText(screen.getByTestId(f.title), 'The Colour of Magic');
    fireEvent.changeText(screen.getByTestId(f.isbn), OL_BOOKS.colourOfMagic);
    await press(l.findCover);
    await advance(0);
    expect(resolve).toHaveBeenCalled();
    expect(screen.getByTestId(Testids.cover.image, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent('Found the cover and put it on the card.');
    await press(f.save);
    const [book] = await booksRepo.listBooks(db);
    expect(book.coverUri).toBe('https://covers.openlibrary.org/b/id/14647238-L.jpg');
    expect(attachBestCover).toHaveBeenCalledWith(db, book.id, expect.objectContaining({ olEditionCoverIds: [14647238] }), expect.objectContaining({ replace: true }));
  });

  const FOUND = {
    cover: { url: 'https://covers.openlibrary.org/b/id/14647238-L.jpg', origin: 'openlibrary-edition', width: 400, height: 600, shape: 'portrait', format: 'jpeg', contentType: 'image/jpeg', bytes: new Uint8Array() },
    tried: [],
  } as const;

  /** A cover search that waits until `finish` is called, and the signal it was given. */
  function slowSearch() {
    let finish: () => void = () => undefined;
    const seen: { signal?: AbortSignal } = {};
    jest.mocked(resolveCover).mockImplementationOnce((_source, options) => {
      seen.signal = options?.signal;
      return new Promise((resolve, reject) => {
        finish = () => resolve(FOUND as never);
        options?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })));
      });
    });
    return { seen, finish: () => finish() };
  }

  it('is cancelled when the form is left while it runs', async () => {
    const search = slowSearch();
    const r = await openAddForm();
    fireEvent.changeText(screen.getByTestId(f.isbn), OL_BOOKS.colourOfMagic);
    await press(l.findCover);
    await advance(0);
    expect(search.seen.signal).toBeDefined();
    expect(search.seen.signal!.aborted).toBe(false);
    r.unmount();
    expect(search.seen.signal!.aborted).toBe(true);
  });

  it('never replaces a photo the user picked while it ran', async () => {
    const search = slowSearch();
    jest.mocked(pickCover).mockResolvedValueOnce({ status: 'picked', uri: 'file:///cache/picker/photo.jpg' });
    await openAddForm();
    fireEvent.changeText(screen.getByTestId(f.title), 'The Colour of Magic');
    fireEvent.changeText(screen.getByTestId(f.isbn), OL_BOOKS.colourOfMagic);
    await press(l.findCover);
    await advance(0);
    await press(f.coverPick);
    await act(async () => search.finish());
    await advance(0);
    expect(screen.queryByText('Found the cover and put it on the card.')).toBeNull();
    await press(f.save);
    const [book] = await booksRepo.listBooks(db);
    expect(book.coverUri).toBe(`file:///docs/covers/${book.id}.jpg`);
    expect(attachBestCover).not.toHaveBeenCalled();
  });

  it('asks for an ISBN or title and author first', async () => {
    await openAddForm();
    await press(l.findCover);
    expect(screen.getByTestId(Testids.snackbar.root)).toHaveTextContent(/Add the ISBN, or the title and author/);
  });
});
