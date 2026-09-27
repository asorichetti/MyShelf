/**
 * @jest-environment node
 */
import { buildQueriesFromOcr } from '@/domain';

import { fromMlKit } from '../mlKit';
import { ocrAvailable, recognizeText } from '../ocr';
import { OcrUnavailableError, type MlKitResult } from '../types';

/** Shaped like @react-native-ml-kit/text-recognition's result for a photographed cover. */
const mlKit: MlKitResult = {
  text: 'TERRY PRATCHETT\nTHE COLOUR\nOF MAGIC\n£8.99',
  blocks: [
    { text: 'TERRY PRATCHETT', frame: { left: 280, top: 90, width: 520, height: 70 }, lines: [{ text: 'TERRY PRATCHETT', frame: { left: 280, top: 90, width: 520, height: 70 } }] },
    {
      text: 'THE COLOUR\nOF MAGIC',
      frame: { left: 180, top: 420, width: 720, height: 240 },
      lines: [
        { text: 'THE COLOUR', frame: { left: 190, top: 420, width: 700, height: 112 } },
        { text: 'OF MAGIC', frame: { left: 260, top: 548, width: 560, height: 110 } },
      ],
    },
    { text: '£8.99', frame: { x: 900, y: 1560, width: 120, height: 24 }, lines: [{ text: '£8.99', frame: { x: 900, y: 1560, width: 120, height: 24 } }] },
    // A line ML Kit could not place, and an empty block.
    { text: 'rotated', lines: [{ text: 'rotated' }] },
    { text: '', lines: [] },
  ],
};

describe('fromMlKit', () => {
  it('maps blocks and lines to pixel frames, whether ML Kit says left/top or x/y', () => {
    const result = fromMlKit(mlKit);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[1].lines).toEqual([
      { text: 'THE COLOUR', frame: { x: 190, y: 420, width: 700, height: 112 } },
      { text: 'OF MAGIC', frame: { x: 260, y: 548, width: 560, height: 110 } },
    ]);
    expect(result.blocks[2].frame).toEqual({ x: 900, y: 1560, width: 120, height: 24 });
  });

  it('feeds the query builder', () => {
    expect(buildQueriesFromOcr(fromMlKit(mlKit))[0]).toEqual({ title: 'the colour of magic', author: 'terry pratchett' });
  });

  it('keeps a block with a frame but no lines as one line, and survives nothing', () => {
    expect(fromMlKit({ blocks: [{ text: 'DUNE', frame: { left: 0, top: 0, width: 10, height: 10 } }] }).blocks[0].lines).toEqual([
      { text: 'DUNE', frame: { x: 0, y: 0, width: 10, height: 10 } },
    ]);
    expect(fromMlKit(null)).toEqual({ blocks: [] });
    expect(fromMlKit({ blocks: [{ text: 'x', frame: { left: 0, top: 0, width: 0, height: 10 } }] })).toEqual({ blocks: [] });
  });
});

describe('recognizeText', () => {
  const native = { recognize: jest.fn(), prepareCover: jest.fn() };
  const load = (module: typeof native | null) => {
    jest.resetModules();
    jest.doMock('@modules/text-recognition', () => ({ TextRecognition: module }));
    return jest.requireActual<typeof import('../ocr')>('../ocr');
  };
  afterEach(() => jest.dontMock('@modules/text-recognition'));

  it('reads a photo with the native module and maps the result, confidence and language included', async () => {
    native.recognize.mockResolvedValueOnce({
      width: 3024,
      height: 4032,
      blocks: [
        {
          text: 'PRACTICAL\nMAGIC',
          frame: { x: 400, y: 900, width: 2200, height: 900 },
          lines: [
            { text: 'PRACTICAL', frame: { x: 400, y: 900, width: 2200, height: 420 }, confidence: 0.9312, language: 'en', angle: 0.5 },
            { text: 'MAGIC', frame: { x: 800, y: 1400, width: 1400, height: 400 }, confidence: 0.88, language: 'und', angle: 0 },
          ],
        },
      ],
    });
    const ocr = load(native);
    expect(ocr.ocrAvailable).toBe(true);
    const result = await ocr.recognizeText('content://media/external/images/media/12');
    expect(native.recognize).toHaveBeenCalledWith('content://media/external/images/media/12');
    expect(result.blocks[0].lines).toEqual([
      { text: 'PRACTICAL', frame: { x: 400, y: 900, width: 2200, height: 420 }, confidence: 0.93, language: 'en' },
      { text: 'MAGIC', frame: { x: 800, y: 1400, width: 1400, height: 400 }, confidence: 0.88 },
    ]);
  });

  it('wraps a native failure in OcrFailedError with its code', async () => {
    native.recognize.mockRejectedValueOnce(Object.assign(new Error('Could not read the image at file:///gone.jpg'), { code: 'ERR_IMAGE_LOAD' }));
    const ocr = load(native);
    const types = jest.requireActual<typeof import('../types')>('../types');
    const error = await ocr.recognizeText('file:///gone.jpg').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(types.OcrFailedError);
    expect(error).toMatchObject({ code: 'ERR_IMAGE_LOAD', message: 'Could not read the image at file:///gone.jpg' });
  });

  it('makes a cover from the photo at most 1500 px tall, cropped around the text when it is known', async () => {
    native.prepareCover.mockResolvedValueOnce('file:///cache/cover-photos/a.jpg');
    const ocr = load(native);
    await expect(ocr.coverFromPhoto('file:///cache/photo.jpg')).resolves.toBe('file:///cache/cover-photos/a.jpg');
    expect(native.prepareCover).toHaveBeenCalledWith('file:///cache/photo.jpg', 1500, null);
    native.prepareCover.mockResolvedValueOnce('file:///cache/cover-photos/b.jpg');
    await ocr.coverFromPhoto('file:///cache/photo.jpg', { x: 10, y: 20, width: 300, height: 400 });
    expect(native.prepareCover).toHaveBeenLastCalledWith('file:///cache/photo.jpg', 1500, [10, 20, 300, 400]);
  });

  it('reports itself unavailable where the module is not built in (iOS, Expo Go, Jest)', async () => {
    const ocr = load(null);
    const types = jest.requireActual<typeof import('../types')>('../types');
    expect(ocr.ocrAvailable).toBe(false);
    await expect(ocr.recognizeText('file:///cover.jpg')).rejects.toBeInstanceOf(types.OcrUnavailableError);
    await expect(ocr.coverFromPhoto('file:///cover.jpg')).rejects.toBeInstanceOf(types.OcrUnavailableError);
  });

  it('is unavailable in plain Jest, where no native module exists', () => {
    expect(ocrAvailable).toBe(false);
    expect(recognizeText).toEqual(expect.any(Function));
    expect(OcrUnavailableError).toEqual(expect.any(Function));
  });

  it('throws NotSupportedOnWeb on the web', async () => {
    const web = jest.requireActual<typeof import('../ocr.web')>('../ocr.web');
    const types = jest.requireActual<typeof import('../types')>('../types');
    expect(web.ocrAvailable).toBe(false);
    await expect(web.recognizeText('blob:x')).rejects.toBeInstanceOf(types.NotSupportedOnWeb);
    await expect(web.coverFromPhoto('blob:x')).rejects.toBeInstanceOf(types.NotSupportedOnWeb);
  });
});
