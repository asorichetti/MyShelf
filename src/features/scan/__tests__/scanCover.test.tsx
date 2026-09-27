import { act, fireEvent, screen } from 'expo-router/testing-library';

import { type Db } from '@/db';
import type { OcrResult } from '@/domain';
import { EditionPickerScreen } from '@/features/scan/EditionPickerScreen';
import { resetScanScreenMemory } from '@/features/scan/ScanScreen';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureMetadata, type FixtureMetadata } from '@/testing/fixtureMetadata';
import { loadFixture } from '@/testing/loadFixture';
import { resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

import mlKitCapture from '../../../domain/__fixtures__/ocr/real-mlkit-practical-magic.json';

let mockMetadata: FixtureMetadata;
jest.mock('@/features/lookup/metadataService', () => ({
  useMetadataService: () => mockMetadata.service,
  getLookupServices: () => ({ http: mockMetadata.http, metadata: mockMetadata.service }),
}));
jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);
// A build with the text reader: ML Kit's reading of the developer's photo of Practical Magic.
jest.mock('@/services/recognition', () => ({
  ...jest.requireActual('@/services/recognition'),
  ocrAvailable: true,
  recognizeText: jest.fn(),
}));
jest.mock('@/features/scan/choosePhoto', () => ({ choosePhoto: jest.fn(async () => 'file:///cache/ImagePicker/cover.jpg') }));
jest.mock('@/features/scan/tempPhoto', () => ({ discardPhoto: jest.fn() }));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'empty');
  mockMetadata = createFixtureMetadata();
  resetCamera();
  resetScanScreenMemory();
  const { recognizeText } = jest.requireMock<{ recognizeText: jest.Mock }>('@/services/recognition');
  recognizeText.mockResolvedValue((mlKitCapture as unknown as { result: OcrResult }).result);
});
afterEach(() => db.close());

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await advance(0);
  await advance(0);
}

async function openCover() {
  const r = renderApp(db, '/scan', { 'scan/pick': EditionPickerScreen });
  await advance(0);
  await press(Testids.scan.modeCover);
  return r;
}

describe('Cover mode with a photo from the gallery (P03-05)', () => {
  it('works with the camera refused: the photo is read and the picker opens on the book', async () => {
    setCameraPermission('denied');
    const r = await openCover();
    expect(screen.getByTestId(Testids.scan.permissionDenied)).toBeOnTheScreen();
    await press(Testids.scan.choosePhoto);
    expect(jest.requireMock('@/services/recognition').recognizeText).toHaveBeenCalledWith('file:///cache/ImagePicker/cover.jpg');
    expect(r.getPathname()).toBe('/scan/pick');
    expect(screen.getAllByText('Practical Magic').length).toBeGreaterThan(0);
  });

  it('nothing found: "Change the words" opens the typed cover text with what was read', async () => {
    setCameraPermission('granted');
    jest.spyOn(mockMetadata.service, 'search').mockResolvedValue({ candidates: [], warnings: [] });
    await openCover();
    await press(Testids.scan.choosePhoto);
    expect(screen.getByTestId(Testids.scan.notFound)).toBeOnTheScreen();
    await press(Testids.scan.typeWords);
    expect(screen.getByTestId(Testids.scan.webText).props.value).toBe('Practical Magic\nAlice Hoffman');
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    await press(Testids.scan.webTextSubmit);
    expect(mockMetadata.service.search).toHaveBeenLastCalledWith({ text: 'practical magic alice hoffman' }, expect.anything());
  });
});
