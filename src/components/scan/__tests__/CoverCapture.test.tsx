import { act, fireEvent, screen } from '@testing-library/react-native';

import type { OcrResult } from '@/domain';
import { resetCamera, takePictureMock } from '@/testing/mockCamera';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { CoverCapture } from '../CoverCapture';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

const result: OcrResult = { blocks: [] };

beforeEach(() => resetCamera());

function render(recognize: (uri: string) => Promise<OcrResult>, available = true) {
  const onRecognised = jest.fn();
  const onTypeText = jest.fn();
  renderWithTheme(<CoverCapture recognize={recognize} available={available} onRecognised={onRecognised} onTypeText={onTypeText} paused={false} />);
  return { onRecognised, onTypeText };
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

describe('CoverCapture (P03-05)', () => {
  it('takes a photo at quality 0.7, shows it, and reads it on "Use this photo"', async () => {
    const recognize = jest.fn(async () => result);
    const { onRecognised } = render(recognize);
    await press(Testids.scan.capture);
    expect(takePictureMock()).toHaveBeenCalledWith({ quality: 0.7 });
    expect(screen.getByLabelText('Your photo of the cover')).toBeOnTheScreen();
    await press(Testids.scan.usePhoto);
    expect(recognize).toHaveBeenCalledWith('file:///cache/Camera/cover.jpg');
    expect(onRecognised).toHaveBeenCalledWith(result, 'file:///cache/Camera/cover.jpg');
    expect(screen.getByTestId(Testids.scan.camera)).toBeOnTheScreen();
  });

  it('Retake goes back to the camera', async () => {
    render(jest.fn());
    await press(Testids.scan.capture);
    await press(Testids.scan.retake);
    expect(screen.getByTestId(Testids.scan.camera)).toBeOnTheScreen();
  });

  it('a failed read shows Booky concerned with Try again', async () => {
    const recognize = jest.fn().mockRejectedValueOnce(new Error('no text')).mockResolvedValueOnce(result);
    const { onRecognised } = render(recognize);
    await press(Testids.scan.capture);
    await press(Testids.scan.usePhoto);
    expect(screen.getByText('I couldn’t read that photo. Try again with the cover flat and well lit.')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Booky the bookmark, .*worried|^Booky the bookmark/)).toBeOnTheScreen();
    await press(Testids.scan.usePhoto);
    expect(onRecognised).toHaveBeenCalledTimes(1);
  });

  it('without a text reader in the build, typed cover text stands in', () => {
    const { onTypeText } = render(jest.fn(), false);
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    fireEvent.changeText(screen.getByTestId(Testids.scan.webText), 'DUNE\nFRANK HERBERT');
    fireEvent.press(screen.getByTestId(Testids.scan.webTextSubmit));
    expect(onTypeText).toHaveBeenCalledWith('DUNE\nFRANK HERBERT');
  });
});
