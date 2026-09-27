/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter, OfflineError, type HttpClient, type HttpRequestOptions } from '@/services/http';
import { createFixtureFetch, type FixtureFetch } from '@/testing/fixtureFetch';

import { OL_BOOKS, openLibraryRoutes } from '../__fixtures__/openLibraryRoutes';
import { createOpenLibrary } from '../openLibrary';

const OL = 'https://openlibrary.org';

function setup(...extra: Parameters<typeof createFixtureFetch>) {
  const fixtures = createFixtureFetch(openLibraryRoutes, ...extra);
  // No spacing between requests: the limiter itself is tested in the HTTP client suite.
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { ol: createOpenLibrary({ http }), fixtures };
}

let fixtures: FixtureFetch;
afterEach(() => {
  expect(fixtures.unmocked).toEqual([]);
});

describe('openLibrary.lookupIsbn', () => {
  it('reads the edition, then its work and author', async () => {
    const s = setup();
    fixtures = s.fixtures;
    const [candidate, ...rest] = await s.ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(rest).toEqual([]);
    expect(fixtures.calls).toEqual([
      `${OL}/isbn/9780552166591.json`,
      `${OL}/works/OL453657W.json`,
      `${OL}/authors/OL25712A.json`,
    ]);
    expect(candidate).toMatchObject({
      title: 'The Colour of Magic',
      authors: ['Terry Pratchett'],
      publicationYear: 1985,
      isbn13: '9780552166591',
      format: 'paperback',
      seriesHints: [{ name: 'Discworld', position: 1 }],
      sourceId: 'OL28477029M',
      confidence: 0.95,
    });
    expect(candidate.summary).toMatch(/Discworld/);
  });

  it("falls back to the work's authors when the edition has none", async () => {
    const s = setup();
    fixtures = s.fixtures;
    const [martian] = await s.ol.lookupIsbn(OL_BOOKS.theMartian);
    expect(martian.authors).toEqual(['Andy Weir']);
    const [potter] = await s.ol.lookupIsbn(OL_BOOKS.philosophersStone);
    expect(potter.authors).toEqual(['J. K. Rowling']);
  });

  it.each([
    ['prideAndPrejudice', 'Pride and Prejudice', ['Jane Austen'], 2003, 'paperback', 'en'],
    ['petitPrince', 'Le Petit Prince', ['Antoine de Saint-Exupéry'], 2007, 'paperback', 'fr'],
    ['fellowship', 'The Fellowship of the Ring', ['J.R.R. Tolkien'], 2001, 'paperback', 'en'],
    ['cienAnos', 'Cien años de soledad', ['Gabriel García Márquez'], 2003, null, 'es'],
    ['dune', 'Dune', ['Frank Herbert'], 1987, null, 'en'],
    ['movingPictures', 'Moving Pictures', ['Terry Pratchett'], 1991, 'paperback', 'en'],
  ] as const)('maps %s', async (book, title, authors, year, format, language) => {
    const s = setup();
    fixtures = s.fixtures;
    const [c] = await s.ol.lookupIsbn(OL_BOOKS[book]);
    expect(c).toMatchObject({ title, authors, publicationYear: year, format, language, isbn13: OL_BOOKS[book] });
  });

  it('maps an edition with no work description or authors', async () => {
    const s = setup();
    fixtures = s.fixtures;
    const [c] = await s.ol.lookupIsbn(OL_BOOKS.noDescription);
    expect(c).toMatchObject({ title: 'Kitab Jurumiyyah', authors: [], summary: null });
  });

  it('returns [] for an ISBN Open Library does not know (404)', async () => {
    const s = setup();
    fixtures = s.fixtures;
    await expect(s.ol.lookupIsbn(OL_BOOKS.unknown)).resolves.toEqual([]);
    expect(fixtures.calls).toEqual([`${OL}/isbn/9791099999993.json`]);
  });

  it('still returns the edition when its work or author has gone (404)', async () => {
    const s = setup({
      [`${OL}/works/OL453657W.json`]: { status: 404, text: 'gone' },
      [`${OL}/authors/OL25712A.json`]: { status: 404, text: 'gone' },
    });
    fixtures = s.fixtures;
    const [c] = await s.ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    expect(c).toMatchObject({ title: 'The Colour of Magic', authors: [], summary: null, subjects: expect.any(Array) });
  });

  it('remembers author names between lookups', async () => {
    const s = setup();
    fixtures = s.fixtures;
    await s.ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    await s.ol.lookupIsbn(OL_BOOKS.movingPictures);
    expect(fixtures.calls.filter((u) => u.includes('/authors/'))).toEqual([`${OL}/authors/OL25712A.json`]);
  });

  it('propagates being offline', async () => {
    fixtures = createFixtureFetch();
    const http = createHttpClient({
      fetch: async () => {
        throw new TypeError('Network request failed');
      },
      limiter: createRateLimiter({ minIntervalMs: 0 }),
    });
    await expect(createOpenLibrary({ http }).lookupIsbn(OL_BOOKS.colourOfMagic)).rejects.toBeInstanceOf(OfflineError);
  });

  it('stops when aborted', async () => {
    const s = setup();
    fixtures = s.fixtures;
    await expect(s.ol.lookupIsbn(OL_BOOKS.colourOfMagic, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
    expect(fixtures.calls).toEqual([]);
  });

  it("finishes a lookup whose author request another, cancelled lookup started", async () => {
    const s = setup();
    fixtures = s.fixtures;
    const client = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
    // Author requests wait for the gate, as on a slow network.
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => (open = resolve));
    const http: HttpClient = {
      getBinary: client.getBinary,
      getJson: async <T,>(url: string, options?: HttpRequestOptions) => {
        if (url.includes('/authors/')) await gate;
        return client.getJson<T>(url, options);
      },
    };
    const ol = createOpenLibrary({ http });
    const cancelled = new AbortController();
    const first = ol.lookupIsbn(OL_BOOKS.colourOfMagic, cancelled.signal).catch((e: Error) => e);
    const second = ol.lookupIsbn(OL_BOOKS.colourOfMagic);
    await new Promise((resolve) => setTimeout(resolve, 20));
    cancelled.abort();
    open();
    expect(await first).toMatchObject({ name: 'AbortError' });
    await expect(second).resolves.toMatchObject([{ authors: ['Terry Pratchett'] }]);
  });
});
