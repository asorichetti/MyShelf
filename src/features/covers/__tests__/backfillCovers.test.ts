/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, coverAttemptsRepo, type Db } from '@/db';
import { olCoverByIdUrl, olCoverByKeyUrl } from '@/services/covers';
import { images } from '@/services/covers/__fixtures__/images';
import { createHttpClient, createRateLimiter, HttpError, OfflineError } from '@/services/http';
import { makeCandidate, type BookCandidate, type MetadataResult } from '@/services/metadata';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch, type FixtureRoutes } from '@/testing/fixtureFetch';

import { backfillCovers, type BackfillCoversOptions } from '../backfillCovers';

const T0 = Date.parse('2026-09-01T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const missing = { status: 404, text: 'Not Found' };
const result = (...candidates: BookCandidate[]): MetadataResult => ({ candidates, warnings: [] });

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

async function addBook(title: string, fields: { isbn13?: string; author?: string } = {}) {
  const book = await booksRepo.createBook(db, { title, isbn13: fields.isbn13 ?? null, source: 'manual' });
  if (fields.author) await authorsRepo.setBookAuthors(db, book.id, [{ authorId: (await authorsRepo.findOrCreateAuthor(db, fields.author)).id }]);
  return book;
}

function setup(routes: FixtureRoutes, extra: Partial<BackfillCoversOptions> = {}) {
  const fixtures = createFixtureFetch(routes);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  let clock = T0;
  const options: BackfillCoversOptions = {
    http,
    now: () => clock,
    downloadCover: async (bookId) => `file:///doc/covers/${bookId}.jpg`,
    lookupIsbn: jest.fn(async () => result()),
    search: jest.fn(async () => result()),
    ...extra,
  };
  return { fixtures, options, setNow: (ms: number) => (clock = ms) };
}

const coverOf = async (id: number) => (await booksRepo.getBook(db, id))?.coverUri;

describe('backfillCovers', () => {
  it('finds a cover for a hand-typed book through an ISBN lookup', async () => {
    const book = await addBook('The Colour of Magic', { isbn13: '9780552166591' });
    const candidate = makeCandidate({
      title: 'The Colour of Magic',
      source: 'openlibrary',
      sourceId: 'OL28477029M',
      isbn13: '9780552166591',
      coverRefs: { olEditionCoverIds: [14647238], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null },
    });
    const { options, fixtures } = setup({ [olCoverByIdUrl(14647238)]: { bytes: images.large800 } }, { lookupIsbn: jest.fn(async () => result(candidate)) });

    await expect(backfillCovers(db, options)).resolves.toEqual({ checked: 1, attached: 1, none: 0, failed: 0, offline: false });
    expect(options.lookupIsbn).toHaveBeenCalledWith('9780552166591', undefined);
    expect(fixtures.calls).toEqual([olCoverByIdUrl(14647238)]);
    expect(await coverOf(book.id)).toBe(`file:///doc/covers/${book.id}.jpg`);
  });

  it('still tries the ISBN cover URLs when the lookup fails', async () => {
    const book = await addBook('Dune', { isbn13: '9780441172719' });
    const { options } = setup(
      { [olCoverByKeyUrl('isbn', '9780441172719')]: { bytes: images.portrait320 } },
      { lookupIsbn: jest.fn(async () => Promise.reject(new HttpError(500, 'https://openlibrary.org'))) },
    );
    await expect(backfillCovers(db, options)).resolves.toMatchObject({ attached: 1 });
    expect(await coverOf(book.id)).toBeTruthy();
  });

  it('searches by title and author for a book without an ISBN, and only trusts a match', async () => {
    const right = await addBook('Mort', { author: 'Terry Pratchett' });
    const namesake = await addBook('Mort', { author: 'Someone Else' });
    const noAuthor = await addBook('Mort');
    const found = makeCandidate({
      kind: 'work',
      title: 'Mort',
      authors: ['Terry Pratchett'],
      source: 'openlibrary',
      sourceId: 'OL453936W',
      coverRefs: { olEditionCoverIds: [], olWorkCoverIds: [555], googleVolumeId: null, googleImageUrl: null },
    });
    const { options, fixtures } = setup({ [olCoverByIdUrl(555)]: { bytes: images.large800 } }, { search: jest.fn(async () => result(found)) });

    await expect(backfillCovers(db, options)).resolves.toEqual({ checked: 3, attached: 1, none: 2, failed: 0, offline: false });
    expect(options.search).toHaveBeenCalledTimes(2); // not for the book with no author
    expect(options.search).toHaveBeenCalledWith({ title: 'Mort', author: 'Terry Pratchett' }, undefined);
    expect(fixtures.calls).toEqual([olCoverByIdUrl(555)]);
    expect(await coverOf(right.id)).toBeTruthy();
    expect(await coverOf(namesake.id)).toBeNull();
    expect(await coverAttemptsRepo.get(db, noAuthor.id)).toMatchObject({ lastResult: 'none' });
  });

  it('backs off after an empty search instead of hammering the APIs', async () => {
    const book = await addBook('Obscure', { isbn13: '9780552166591' });
    const isbnUrls = [olCoverByKeyUrl('isbn', '9780552166591'), olCoverByKeyUrl('isbn', '0552166596')];
    const { options, fixtures, setNow } = setup(Object.fromEntries(isbnUrls.map((u) => [u, missing])));

    const runs: [number, number][] = [
      [T0, 1], // first search
      [T0 + HOUR, 0], // waits a day
      [T0 + DAY, 1], // second search
      [T0 + 7 * DAY, 0], // now waits a week
      [T0 + 8 * DAY, 1],
    ];
    for (const [at, checked] of runs) {
      setNow(at);
      expect((await backfillCovers(db, options)).checked).toBe(checked);
    }
    expect(fixtures.calls).toHaveLength(3 * isbnUrls.length);
    expect(await coverAttemptsRepo.get(db, book.id)).toMatchObject({ attempts: 3, retryAfter: new Date(T0 + 38 * DAY).toISOString() });
  });

  it('stops at the first sign of being offline and records nothing', async () => {
    const a = await addBook('A', { isbn13: '9780552166591' });
    await addBook('B', { isbn13: '9780441172719' });
    const lookupIsbn = jest.fn(async () => Promise.reject(new OfflineError('https://openlibrary.org')));
    const { options, fixtures } = setup({}, { lookupIsbn });
    await expect(backfillCovers(db, options)).resolves.toEqual({ checked: 0, attached: 0, none: 0, failed: 0, offline: true });
    expect(lookupIsbn).toHaveBeenCalledTimes(1);
    expect(fixtures.calls).toEqual([]);
    expect(await coverAttemptsRepo.get(db, a.id)).toBeNull();
  });

  it('looks at a few books per run', async () => {
    for (const title of ['A', 'B', 'C', 'D']) await addBook(title);
    const { options } = setup({});
    expect((await backfillCovers(db, { ...options, limit: 3 })).checked).toBe(3);
    expect((await backfillCovers(db, { ...options, limit: 3 })).checked).toBe(1);
  });
});
