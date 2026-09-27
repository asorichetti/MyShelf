import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, pendingLookupsRepo, type Db } from '@/db';
import { attachCoverFromCandidate } from '@/features/covers';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { clearSessions } from '@/features/scan/sessionStore';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { advance, renderApp, stubScreen } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let mockMetadata: FixtureMetadata;
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));
jest.mock('@/features/covers', () => ({
  ...jest.requireActual('@/features/covers'),
  attachCoverFromCandidate: jest.fn(async () => ({ status: 'none', tried: [] })),
  backfillCoversNow: jest.fn(async () => ({ checked: 0, attached: 0, none: 0, failed: 0, offline: false })),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  mockMetadata = createFixtureMetadata();
  clearSessions();
  jest.mocked(attachCoverFromCandidate).mockClear();
});
afterEach(() => db.close());

const routes = { 'scan/pick': EditionPickerScreen, 'book/[id]': stubScreen('book') };

async function settle() {
  for (let i = 0; i < 4; i++) await advance(0);
}

describe('Details that arrived for a book scanned offline (P02-10)', () => {
  it('stay queued until the book is saved, and are reviewed from the Shelf', async () => {
    await loadFixture(db, 'empty');
    await pendingLookupsRepo.enqueue(db, OL_BOOKS.colourOfMagic);
    const r = renderApp(db, '/', routes);
    await settle();
    // The lookup succeeded, but nothing is lost until the user has chosen.
    expect(await pendingLookupsRepo.list(db)).toHaveLength(1);
    expect(screen.queryByTestId(Testids.pending.banner)).toBeNull();
    expect(screen.getByTestId(Testids.pending.arrived)).toHaveTextContent(/1 book/);

    await act(async () => {
      fireEvent.press(screen.getByTestId(Testids.pending.review));
    });
    await settle();
    expect(r.getPathname()).toBe('/scan/pick');
    await act(async () => {
      fireEvent.press(screen.getByTestId(Testids.picker.confirm));
    });
    await settle();
    const [book] = await booksRepo.listBooks(db);
    expect(book).toMatchObject({ title: 'The Colour of Magic', isbn13: OL_BOOKS.colourOfMagic });
    expect(await pendingLookupsRepo.list(db)).toEqual([]);
  });
});
