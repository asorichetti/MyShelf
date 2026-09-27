/**
 * @jest-environment node
 */
import { createHttpClient, createRateLimiter, RateLimitedError } from '@/services/http';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { gbFixtures, gbIsbnUrl, gbQuotaExceeded, gbSearchUrl, googleBooksRoutes } from '../__fixtures__/googleBooksRoutes';
import { createGoogleBooks, isDailyQuotaError } from '../googleBooks';
import {
  coverFromImageLinks,
  isbnsFromIdentifiers,
  mapVolume,
  parsePublishedDate,
  seriesHintFromInfo,
} from '../googleBooksMap';

function setup(...extra: Parameters<typeof createFixtureFetch>) {
  const fixtures = createFixtureFetch(googleBooksRoutes, ...extra);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  return { gb: createGoogleBooks({ http }), fixtures };
}

describe('googleBooks.lookupIsbn', () => {
  it('requests the volume with the fields filter and printType=books', async () => {
    const { gb, fixtures } = setup();
    await gb.lookupIsbn('9780552166591');
    expect(fixtures.calls).toEqual([
      'https://www.googleapis.com/books/v1/volumes?q=isbn%3A9780552166591&maxResults=5&printType=books&fields=' +
        encodeURIComponent(
          'totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,language,seriesInfo))',
        ),
    ]);
    expect(fixtures.calls[0]).not.toMatch(/key=/);
  });

  it('maps a volume with an HTML description, categories and seriesInfo', async () => {
    const { gb } = setup();
    const [c, ...rest] = await gb.lookupIsbn('9780552166591');
    expect(rest).toEqual([]);
    expect(c).toEqual({
      kind: 'edition',
      title: 'The Colour Of Magic',
      subtitle: null,
      authors: ['Terry Pratchett'],
      publisher: 'Corgi',
      publicationYear: 2012,
      pageCount: 288,
      isbn13: '9780552166591',
      isbn10: '0552166596',
      edition: null,
      language: 'en',
      format: null,
      summary:
        "The Colour of Magic is Terry Pratchett's maiden voyage through the bizarre land of Discworld.\n\n" +
        'Here is where it all begins – with the tourist Twoflower and his wizard guide, Rincewind.',
      coverUrl: 'https://books.google.com/books/content?id=synthCoM01&printsec=frontcover&img=1&zoom=1&source=gbs_api',
      coverRefs: {
        olEditionCoverIds: [],
        olWorkCoverIds: [],
        googleVolumeId: 'synthCoM01',
        googleImageUrl: 'http://books.google.com/books/content?id=synthCoM01&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
      },
      subjects: ['Fiction / Fantasy / Humorous'],
      seriesHints: [
        { name: null, position: 1, source: 'googlebooks', raw: '1' },
        { name: 'Discworld', position: 1, source: 'googlebooks', raw: '(Discworld Novel 1)' },
      ],
      workKey: null,
      editionCount: null,
      source: 'googlebooks',
      sourceId: 'synthCoM01',
      confidence: 0.85,
    });
  });

  it('maps a volume without a description', async () => {
    const { gb } = setup();
    const [c] = await gb.lookupIsbn('9780553418026');
    expect(c).toMatchObject({ title: 'The Martian', summary: null, subjects: ['Fiction'], publicationYear: 2014, seriesHints: [] });
  });

  it('maps a French volume', async () => {
    const { gb } = setup();
    const [c] = await gb.lookupIsbn('9782070612758');
    expect(c).toMatchObject({ language: 'fr', publicationYear: 2007, subjects: ['Juvenile Fiction'] });
  });

  it('keeps only the volume with the requested ISBN', async () => {
    const { gb } = setup();
    const results = await gb.lookupIsbn('9780141439518');
    expect(results.map((r) => r.sourceId)).toEqual(['synthPandP01']);
    expect(results[0].summary).toBe(
      "Pride and Prejudice, Jane Austen's witty comedy of manners, is one of the most popular novels of all time.\n\n" +
        'It features splendidly civilized sparring between the proud Mr. Darcy and the prejudiced Elizabeth Bennet.',
    );
    expect(results[0].subjects).toEqual(['Fiction / Classics', 'Fiction / Romance / Historical / Regency']);
  });

  it.each(['9788497592208', '9780345339706'])('returns [] when Google Books has no match (%s)', async (isbn) => {
    const { gb } = setup();
    await expect(gb.lookupIsbn(isbn)).resolves.toEqual([]);
  });

  it('fails at once with RateLimitedError on the recorded daily-quota 429', async () => {
    const fixtures = createFixtureFetch({ [gbIsbnUrl('9780552166591')]: gbQuotaExceeded });
    // Default retry delays: without giveUp this would retry three times.
    const client = createGoogleBooks({
      http: createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) }),
    });
    await expect(client.lookupIsbn('9780552166591')).rejects.toBeInstanceOf(RateLimitedError);
    // One request: backing off for seconds cannot lift a daily quota.
    expect(fixtures.calls).toHaveLength(1);
  });
});

describe('googleBooks with an API key', () => {
  const isbn = '9780552166591';
  const keyedUrl = `${gbIsbnUrl(isbn)}&key=test-key`;

  function keyedSetup(apiKey: string) {
    const fixtures = createFixtureFetch({ [keyedUrl]: { body: gbFixtures.colourOfMagic } });
    const stored = new Map<string, string>();
    const cache = {
      read: async (key: string) => stored.get(key) ?? null,
      write: async (key: string, body: string) => void stored.set(key, body),
    };
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [], cache });
    return { gb: createGoogleBooks({ http, apiKey }), fixtures, stored };
  }

  it('sends the key with the request', async () => {
    const { gb, fixtures } = keyedSetup('test-key');
    await expect(gb.lookupIsbn(isbn)).resolves.toHaveLength(1);
    expect(fixtures.calls).toEqual([keyedUrl]);
  });

  it('caches the response under the keyless URL, so the key is never stored', async () => {
    const { gb, fixtures, stored } = keyedSetup('test-key');
    await gb.lookupIsbn(isbn);
    await gb.lookupIsbn(isbn);
    expect([...stored.keys()]).toEqual([gbIsbnUrl(isbn)]);
    expect([...stored.keys()].join()).not.toMatch(/test-key/);
    expect(fixtures.calls).toHaveLength(1);
  });

  it('treats a blank key as no key', async () => {
    const { gb, fixtures } = keyedSetup('   ');
    await gb.lookupIsbn(isbn).catch(() => undefined);
    expect(fixtures.calls[0]).not.toMatch(/key=/);
  });
});

describe('googleBooks.search', () => {
  it('searches with intitle: and inauthor:', async () => {
    const { gb, fixtures } = setup();
    const results = await gb.search({ title: 'the colour of magic', author: 'pratchett' });
    expect(fixtures.calls).toEqual([gbSearchUrl('intitle:"the colour of magic" inauthor:"pratchett"')]);
    expect(fixtures.unmocked).toEqual([]);
    expect(results.map((r) => [r.title, r.isbn13, r.publicationYear])).toEqual([
      ['The Colour of Magic', '9780061020711', 2009],
      ['The Colour Of Magic', '9780552166591', 2012],
      ['The Light Fantastic', '9780552166607', 2012],
    ]);
    expect(results[2].seriesHints).toEqual([{ name: null, position: 2, source: 'googlebooks', raw: '2' }]);
  });

  it('sends free text as the query', async () => {
    const { gb, fixtures } = setup({ [gbSearchUrl('dune frank herbert')]: { body: gbFixtures.empty } });
    await expect(gb.search({ text: '  dune   frank herbert ' })).resolves.toEqual([]);
    expect(fixtures.calls).toEqual([gbSearchUrl('dune frank herbert')]);
  });

  it('does not call the API for an empty query', async () => {
    const { gb, fixtures } = setup();
    await expect(gb.search({})).resolves.toEqual([]);
    expect(fixtures.calls).toEqual([]);
  });
});

describe('Google Books mapping helpers', () => {
  it.each<[string | undefined, number | null]>([
    ['2012-05-10', 2012],
    ['2007-03', 2007],
    ['1985', 1985],
    ['0000', null],
    ['2999-01-01', null],
    ['', null],
    [undefined, null],
  ])('publishedDate %p → %p', (date, year) => {
    expect(parsePublishedDate(date)).toBe(year);
  });

  it('rewrites thumbnails to https and drops edge=curl', () => {
    expect(
      coverFromImageLinks({ thumbnail: 'http://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' }),
    ).toBe('https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&source=gbs_api');
    expect(coverFromImageLinks({ smallThumbnail: 'http://books.google.com/books/content?edge=curl&id=y' })).toBe(
      'https://books.google.com/books/content?id=y',
    );
    expect(coverFromImageLinks({ thumbnail: 'http://x.test/c?edge=curl' })).toBe('https://x.test/c');
    expect(coverFromImageLinks(undefined)).toBeNull();
  });

  it('reads ISBNs from industryIdentifiers and derives the missing one', () => {
    expect(isbnsFromIdentifiers([{ type: 'ISBN_13', identifier: '9780552166607' }])).toEqual({
      isbn13: '9780552166607',
      isbn10: '055216660X',
    });
    expect(isbnsFromIdentifiers([{ type: 'ISBN_10', identifier: '0-552-16659-6' }])).toEqual({
      isbn13: '9780552166591',
      isbn10: '0552166596',
    });
    expect(isbnsFromIdentifiers([{ type: 'OTHER', identifier: 'UOM:39015' }, { type: 'ISBN_13', identifier: '9780000000001' }])).toEqual({
      isbn13: null,
      isbn10: null,
    });
  });

  it('turns bookDisplayNumber into a position-only hint', () => {
    expect(seriesHintFromInfo({ bookDisplayNumber: '3' })).toEqual([{ name: null, position: 3, source: 'googlebooks', raw: '3' }]);
    expect(seriesHintFromInfo({ bookDisplayNumber: '2.5' })[0].position).toBe(2.5);
    expect(seriesHintFromInfo({ volumeSeries: [{ orderNumber: 4 }] })[0].position).toBe(4);
    expect(seriesHintFromInfo(undefined)).toEqual([]);
  });

  it('skips volumes without an id or title', () => {
    expect(mapVolume({ volumeInfo: { title: 'x' } })).toBeNull();
    expect(mapVolume({ id: 'x', volumeInfo: {} })).toBeNull();
    expect(mapVolume({ id: 'x', volumeInfo: { title: 'X', pageCount: 0 } })).toMatchObject({ pageCount: null, authors: [] });
  });

  it('recognises the recorded daily-quota body', () => {
    expect(isDailyQuotaError(429, JSON.stringify(gbFixtures.quotaExceeded))).toBe(true);
    expect(isDailyQuotaError(429, '{"error":{"code":429,"message":"Too many requests"}}')).toBe(false);
    expect(isDailyQuotaError(503, 'per day')).toBe(false);
  });
});
