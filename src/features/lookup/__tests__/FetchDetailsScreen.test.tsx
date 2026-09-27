import { act, fireEvent, screen } from 'expo-router/testing-library';

import { authorsRepo, booksRepo, type Db } from '@/db';
import { FetchDetailsScreen, parseBookIds } from '@/features/lookup/FetchDetailsScreen';
import type { BookCandidate, MetadataService } from '@/services/metadata';
import { createTestDb } from '@/testing/createTestDb';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

const mockService: Pick<MetadataService, 'lookupIsbn' | 'search'> = {
  lookupIsbn: jest.fn(),
  search: jest.fn(),
};
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockService,
  getLookupServices: () => ({ metadata: mockService }),
}));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(async () => ({ status: 'none', tried: [] })),
  backfillCoversNow: jest.fn(async () => ({ checked: 0, attached: 0, none: 0, failed: 0, offline: false })),
}));

const T = Testids.fetchDetails;
const mort: BookCandidate = {
  kind: 'work',
  title: 'Mort',
  subtitle: null,
  authors: ['Terry Pratchett'],
  publisher: 'Corgi',
  publicationYear: 1987,
  pageCount: 272,
  isbn13: null,
  isbn10: null,
  edition: null,
  language: null,
  format: null,
  summary: 'Death takes an apprentice.',
  coverUrl: null,
  coverRefs: { olEditionCoverIds: [], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null },
  subjects: [],
  seriesHints: [],
  workKey: null,
  editionCount: null,
  source: 'openlibrary',
  sourceId: 'OL1W',
  confidence: 1,
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  jest.mocked(mockService.search).mockResolvedValue({ candidates: [mort], warnings: [] });
});
afterEach(() => db.close());

describe('parseBookIds', () => {
  it('keeps valid ids once, in order', () => {
    expect(parseBookIds('3,1, 3,x,-2,0,7.5,9')).toEqual([3, 1, 9]);
    expect(parseBookIds(undefined)).toEqual([]);
    expect(parseBookIds(['4', '5'])).toEqual([4, 5]);
  });
});

describe('FetchDetailsScreen', () => {
  it('lists each book with its missing details ticked, and adds them', async () => {
    const book = await booksRepo.createBook(db, { title: 'Mort', publisher: 'Transworld' });
    await authorsRepo.setBookAuthors(db, book.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, 'Terry Pratchett')).id, role: 'author' }]);
    renderApp(db, `/settings/fetch-details?ids=${book.id}`, { 'settings/fetch-details': FetchDetailsScreen });
    await advance(0);
    await advance(0);
    expect(screen.getByTestId(T.summary)).toHaveTextContent('1 book has something to add.');
    expect(screen.getByRole('heading', { name: 'Mort' })).toBeOnTheScreen();
    const labels = screen.getAllByTestId(Testids.refresh.fieldToggle).map((el) => [el.props.accessibilityLabel, el.props.accessibilityState.checked]);
    // The publisher from the file stays; the year is not something the file lacked.
    expect(labels).toEqual([
      ['Pages: add 272', true],
      ['Summary: add Death takes an apprentice.', true],
    ]);
    expect(screen.getByTestId(T.apply)).toHaveTextContent('Add 2 details');
    await act(async () => fireEvent.press(screen.getByTestId(T.apply)));
    await advance(0);
    expect(screen.getByTestId(T.saved)).toHaveTextContent('Added details to 1 book.', { exact: false });
    const saved = (await booksRepo.getBookDetail(db, book.id))!;
    expect([saved.publisher, saved.pageCount, saved.summary]).toEqual(['Transworld', 272, 'Death takes an apprentice.']);
  });

  it('says so when there is nothing to add', async () => {
    jest.mocked(mockService.search).mockResolvedValue({ candidates: [], warnings: [] });
    const book = await booksRepo.createBook(db, { title: 'Nowhere' });
    renderApp(db, `/settings/fetch-details?ids=${book.id}`, { 'settings/fetch-details': FetchDetailsScreen });
    await advance(0);
    await advance(0);
    expect(screen.getByTestId(T.summary)).toHaveTextContent('1 isn’t in the catalogues.');
    expect(screen.getByText('Nothing to add')).toBeOnTheScreen();
    expect(screen.queryByTestId(T.apply)).toBeNull();
  });
});
