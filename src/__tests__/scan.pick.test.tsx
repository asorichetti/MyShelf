import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { BookDetailScreen } from '@/features/book/BookDetailScreen';
import { AddBookScreen } from '@/features/book/BookFormScreen';
import { attachCoverFromCandidate } from '@/features/covers';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { clearSessions, createSession, getSession } from '@/features/scan/sessionStore';
import { discardPhoto } from '@/features/scan/tempPhoto';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
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
jest.mock('@/features/scan/tempPhoto', () => ({ discardPhoto: jest.fn() }));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(async () => ({ status: 'none', tried: [] })),
  attachBestCover: jest.fn(async () => ({ status: 'none', tried: [] })),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  mockMetadata = createFixtureMetadata();
  clearSessions();
  jest.mocked(attachCoverFromCandidate).mockClear();
});
afterEach(() => db.close());

const routes = { 'scan/pick': EditionPickerScreen, 'book/[id]': BookDetailScreen, 'book/new': AddBookScreen };
const p = Testids.picker;

async function press(testID: string, index = 0) {
  await act(async () => {
    fireEvent.press(screen.getAllByTestId(testID)[index]);
  });
  await advance(0);
}

async function isbnSession(isbn: string) {
  const { candidates } = await mockMetadata.service.lookupIsbn(isbn);
  return createSession({ source: 'barcode', isbn13: isbn, candidates });
}

async function open(sessionId: string, fixture: 'empty' | 'demo' = 'empty') {
  await loadFixture(db, fixture);
  const r = renderApp(db, `/scan/pick?session=${sessionId}`, routes);
  await advance(0);
  return r;
}

describe('Edition picker (P03-08) and saving (P03-09)', () => {
  it('one candidate: shown alone, selected; confirming saves it and opens its page', async () => {
    const session = await isbnSession(OL_BOOKS.colourOfMagic);
    const r = await open(session.id);
    expect(screen.getByText('Is this your book?')).toBeOnTheScreen();
    expect(screen.queryByTestId(p.work)).toBeNull();
    const [edition] = screen.getAllByTestId(p.edition);
    expect(edition.props.accessibilityState).toMatchObject({ checked: true });
    expect(edition.props.accessibilityLabel).toMatch(/^Paperback, Corgi Books, 1985, English, 287 pages, ISBN 9780552166591, The Colour of Magic/);
    await press(p.confirm);
    const [book] = await booksRepo.listBooks(db);
    expect(r.getPathname()).toBe(`/book/${book.id}`);
    expect(book).toMatchObject({ title: 'The Colour of Magic', source: 'openlibrary' });
    expect(attachCoverFromCandidate).toHaveBeenCalledTimes(1);
  });

  it('a double tap on "This is my edition" saves the book once', async () => {
    const session = await isbnSession(OL_BOOKS.colourOfMagic);
    await open(session.id);
    await act(async () => {
      fireEvent.press(screen.getByTestId(p.confirm));
      fireEvent.press(screen.getByTestId(p.confirm));
    });
    await advance(0);
    expect(await booksRepo.countBooks(db)).toBe(1);
    expect(attachCoverFromCandidate).toHaveBeenCalledTimes(1);
  });

  it('a cover search: works first, confirming needs an edition, editions load as skeletons', async () => {
    const { candidates } = await mockMetadata.service.search({ text: 'the colour of magic terry pratchett' });
    const r = await open(createSession({ source: 'cover', candidates }).id);
    expect(screen.getByText('Which edition is yours?')).toBeOnTheScreen();
    expect(screen.getByTestId(p.confirm).props.accessibilityState).toMatchObject({ disabled: true });
    // Hold the editions back to see the loading state.
    const real = mockMetadata.service.editions;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    jest.spyOn(mockMetadata.service, 'editions').mockImplementation(async (...args) => {
      await gate;
      return real(...args);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByTestId(p.work)[0]);
    });
    expect(screen.getAllByTestId(p.skeleton, { includeHiddenElements: true })).toHaveLength(3);
    expect(screen.getAllByTestId(p.work)[0].props.accessibilityState).toMatchObject({ expanded: true });
    await act(async () => release());
    await advance(0);
    expect(screen.queryByTestId(p.skeleton, { includeHiddenElements: true })).toBeNull();
    const corgi = screen.getAllByTestId(p.edition).find((e) => (e.props.accessibilityLabel as string).includes('Corgi, 1990'))!;
    await act(async () => {
      fireEvent.press(corgi);
    });
    expect(screen.getByTestId(p.confirm).props.accessibilityState).toMatchObject({ disabled: false });
    await press(p.confirm);
    const [book] = await booksRepo.listBooks(db);
    expect(r.getPathname()).toBe(`/book/${book.id}`);
    const detail = await booksRepo.getBookDetail(db, book.id);
    expect(detail).toMatchObject({ isbn13: '9780552124751', publisher: 'Corgi', publicationYear: 1990 });
    expect(detail?.series?.name).toBe('Discworld');
    expect(detail?.seriesPosition).toBe(1);
  });

  it('a book already on the shelf: Cancel, Open it, or Add another copy (P03-10)', async () => {
    const session = await isbnSession(OL_BOOKS.prideAndPrejudice);
    const r = await open(session.id, 'demo');
    const existing = (await booksRepo.findBooksByIsbn(db, OL_BOOKS.prideAndPrejudice))[0];
    await press(p.confirm);
    expect(screen.getByTestId(Testids.duplicate.sheet)).toHaveTextContent(/Already on your shelf/);
    await press(Testids.duplicate.cancel);
    expect(screen.queryByTestId(Testids.duplicate.sheet)).toBeNull();
    await press(p.confirm);
    await press(Testids.duplicate.addCopy);
    expect(await booksRepo.findBooksByIsbn(db, OL_BOOKS.prideAndPrejudice)).toHaveLength(2);
    expect(await booksRepo.countBooks(db)).toBe(13);
    expect(r.getPathname()).not.toBe(`/book/${existing.id}`);
  });

  it('Open it goes to the copy you already have and saves nothing', async () => {
    const session = await isbnSession(OL_BOOKS.prideAndPrejudice);
    const r = await open(session.id, 'demo');
    const existing = (await booksRepo.findBooksByIsbn(db, OL_BOOKS.prideAndPrejudice))[0];
    await press(p.confirm);
    await press(Testids.duplicate.open);
    expect(r.getPathname()).toBe(`/book/${existing.id}`);
    expect(await booksRepo.countBooks(db)).toBe(12);
  });

  it('"None of these" opens the add form with the scanned ISBN, saving nothing (P03-11)', async () => {
    const session = await isbnSession(OL_BOOKS.colourOfMagic);
    const r = await open(session.id);
    await press(p.none);
    expect(r.getPathname()).toBe('/book/new');
    expect(screen.getByTestId(Testids.bookForm.isbn).props.value).toBe(OL_BOOKS.colourOfMagic);
    expect(await booksRepo.countBooks(db)).toBe(0);
  });

  it('"Review before saving" fills the form instead, and the save keeps the source', async () => {
    const session = await isbnSession(OL_BOOKS.colourOfMagic);
    const r = await open(session.id);
    await press(p.review);
    await press(p.confirm);
    expect(r.getPathname()).toBe('/book/new');
    expect(await booksRepo.countBooks(db)).toBe(0);
    expect(screen.getByTestId(Testids.bookForm.title).props.value).toBe('The Colour of Magic');
    expect(screen.getByTestId(Testids.lookup.chosen)).toHaveTextContent(/Filled in from Open Library/);
    fireEvent.changeText(screen.getByTestId(Testids.bookForm.title), 'The Colour of Magic (mine)');
    await press(Testids.bookForm.save);
    await advance(0);
    const [book] = await booksRepo.listBooks(db);
    expect(book).toMatchObject({ title: 'The Colour of Magic (mine)', source: 'openlibrary', sourceId: 'OL28477029M' });
  });

  it('"Review before saving" a book already on the shelf asks first, and Add another copy opens the form', async () => {
    const session = await isbnSession(OL_BOOKS.prideAndPrejudice);
    const r = await open(session.id, 'demo');
    await press(p.review);
    await press(p.confirm);
    expect(screen.getByTestId(Testids.duplicate.sheet)).toHaveTextContent(/Already on your shelf/);
    expect(r.getPathname()).toBe('/scan/pick');
    await press(Testids.duplicate.addCopy);
    expect(r.getPathname()).toBe('/book/new');
    expect(screen.getByTestId(Testids.bookForm.title).props.value).toBe('Pride and Prejudice');
    expect(await booksRepo.countBooks(db)).toBe(12);
  });

  it('leaving without saving deletes the cover photo taken for the search', async () => {
    const { candidates } = await mockMetadata.service.search({ text: 'the colour of magic terry pratchett' });
    const session = createSession({ source: 'cover', candidates, photoUri: 'file:///cache/Camera/cover.jpg' });
    const r = await open(session.id);
    jest.mocked(discardPhoto).mockClear();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back to scanning'));
    });
    await advance(0);
    expect(r.getPathname()).toBe('/scan');
    expect(discardPhoto).toHaveBeenCalledWith('file:///cache/Camera/cover.jpg');
    expect(getSession(session.id)).toBeNull();
  });

  it('a lost session (the app was reloaded) says so', async () => {
    await open('gone');
    expect(screen.getByTestId(p.expired)).toHaveTextContent(/This scan has expired/);
  });
});
