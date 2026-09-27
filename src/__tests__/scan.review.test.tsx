import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, type Db } from '@/db';
import { attachCoverFromCandidate } from '@/features/covers';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { ScanReviewScreen } from '@/features/scan/ScanReviewScreen';
import { resetScanScreenMemory } from '@/features/scan/ScanScreen';
import { clearTray, getTray } from '@/features/scan/useBatchScan';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
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
jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

const FIVE = [OL_BOOKS.colourOfMagic, OL_BOOKS.theMartian, OL_BOOKS.petitPrince, OL_BOOKS.prideAndPrejudice, OL_BOOKS.philosophersStone];

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'empty');
  mockMetadata = createFixtureMetadata();
  resetCamera();
  setCameraPermission('denied', false);
  resetScanScreenMemory();
  clearTray();
  jest.mocked(attachCoverFromCandidate).mockClear();
});
afterEach(() => db.close());

const routes = { 'scan/pick': EditionPickerScreen, 'scan/review': ScanReviewScreen };

async function press(testID: string, index = 0) {
  await act(async () => {
    fireEvent.press(screen.getAllByTestId(testID)[index]);
  });
  await advance(0);
}

async function scanSeveral(isbns: string[]) {
  const r = renderApp(db, '/scan', routes);
  await advance(0);
  await press(Testids.scan.batchToggle);
  await press(Testids.scan.typeIsbnInstead);
  for (const isbn of isbns) {
    fireEvent.changeText(screen.getByTestId(Testids.scan.webIsbn), isbn);
    await press(Testids.scan.webIsbnSubmit);
    await advance(0);
  }
  return r;
}

describe('Scan several, then review (P03-12)', () => {
  it('a double tap on "Save" saves each book once', async () => {
    await scanSeveral(FIVE.slice(0, 2));
    await press(Testids.scan.reviewOpen);
    await act(async () => {
      fireEvent.press(screen.getByTestId(Testids.scanReview.saveAll));
      fireEvent.press(screen.getByTestId(Testids.scanReview.saveAll));
    });
    await advance(0);
    expect(await booksRepo.countBooks(db)).toBe(2);
  });

  it('five ISBNs go to the tray, and confirming saves five books', async () => {
    const r = await scanSeveral(FIVE);
    expect(screen.getByTestId(Testids.scan.trayCount)).toHaveTextContent('5');
    expect(r.getPathname()).toBe('/scan');
    await press(Testids.scan.reviewOpen);
    expect(r.getPathname()).toBe('/scan/review');
    expect(screen.getAllByTestId(Testids.scanReview.item)).toHaveLength(5);
    expect(await booksRepo.countBooks(db)).toBe(0);
    await press(Testids.scanReview.saveAll);
    await advance(0);
    expect(await booksRepo.countBooks(db)).toBe(5);
    expect(getTray()).toEqual([]);
    expect(attachCoverFromCandidate).toHaveBeenCalledTimes(5);
    expect(r.getPathname()).toBe('/');
  });

  it('dropping one saves four', async () => {
    await scanSeveral(FIVE);
    await press(Testids.scan.reviewOpen);
    await press(Testids.scanReview.drop, 2);
    expect(screen.getAllByTestId(Testids.scanReview.item)).toHaveLength(4);
    expect(screen.getByTestId(Testids.scanReview.saveAll)).toHaveTextContent(/Save 4 books/);
    await press(Testids.scanReview.saveAll);
    await advance(0);
    expect(await booksRepo.countBooks(db)).toBe(4);
  });

  it('leaving the Scan tab keeps the tray', async () => {
    await scanSeveral([OL_BOOKS.colourOfMagic, OL_BOOKS.theMartian]);
    await press(Testids.tabs.shelf);
    await press(Testids.tabs.scan);
    expect(screen.getByTestId(Testids.scan.trayCount)).toHaveTextContent('2');
    expect(screen.getByTestId(Testids.scan.batchToggle).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('a cover search waits in the tray for its edition to be chosen', async () => {
    const r = renderApp(db, '/scan', routes);
    await advance(0);
    await press(Testids.scan.batchToggle);
    await press(Testids.scan.modeCover);
    await press(Testids.scan.typeIsbnInstead);
    fireEvent.changeText(screen.getByTestId(Testids.scan.webText), 'THE COLOUR OF MAGIC TERRY PRATCHETT');
    await press(Testids.scan.webTextSubmit);
    await advance(0);
    await press(Testids.scan.reviewOpen);
    expect(screen.getByTestId(Testids.scanReview.saveAll)).toHaveTextContent(/Nothing ready to save/);
    await press(Testids.scanReview.choose);
    expect(r.getPathname()).toBe('/scan/pick');
    await press(Testids.picker.work);
    await advance(0);
    await press(Testids.picker.edition);
    await press(Testids.picker.confirm);
    expect(r.getPathname()).toBe('/scan/review');
    expect(getTray()[0].status).toBe('ready');
    expect(screen.getByTestId(Testids.scanReview.saveAll)).toHaveTextContent(/Save 1 book/);
  });
});
