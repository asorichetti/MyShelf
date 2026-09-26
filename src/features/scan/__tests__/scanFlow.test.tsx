import { act, fireEvent, screen } from 'expo-router/testing-library';

import { booksRepo, pendingLookupsRepo, type Db } from '@/db';
import { AddBookScreen } from '@/features/book/BookFormScreen';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { resetScanScreenMemory } from '@/features/scan/ScanScreen';
import { OfflineError } from '@/services/http';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { lastCameraProps, resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

let mockMetadata: FixtureMetadata;
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));
jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'empty');
  mockMetadata = createFixtureMetadata();
  resetCamera();
  setCameraPermission('granted');
  resetScanScreenMemory();
});
afterEach(() => db.close());

const routes = { 'scan/pick': EditionPickerScreen, 'book/new': AddBookScreen };

async function openScan() {
  const r = renderApp(db, '/scan', routes);
  await advance(0);
  return r;
}

async function scanBarcode(data: string) {
  await act(async () => {
    lastCameraProps()!.onBarcodeScanned({ type: 'ean13', data });
  });
  await advance(0);
  await advance(0);
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await advance(0);
}

describe('Scan result flow for barcodes (P03-04)', () => {
  it('found: the picker opens with the candidate', async () => {
    const r = await openScan();
    await scanBarcode(OL_BOOKS.colourOfMagic);
    expect(r.getPathname()).toBe('/scan/pick');
    expect(screen.getAllByTestId(Testids.picker.edition)).toHaveLength(1);
  });

  it('looking up: Booky’s sheet names the ISBN, and Cancel returns to live scanning', async () => {
    jest.spyOn(mockMetadata.service, 'lookupIsbn').mockReturnValue(new Promise(() => {}));
    await openScan();
    await scanBarcode(OL_BOOKS.colourOfMagic);
    expect(screen.getByTestId(Testids.scan.lookupSheet)).toHaveTextContent(/Looking up 978-0-552-16659-1…/);
    expect(lastCameraProps()!.onBarcodeScanned).toBeUndefined();
    await press(Testids.scan.lookupCancel);
    expect(screen.queryByTestId(Testids.scan.lookupSheet)).toBeNull();
    expect(lastCameraProps()!.onBarcodeScanned).toEqual(expect.any(Function));
  });

  it('not found: offers the cover, or adding it by hand with the ISBN', async () => {
    const r = await openScan();
    await scanBarcode(OL_BOOKS.unknown);
    expect(screen.getByTestId(Testids.scan.notFound)).toHaveTextContent(/I couldn’t find that one/);
    expect(screen.getByTestId(Testids.scan.readCoverInstead)).toBeOnTheScreen();
    await press(Testids.scan.addManually);
    expect(r.getPathname()).toBe('/book/new');
    expect(screen.getByTestId(Testids.bookForm.isbn).props.value).toBe(OL_BOOKS.unknown);
    expect(await booksRepo.countBooks(db)).toBe(0);
  });

  it('not found -> Read the cover instead switches to cover mode', async () => {
    await openScan();
    await scanBarcode(OL_BOOKS.unknown);
    await press(Testids.scan.readCoverInstead);
    expect(screen.getByTestId(Testids.scan.modeCover).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('offline: the ISBN is queued, Booky is sleepy, and scanning resumes', async () => {
    jest.spyOn(mockMetadata.service, 'lookupIsbn').mockRejectedValue(new OfflineError('https://openlibrary.org'));
    await openScan();
    await scanBarcode(OL_BOOKS.colourOfMagic);
    expect((await pendingLookupsRepo.list(db)).map((p) => p.isbn13)).toEqual([OL_BOOKS.colourOfMagic]);
    expect(screen.getByTestId(Testids.booky.bubbleText)).toHaveTextContent(/^Saved — I.ll look this up when you.re back online\.$/);
    expect(lastCameraProps()!.onBarcodeScanned).toEqual(expect.any(Function));
  });

  it('a product barcode says so and looks nothing up', async () => {
    const lookup = jest.spyOn(mockMetadata.service, 'lookupIsbn');
    await openScan();
    await act(async () => {
      lastCameraProps()!.onBarcodeScanned({ type: 'upc_a', data: '036000291452' });
    });
    expect(screen.getByTestId(Testids.scan.notBookBarcode)).toHaveTextContent(/product barcode, not a book’s/);
    expect(lookup).not.toHaveBeenCalled();
    await press(Testids.scan.resume);
    expect(screen.queryByTestId(Testids.scan.notBookBarcode)).toBeNull();
  });
});
