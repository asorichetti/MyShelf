/**
 * @jest-environment node
 */
import { buildQueriesFromOcr } from '@/domain';

import { fromMlKit } from '../mlKit';
import { ocrAvailable, recognizeText } from '../ocr';
import { NotSupportedOnWeb, OcrUnavailableError, type MlKitResult } from '../types';

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
  it('reports itself unavailable in this build (no native text reader yet)', async () => {
    expect(ocrAvailable).toBe(false);
    await expect(recognizeText('file:///cover.jpg')).rejects.toBeInstanceOf(OcrUnavailableError);
  });

  it('throws NotSupportedOnWeb on the web', async () => {
    const web = jest.requireActual<typeof import('../ocr.web')>('../ocr.web');
    expect(web.ocrAvailable).toBe(false);
    await expect(web.recognizeText('blob:x')).rejects.toBeInstanceOf(NotSupportedOnWeb);
  });
});
