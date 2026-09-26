/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter, OfflineError, RateLimitedError } from '@/services/http';
import { createFixtureFetch, type FixtureRoutes } from '@/testing/fixtureFetch';

import { images } from '../__fixtures__/images';
import { coverCandidates, type CoverSource } from '../coverUrls';
import { resolveCover } from '../resolveCover';

const source: CoverSource = {
  isbn13: '9780552166591',
  olEditionCoverIds: [101],
  olWorkCoverIds: [202],
  googleVolumeId: 'vol1',
};
const [edition, work, isbn13, isbn10, google] = coverCandidates(source).map((c) => c.url);

function setup(routes: FixtureRoutes) {
  const fixtures = createFixtureFetch(routes);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { fixtures, http };
}

const jpeg = (bytes: Uint8Array) => ({ bytes });
const missing = { status: 404, text: 'Not Found' };
const offline = () => {
  throw new TypeError('Network request failed');
};

describe('resolveCover', () => {
  it.each<[string, FixtureRoutes, { url: string; origin: string; width: number; height: number } | null, string[]]>([
    [
      'takes a good edition cover and looks no further',
      { [edition]: jpeg(images.large800) },
      { url: edition, origin: 'openlibrary-edition', width: 800, height: 1200 },
      [edition],
    ],
    [
      'falls back to the work cover when the edition has none',
      { [edition]: missing, [work]: jpeg(images.large800) },
      { url: work, origin: 'openlibrary-work', width: 800, height: 1200 },
      [edition, work],
    ],
    [
      'rejects a 1×1 placeholder and an HTML page, then finds one by ISBN',
      { [edition]: { bytes: images.pixelGif, headers: { 'Content-Type': 'image/gif' } }, [work]: { text: '<html>oops</html>' }, [isbn13]: jpeg(images.png400) },
      { url: isbn13, origin: 'openlibrary-isbn13', width: 400, height: 600 },
      [edition, work, isbn13],
    ],
    [
      'prefers a later portrait cover to an earlier padded square',
      { [edition]: jpeg(images.square300), [work]: missing, [isbn13]: jpeg(images.portrait320) },
      { url: isbn13, origin: 'openlibrary-isbn13', width: 320, height: 480 },
      [edition, work, isbn13],
    ],
    [
      'keeps a padded square when nothing better turns up',
      { [edition]: jpeg(images.square300), [work]: missing, [isbn13]: missing, [isbn10]: missing, [google]: missing },
      { url: edition, origin: 'openlibrary-edition', width: 300, height: 300 },
      [edition, work, isbn13, isbn10, google],
    ],
    [
      'reaches Google Books last (within a larger budget)',
      { [edition]: missing, [work]: missing, [isbn13]: missing, [isbn10]: missing, [google]: jpeg(images.large800) },
      { url: google, origin: 'googlebooks', width: 800, height: 1200 },
      [edition, work, isbn13, isbn10, google],
    ],
    [
      "rejects Google's thumbnail that ignored the width asked for",
      { [edition]: missing, [work]: missing, [isbn13]: missing, [isbn10]: missing, [google]: jpeg(images.thumb128) },
      null,
      [edition, work, isbn13, isbn10, google],
    ],
    [
      'returns null when no source has a cover',
      { [edition]: missing, [work]: missing, [isbn13]: missing, [isbn10]: missing, [google]: jpeg(images.small128) },
      null,
      [edition, work, isbn13, isbn10, google],
    ],
  ])('%s', async (_name, routes, expected, calls) => {
    const { http, fixtures } = setup(routes);
    const { cover } = await resolveCover(source, { http, maxFetches: 5 });
    if (expected) expect(cover).toMatchObject(expected);
    else expect(cover).toBeNull();
    expect(fixtures.calls).toEqual(calls);
  });

  it('reports what it tried', async () => {
    const { http } = setup({ [edition]: jpeg(images.square300), [work]: jpeg(images.small128), [isbn13]: missing, [isbn10]: jpeg(images.thumb128) });
    const { cover, tried } = await resolveCover(source, { http });
    expect(tried.map((t) => [t.origin, t.outcome, t.width, t.height])).toEqual([
      ['openlibrary-edition', 'passed-over', 300, 300],
      ['openlibrary-work', 'too-small', 128, 100],
      ['openlibrary-isbn13', 'not-found', undefined, undefined],
      ['openlibrary-isbn10', 'accepted', 128, 200],
    ]);
    // A small portrait beats a larger square.
    expect(cover).toMatchObject({ origin: 'openlibrary-isbn10', shape: 'portrait' });
  });

  it('downloads at most maxFetches images', async () => {
    const { http, fixtures } = setup({ [edition]: missing, [work]: missing });
    await expect(resolveCover(source, { http, maxFetches: 2 })).resolves.toMatchObject({ cover: null });
    expect(fixtures.calls).toEqual([edition, work]);
  });

  it('keeps the downloaded bytes so saving needs no second request', async () => {
    const { http } = setup({ [edition]: jpeg(images.large800) });
    const { cover } = await resolveCover(source, { http });
    expect(cover?.bytes).toEqual(images.large800);
    expect(cover?.contentType).toBe('image/jpeg');
  });

  it('skips Google Books when it is turned off', async () => {
    const { http, fixtures } = setup({ [edition]: missing, [work]: missing, [isbn13]: missing, [isbn10]: missing });
    await resolveCover(source, { http, includeGoogle: false, maxFetches: 9 });
    expect(fixtures.calls).not.toContain(google);
  });

  it('rejects with OfflineError when nothing answered', async () => {
    const { http } = setup({ [edition]: offline, [work]: offline, [isbn13]: offline, [isbn10]: offline });
    await expect(resolveCover(source, { http })).rejects.toBeInstanceOf(OfflineError);
  });

  it('treats one unreachable host as a miss when others answered (e.g. no CORS on web)', async () => {
    const { http } = setup({ [edition]: missing, [work]: missing, [isbn13]: missing, [isbn10]: missing, [google]: offline });
    await expect(resolveCover(source, { http, maxFetches: 5 })).resolves.toMatchObject({ cover: null });
  });

  it('rejects with RateLimitedError when nothing was found and a source refused', async () => {
    const { http } = setup({ [edition]: missing, [work]: { status: 429, text: 'slow down' }, [isbn13]: missing, [isbn10]: missing });
    await expect(resolveCover(source, { http })).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('still returns a cover found despite a refusal elsewhere', async () => {
    const { http } = setup({ [edition]: { status: 429, text: 'slow down' }, [work]: jpeg(images.large800) });
    await expect(resolveCover(source, { http })).resolves.toMatchObject({ cover: { origin: 'openlibrary-work' } });
  });

  it('stops when cancelled', async () => {
    const { http } = setup({ [edition]: jpeg(images.large800) });
    await expect(resolveCover(source, { http, signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
