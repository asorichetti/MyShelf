import { fireEvent, screen } from '@testing-library/react-native';

import type { ScannerHostProps } from '@/components/scan/ScannerHost';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

// The web build's scanner (ScannerHost.web.tsx); Jest runs the native platform, so load it by name.
const { ScannerHost } = jest.requireActual<typeof import('@/components/scan/ScannerHost.web')>('@/components/scan/ScannerHost.web');

function render(mode: 'barcode' | 'cover', paused = false) {
  const props: ScannerHostProps = {
    mode,
    paused,
    permission: { state: 'denied', request: jest.fn(), openSettings: jest.fn() },
    recognize: jest.fn(),
    ocrAvailable: false,
    onBarcode: jest.fn(),
    onIsbnText: jest.fn(),
    onCoverText: jest.fn(),
    onOcr: jest.fn(),
    onModeChange: jest.fn(),
  };
  renderWithTheme(<ScannerHost {...props} />);
  return props;
}

describe('Scan tab on the web: the test harness (P03-07)', () => {
  it('barcode mode: a typed ISBN goes where a barcode would, with no camera or permission prompt', () => {
    const props = render('barcode');
    expect(screen.getByText(/Web test harness: type the ISBN a barcode would give/)).toBeOnTheScreen();
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    expect(screen.queryByTestId(Testids.scan.permissionPrompt)).toBeNull();
    fireEvent.changeText(screen.getByTestId(Testids.scan.webIsbn), '978-0-552-16659-1');
    fireEvent.press(screen.getByTestId(Testids.scan.webIsbnSubmit));
    expect(props.onIsbnText).toHaveBeenCalledWith('978-0-552-16659-1');
    expect(screen.queryByTestId(Testids.scan.webText)).toBeNull();
  });

  it('cover mode: typed cover text goes where the cover reader’s would', () => {
    const props = render('cover');
    fireEvent.changeText(screen.getByTestId(Testids.scan.webText), 'THE COLOUR OF MAGIC\nTERRY PRATCHETT');
    fireEvent.press(screen.getByTestId(Testids.scan.webTextSubmit));
    expect(props.onCoverText).toHaveBeenCalledWith('THE COLOUR OF MAGIC\nTERRY PRATCHETT');
    expect(props.onOcr).not.toHaveBeenCalled();
  });

  it('does nothing for an empty field, and while a lookup runs', () => {
    const props = render('barcode', true);
    fireEvent.press(screen.getByTestId(Testids.scan.webIsbnSubmit));
    expect(props.onIsbnText).not.toHaveBeenCalled();
  });
});
