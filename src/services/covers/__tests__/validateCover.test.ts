/**
 * @jest-environment node
 */
import { images } from '../__fixtures__/images';
import { compareCovers, coverShape, isGoodCover, validateCover } from '../validateCover';


describe('validateCover', () => {
  it.each([
    ['a portrait JPEG', images.portrait320, 'image/jpeg', { ok: true, width: 320, height: 480, shape: 'portrait' }],
    ['a PNG', images.png400, 'image/png', { ok: true, width: 400, height: 600, shape: 'portrait' }],
    ['a padded square', images.square300, 'image/jpeg', { ok: true, width: 300, height: 300, shape: 'square' }],
    ['an image with no content type', images.portrait320, null, { ok: true, shape: 'portrait' }],
    ['an octet stream', images.portrait320, 'application/octet-stream', { ok: true }],
    ['a content type with parameters', images.portrait320, 'image/jpeg; charset=binary', { ok: true }],
    ['nothing', new Uint8Array(), 'image/jpeg', { ok: false, reason: 'empty' }],
    ['an HTML error page', new TextEncoder().encode('<html>'), 'text/html; charset=utf-8', { ok: false, reason: 'not-an-image' }],
    ['HTML served as an image', new TextEncoder().encode('<html>'), 'image/jpeg', { ok: false, reason: 'unreadable' }],
    ["Open Library's 1×1 placeholder", images.pixelGif, 'image/gif', { ok: false, reason: 'placeholder' }],
    ['a 100 px tall image', images.small128, 'image/jpeg', { ok: false, reason: 'too-small' }],
    ['a thin strip', images.strip575, 'image/jpeg', { ok: false, reason: 'too-small' }],
  ])('%s', (_name, bytes, type, expected) => {
    expect(validateCover(bytes, type)).toMatchObject(expected);
  });

  it('honours a custom minimum height', () => {
    expect(validateCover(images.portrait320, 'image/jpeg', { minHeight: 500 })).toMatchObject({ ok: false, reason: 'too-small' });
    expect(validateCover(images.strip575, 'image/jpeg', { minHeight: 50 })).toMatchObject({ ok: false, reason: 'bad-shape' });
  });

  it('rejects a Google image that did not scale to the width asked for', () => {
    expect(validateCover(images.portrait320, 'image/jpeg', { minScaledWidth: 400 })).toMatchObject({ ok: false, reason: 'not-scalable' });
    expect(validateCover(images.large800, 'image/jpeg', { minScaledWidth: 400 })).toMatchObject({ ok: true });
  });
});

describe('coverShape', () => {
  it.each([
    [333, 500, 'portrait'],
    [128, 200, 'portrait'],
    [800, 1247, 'portrait'],
    [1445, 1757, 'portrait'],
    [300, 300, 'square'],
    [500, 460, 'square'],
    [575, 92, 'odd'],
    [200, 600, 'odd'],
  ] as const)('%i×%i is %s', (w, h, shape) => {
    expect(coverShape(w, h)).toBe(shape);
  });
});

describe('ranking', () => {
  it('stops at portrait covers at least 400 px tall', () => {
    expect(isGoodCover({ width: 333, height: 500, shape: 'portrait' })).toBe(true);
    expect(isGoodCover({ width: 128, height: 200, shape: 'portrait' })).toBe(false);
    expect(isGoodCover({ width: 500, height: 500, shape: 'square' })).toBe(false);
  });

  it('prefers portrait to square to odd, then taller', () => {
    const covers = [
      { id: 'square-big', height: 900, shape: 'square' as const },
      { id: 'portrait-small', height: 200, shape: 'portrait' as const },
      { id: 'portrait-big', height: 500, shape: 'portrait' as const },
      { id: 'odd', height: 1000, shape: 'odd' as const },
    ];
    expect([...covers].sort(compareCovers).map((c) => c.id)).toEqual(['portrait-big', 'portrait-small', 'square-big', 'odd']);
  });
});
