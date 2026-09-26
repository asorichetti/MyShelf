/**
 * @jest-environment node
 */
import { images } from '../__fixtures__/images';
import { readImageSize } from '../imageSize';


describe('readImageSize', () => {
  it.each([
    ['portrait JPEG', images.portrait320, { width: 320, height: 480, format: 'jpeg' }],
    ['large JPEG', images.large800, { width: 800, height: 1200, format: 'jpeg' }],
    ['square JPEG', images.square300, { width: 300, height: 300, format: 'jpeg' }],
    ['small JPEG', images.small128, { width: 128, height: 100, format: 'jpeg' }],
    ['wide JPEG', images.strip575, { width: 575, height: 92, format: 'jpeg' }],
    ['PNG', images.png400, { width: 400, height: 600, format: 'png' }],
    ['1×1 GIF', images.pixelGif, { width: 1, height: 1, format: 'gif' }],
  ])('reads a %s', (_name, bytes, expected) => {
    expect(readImageSize(bytes)).toEqual(expected);
  });

  it('skips fill bytes and marker-only segments before the frame header', () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, // SOI
      0xff, 0xff, 0xd0, // fill byte, then RST0 (no length)
      0xff, 0xfe, 0x00, 0x04, 0x68, 0x69, // COM "hi"
      0xff, 0xc2, 0x00, 0x11, 0x08, 0x01, 0xf4, 0x01, 0x4d, // SOF2 (progressive): 333 × 500
    ]);
    expect(readImageSize(bytes)).toEqual({ width: 333, height: 500, format: 'jpeg' });
  });

  it('reads WebP headers', () => {
    const vp8x = new Uint8Array(30);
    vp8x.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    vp8x.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    vp8x.set([0x3f, 0x01, 0x00, 0xdf, 0x01, 0x00], 24); // 320 × 480, stored minus one
    expect(readImageSize(vp8x)).toEqual({ width: 320, height: 480, format: 'webp' });
  });

  it.each([
    ['empty', new Uint8Array()],
    ['an HTML page', new TextEncoder().encode('<!DOCTYPE html><html>Not found</html>')],
    ['a JPEG cut off before its frame header', images.portrait320.slice(0, 40)],
    ['a JPEG that loses sync', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0x12, 0x34])],
    ['a PNG without IHDR', images.png400.slice(0, 12)],
  ])('returns null for %s', (_name, bytes) => {
    expect(readImageSize(bytes)).toBeNull();
  });
});
