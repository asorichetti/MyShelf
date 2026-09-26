import { act, fireEvent, screen } from 'expo-router/testing-library';

import type { Db } from '@/db';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { resetScanScreenMemory } from '@/features/scan/ScanScreen';
import { OL_BOOKS } from '@/services/metadata/__fixtures__/openLibraryRoutes';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);
let mockMetadata: FixtureMetadata;
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'empty');
  resetCamera();
  setCameraPermission('granted');
  resetScanScreenMemory();
  mockMetadata = createFixtureMetadata();
});
afterEach(() => db.close());

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await advance(0);
}

const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;

describe('Scan modes and help (P03-13)', () => {
  it('switches between barcode and cover, and the mode lasts for the session', async () => {
    renderApp(db, '/scan');
    await advance(0);
    expect(checked(Testids.scan.modeBarcode)).toBe(true);
    expect(screen.getByTestId(Testids.scan.torch)).toBeOnTheScreen();
    await press(Testids.scan.modeCover);
    expect(checked(Testids.scan.modeCover)).toBe(true);
    // No text reader in this build: the cover mode offers typed cover text.
    expect(screen.getByTestId(Testids.scan.webText)).toBeOnTheScreen();
    await press(Testids.tabs.shelf);
    await press(Testids.tabs.scan);
    expect(checked(Testids.scan.modeCover)).toBe(true);
    expect(checked(Testids.scan.modeBarcode)).toBe(false);
  });

  it('the help sheet explains where the barcode is, as a dialog, and closes', async () => {
    renderApp(db, '/scan');
    await advance(0);
    await press(Testids.scan.help);
    const sheet = screen.getByTestId(Testids.scan.helpSheet);
    expect(sheet.props.role).toBe('dialog');
    expect(sheet).toHaveTextContent(/bottom of the back cover, starting 978 or 979/);
    await press(Testids.scan.helpClose);
    expect(screen.queryByTestId(Testids.scan.helpSheet)).toBeNull();
  });

  it('shows the last book found in a mini card when you come back from the picker', async () => {
    setCameraPermission('denied', false);
    const r = renderApp(db, '/scan', { 'scan/pick': EditionPickerScreen });
    await advance(0);
    expect(screen.queryByTestId(Testids.scan.lastScanned)).toBeNull();
    await press(Testids.scan.typeIsbnInstead);
    fireEvent.changeText(screen.getByTestId(Testids.scan.webIsbn), OL_BOOKS.theMartian);
    await press(Testids.scan.webIsbnSubmit);
    await advance(0);
    expect(r.getPathname()).toBe('/scan/pick');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back to scanning'));
    });
    await advance(0);
    expect(r.getPathname()).toBe('/scan');
    expect(screen.getByTestId(Testids.scan.lastScanned)).toHaveTextContent(/The Martian/);
  });
});
