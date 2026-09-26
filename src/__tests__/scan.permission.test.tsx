import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import type { Db } from '@/db';
import { resetScanScreenMemory } from '@/features/scan/ScanScreen';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';
import { cameraRequest, lastCameraProps, resetCamera, setCameraPermission } from '@/testing/mockCamera';
import { advance, renderApp } from '@/testing/renderApp';
import { Testids } from '@/testing/testids.gen';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'empty');
  resetCamera();
  resetScanScreenMemory();
});
afterEach(() => db.close());

async function openScan() {
  renderApp(db, '/scan');
  await advance(0);
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await advance(0);
}

describe('Scan tab: camera permission (P03-02)', () => {
  it('undetermined: Booky explains, "Allow camera" asks the system, and no camera is mounted until then', async () => {
    setCameraPermission('undetermined');
    await openScan();
    expect(screen.getByTestId(Testids.scan.permissionPrompt)).toBeOnTheScreen();
    expect(screen.getByText('I use the camera only to read barcodes and covers — nothing leaves your phone.')).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    expect(lastCameraProps()).toBeNull();
    await press(Testids.scan.permissionAllow);
    expect(cameraRequest()).toHaveBeenCalledTimes(1);
  });

  it('denied: explains, opens the settings, and offers typing the ISBN', async () => {
    setCameraPermission('denied', false);
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await openScan();
    expect(screen.getByTestId(Testids.scan.permissionDenied)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    await press(Testids.scan.openSettings);
    expect(open).toHaveBeenCalled();
    await press(Testids.scan.typeIsbnInstead);
    expect(screen.getByTestId(Testids.scan.webIsbn)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
  });

  it('granted: the scanner is live, listening for book barcodes, with the torch', async () => {
    setCameraPermission('granted');
    await openScan();
    expect(screen.getByTestId(Testids.scan.camera)).toBeOnTheScreen();
    expect(lastCameraProps()?.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13', 'ean8', 'upc_a'] });
    expect(screen.getByTestId(Testids.scan.torch)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.scan.permissionPrompt)).toBeNull();
  });
});
