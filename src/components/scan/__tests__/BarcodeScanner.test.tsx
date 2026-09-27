import { act, fireEvent, screen } from '@testing-library/react-native';

import { lastCameraProps, resetCamera } from '@/testing/mockCamera';
import { renderWithTheme, settle } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { BarcodeScanner, NO_READ_TIP_MS } from '../BarcodeScanner';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

beforeEach(() => {
  resetCamera();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

function render(paused = false) {
  const onBarcode = jest.fn();
  const onReadCover = jest.fn();
  const utils = renderWithTheme(<BarcodeScanner onBarcode={onBarcode} paused={paused} onReadCover={onReadCover} />);
  return { onBarcode, onReadCover, ...utils };
}

const scanCode = (type: string, data: string) => act(() => lastCameraProps()!.onBarcodeScanned({ type, data }));

describe('BarcodeScanner', () => {
  it('listens for EAN-13, EAN-8 and UPC-A and passes every read on', async () => {
    const { onBarcode } = render();
    await settle();
    expect(lastCameraProps()!.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13', 'ean8', 'upc_a'] });
    scanCode('ean13', '9780552166591');
    scanCode('upc_a', '036000291452');
    expect(onBarcode.mock.calls).toEqual([[{ type: 'ean13', data: '9780552166591' }], [{ type: 'upc_a', data: '036000291452' }]]);
  });

  it('stops listening while paused', () => {
    render(true);
    expect(lastCameraProps()!.onBarcodeScanned).toBeUndefined();
  });

  it('toggles the torch', () => {
    render();
    expect(lastCameraProps()!.enableTorch).toBe(false);
    fireEvent.press(screen.getByTestId(Testids.scan.torch));
    expect(lastCameraProps()!.enableTorch).toBe(true);
    expect(screen.getByLabelText('Turn the torch off')).toBeOnTheScreen();
  });

  it('suggests the cover after 8 seconds without a read, and a read starts the clock again', () => {
    const { onReadCover } = render();
    act(() => jest.advanceTimersByTime(NO_READ_TIP_MS - 100));
    expect(screen.queryByTestId(Testids.scan.readCoverInstead)).toBeNull();
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByText('No barcode? Try reading the cover instead.')).toBeOnTheScreen();
    scanCode('ean13', '5000112637922');
    expect(screen.queryByTestId(Testids.scan.readCoverInstead)).toBeNull();
    act(() => jest.advanceTimersByTime(NO_READ_TIP_MS + 10));
    fireEvent.press(screen.getByTestId(Testids.scan.readCoverInstead));
    expect(onReadCover).toHaveBeenCalledTimes(1);
  });
});
