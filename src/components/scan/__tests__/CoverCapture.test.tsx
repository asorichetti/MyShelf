import { act, fireEvent, screen } from '@testing-library/react-native';

import type { OcrResult } from '@/domain';
import { resetCamera, takePictureMock } from '@/testing/mockCamera';
import { renderWithTheme } from '@/testing/render';
import { Testids } from '@/testing/testids.gen';

import { CoverCapture } from '../CoverCapture';

jest.mock('expo-camera', () => jest.requireActual('@/testing/mockCamera').cameraModule);

const result: OcrResult = { blocks: [] };

beforeEach(() => resetCamera());

function render(
  recognize: (uri: string) => Promise<OcrResult>,
  available = true,
  extra: Partial<{ choosePhoto: () => Promise<string | null>; cameraBlocked: React.ReactNode }> = {},
) {
  const onRecognised = jest.fn();
  const onTypeText = jest.fn();
  renderWithTheme(<CoverCapture recognize={recognize} available={available} onRecognised={onRecognised} onTypeText={onTypeText} paused={false} {...extra} />);
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

  it('reads a photo chosen from the phone straight away, without a review step', async () => {
    const recognize = jest.fn(async () => result);
    const choosePhoto = jest.fn(async () => 'file:///cache/ImagePicker/pick.jpg');
    const { onRecognised } = render(recognize, true, { choosePhoto });
    expect(screen.getByText('Choose from your photos')).toBeOnTheScreen();
    await press(Testids.scan.choosePhoto);
    expect(recognize).toHaveBeenCalledWith('file:///cache/ImagePicker/pick.jpg');
    expect(onRecognised).toHaveBeenCalledWith(result, 'file:///cache/ImagePicker/pick.jpg');
  });

  it('a cancelled picker changes nothing; a failed read offers another photo', async () => {
    const recognize = jest.fn().mockRejectedValueOnce(new Error('ERR_IMAGE_LOAD'));
    const choosePhoto = jest.fn<Promise<string | null>, []>().mockResolvedValueOnce(null).mockResolvedValueOnce('file:///cache/ImagePicker/blurry.jpg');
    const { onRecognised } = render(recognize, true, { choosePhoto });
    await press(Testids.scan.choosePhoto);
    expect(recognize).not.toHaveBeenCalled();
    expect(screen.getByTestId(Testids.scan.camera)).toBeOnTheScreen();
    await press(Testids.scan.choosePhoto);
    expect(screen.getByText('I couldn’t read that photo. Try again with the cover flat and well lit.')).toBeOnTheScreen();
    expect(screen.getByText('Choose another')).toBeOnTheScreen();
    expect(onRecognised).not.toHaveBeenCalled();
  });

  it('without the camera, the permission prompt stands in for it and photos can still be chosen', async () => {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
    const recognize = jest.fn(async () => result);
    const choosePhoto = jest.fn(async () => 'file:///cache/ImagePicker/pick.jpg');
    render(recognize, true, { choosePhoto, cameraBlocked: <Text>May I use the camera?</Text> });
    expect(screen.queryByTestId(Testids.scan.camera)).toBeNull();
    expect(screen.queryByTestId(Testids.scan.capture)).toBeNull();
    expect(screen.getByText('May I use the camera?')).toBeOnTheScreen();
    await press(Testids.scan.choosePhoto);
    expect(recognize).toHaveBeenCalledWith('file:///cache/ImagePicker/pick.jpg');
  });
});
