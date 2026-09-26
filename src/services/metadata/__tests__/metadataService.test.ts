/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter, HttpError, OfflineError, RateLimitedError } from '@/services/http';
import { createFixtureFetch, type FixtureRoutes } from '@/testing/fixtureFetch';

import { gbIsbnUrl, gbQuotaExceeded, googleBooksRoutes } from '../__fixtures__/googleBooksRoutes';
import { OL_BOOKS, openLibraryRoutes } from '../__fixtures__/openLibraryRoutes';
import { createGoogleBooks } from '../googleBooks';
import { createDefaultMetadataService, createMetadataService, InvalidIsbnError, toIsbn13 } from '../index';
import { createOpenLibrary } from '../openLibrary';

import type { MetadataProvider } from '../types';

function setup(extra: FixtureRoutes = {}, options: Partial<Parameters<typeof createDefaultMetadataService>[0]> = {}) {
  const fixtures = createFixtureFetch(openLibraryRoutes, googleBooksRoutes, extra);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { service: createDefaultMetadataService({ http, ...options }), fixtures, http };
}

const offline = () => {
  throw new TypeError('Network request failed');
};

describe('metadataService.lookupIsbn', () => {
  it('merges both providers into one candidate', async () => {
    const { service, fixtures } = setup();
    const { candidates, warnings } = await service.lookupIsbn('978-0-552-16659-1');
    expect(warnings).toEqual([]);
    expect(fixtures.unmocked).toEqual([]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      title: 'The Colour of Magic',
      publisher: 'Corgi Books',
      publicationYear: 1985,
      source: 'openlibrary',
      sourceId: 'OL28477029M',
    });
    expect(candidates[0].subjects).toContain('Fiction / Fantasy / Humorous');
  });

  it('accepts an ISBN-10 and looks it up as ISBN-13', async () => {
    const { service, fixtures } = setup();
    const { candidates } = await service.lookupIsbn('0-345-33970-3');
    expect(fixtures.calls[0]).toBe('https://openlibrary.org/isbn/9780345339706.json');
    expect(candidates[0]).toMatchObject({ title: 'The Fellowship of the Ring', isbn13: '9780345339706', isbn10: '0345339703' });
  });

  it('returns the Open Library result alone when Google Books has no match', async () => {
    const { service } = setup();
    const { candidates, warnings } = await service.lookupIsbn(OL_BOOKS.cienAnos);
    expect(warnings).toEqual([]);
    expect(candidates.map((c) => c.source)).toEqual(['openlibrary']);
  });

  it('returns [] when neither provider knows the ISBN', async () => {
    const { service } = setup();
    await expect(service.lookupIsbn(OL_BOOKS.unknown)).resolves.toEqual({ candidates: [], warnings: [] });
  });

  it('rejects invalid ISBNs without a request', async () => {
    const { service, fixtures } = setup();
    await expect(service.lookupIsbn('9780552166592')).rejects.toBeInstanceOf(InvalidIsbnError);
    await expect(service.lookupIsbn('hello')).rejects.toBeInstanceOf(InvalidIsbnError);
    expect(fixtures.calls).toEqual([]);
  });

  it('still returns Open Library results with a warning when Google Books fails (500)', async () => {
    const { service } = setup({ [gbIsbnUrl(OL_BOOKS.colourOfMagic)]: { status: 500, text: 'boom' } });
    const { candidates, warnings } = await service.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(candidates.map((c) => c.sourceId)).toEqual(['OL28477029M']);
    expect(warnings).toEqual([{ provider: 'googlebooks', reason: 'failed', message: expect.stringContaining('500') }]);
  });

  it('still returns Google Books results with a warning when Open Library fails', async () => {
    const { service } = setup({ [`https://openlibrary.org/isbn/${OL_BOOKS.theMartian}.json`]: { status: 503, text: '' } });
    const { candidates, warnings } = await service.lookupIsbn(OL_BOOKS.theMartian);
    expect(candidates.map((c) => c.sourceId)).toEqual(['synthMartian1']);
    expect(warnings).toMatchObject([{ provider: 'openlibrary', reason: 'failed' }]);
  });

  it('rests Google Books after its daily quota 429, then tries again', async () => {
    let now = 0;
    const { service, fixtures } = setup({ [gbIsbnUrl(OL_BOOKS.colourOfMagic)]: gbQuotaExceeded }, { clock: { now: () => now } });
    const first = await service.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(first.candidates).toHaveLength(1);
    expect(first.warnings).toMatchObject([{ provider: 'googlebooks', reason: 'rate-limited' }]);

    const second = await service.lookupIsbn(OL_BOOKS.theMartian);
    expect(second.warnings).toMatchObject([{ provider: 'googlebooks', reason: 'rate-limited' }]);
    expect(fixtures.calls.filter((u) => u.includes('googleapis'))).toHaveLength(1);

    now = 60 * 60 * 1000;
    const third = await service.lookupIsbn(OL_BOOKS.theMartian);
    expect(third.warnings).toEqual([]);
    expect(fixtures.calls.filter((u) => u.includes('googleapis'))).toHaveLength(2);
  });

  it('skips Google Books when the setting turns it off', async () => {
    const { service, fixtures } = setup({}, { isGoogleBooksEnabled: async () => false });
    const { candidates } = await service.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(candidates[0].subjects).not.toContain('Fiction / Fantasy / Humorous');
    expect(fixtures.calls.some((u) => u.includes('googleapis'))).toBe(false);
  });

  it('rejects with OfflineError when no provider can be reached', async () => {
    const http = createHttpClient({ fetch: offline, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const service = createDefaultMetadataService({ http });
    await expect(service.lookupIsbn(OL_BOOKS.colourOfMagic)).rejects.toBeInstanceOf(OfflineError);
  });

  it('prefers OfflineError when one provider is offline and the other failed', async () => {
    const failing: MetadataProvider = {
      id: 'googlebooks',
      lookupIsbn: async () => Promise.reject(new HttpError(500, 'x')),
      search: async () => [],
    };
    const http = createHttpClient({ fetch: offline, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const service = createMetadataService({ openLibrary: createOpenLibrary({ http }), googleBooks: failing });
    await expect(service.lookupIsbn(OL_BOOKS.colourOfMagic)).rejects.toBeInstanceOf(OfflineError);
  });

  it('rejects with the first error when both fail for other reasons', async () => {
    const fixtures = createFixtureFetch({
      [`https://openlibrary.org/isbn/${OL_BOOKS.colourOfMagic}.json`]: { status: 500, text: '' },
      [gbIsbnUrl(OL_BOOKS.colourOfMagic)]: gbQuotaExceeded,
    });
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
    const service = createMetadataService({ openLibrary: createOpenLibrary({ http }), googleBooks: createGoogleBooks({ http }) });
    const error = await service.lookupIsbn(OL_BOOKS.colourOfMagic).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).not.toBeInstanceOf(RateLimitedError);
  });

  it('rejects with AbortError when cancelled', async () => {
    const { service } = setup();
    await expect(service.lookupIsbn(OL_BOOKS.colourOfMagic, { signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('works with Open Library alone', async () => {
    const fixtures = createFixtureFetch(openLibraryRoutes);
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const service = createMetadataService({ openLibrary: createOpenLibrary({ http }) });
    const { candidates } = await service.lookupIsbn(OL_BOOKS.dune);
    expect(candidates[0].title).toBe('Dune');
  });
});

describe('metadataService.search', () => {
  it('returns ranked results and a warning when one provider throws', async () => {
    const failing: MetadataProvider = {
      id: 'googlebooks',
      lookupIsbn: async () => [],
      search: async () => Promise.reject(new HttpError(500, 'x')),
    };
    const fixtures = createFixtureFetch(openLibraryRoutes);
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const service = createMetadataService({ openLibrary: createOpenLibrary({ http }), googleBooks: failing });
    const { candidates, warnings } = await service.search({ title: 'the colour of magic', author: 'pratchett' });
    expect(candidates[0]).toMatchObject({ title: 'The Colour of Magic', workKey: 'OL453657W' });
    expect(warnings).toMatchObject([{ provider: 'googlebooks', reason: 'failed' }]);
  });

  it('ignores an empty query', async () => {
    const { service, fixtures } = setup();
    await expect(service.search({ text: '  ' })).resolves.toEqual({ candidates: [], warnings: [] });
    expect(fixtures.calls).toEqual([]);
  });

  it('lists editions through Open Library', async () => {
    const { service } = setup();
    const editions = await service.editions('OL453657W');
    expect(editions).toHaveLength(13);
  });
});

describe('toIsbn13', () => {
  it.each([
    ['9780552166591', '9780552166591'],
    ['978-0-552-16659-1', '9780552166591'],
    ['0552166596', '9780552166591'],
    ['055216660x', '9780552166607'],
    ['9780552166592', null],
    ['', null],
  ])('%p → %p', (input, expected) => {
    expect(toIsbn13(input)).toBe(expected);
  });

});
