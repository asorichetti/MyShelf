/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, coverAttemptsRepo, type Db } from '@/db';
import { olCoverByIdUrl, olCoverByKeyUrl, type CoverSource } from '@/services/covers';
import { images } from '@/services/covers/__fixtures__/images';
import { createHttpClient, createRateLimiter, HttpError, OfflineError } from '@/services/http';
import type { FetchLike } from '@/services/http';
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

  describe('with a batch search for cover ids', () => {
    const ISBNS = ['9780060853983', '9780441172719', '9780547928227', '9780451524935', '9780756404741', '9780765350381'];
    const ids = (n: number) => 1000 + n;
    const batchOf = (isbns: string[]) => new Map<string, CoverSource>(isbns.map((isbn, n) => [isbn, { isbn13: isbn, olEditionCoverIds: [ids(n)] }]));

    it('uses the ids it finds, looks the rest up one by one, and stores the found ones first', async () => {
      const hitA = await addBook('Good Omens', { isbn13: ISBNS[0] });
      const miss = await addBook('Dune', { isbn13: ISBNS[1] });
      const noIsbn = await addBook('Mort', { author: 'Terry Pratchett' });
      const hitB = await addBook('The Hobbit', { isbn13: ISBNS[2] });
      const findCoverIds = jest.fn(async () => batchOf([ISBNS[0], 'x', ISBNS[2]]));
      const lookedUp = makeCandidate({ title: 'Dune', source: 'openlibrary', sourceId: 'OL1M', isbn13: ISBNS[1], coverRefs: { olEditionCoverIds: [7], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null } });
      const searched = makeCandidate({ kind: 'work', title: 'Mort', authors: ['Terry Pratchett'], source: 'openlibrary', sourceId: 'OL2W', coverRefs: { olEditionCoverIds: [], olWorkCoverIds: [8], googleVolumeId: null, googleImageUrl: null } });
      const attached: number[] = [];
      const { options, fixtures } = setup(
        Object.fromEntries([ids(0), ids(2), 7, 8].map((id) => [olCoverByIdUrl(id), { bytes: images.large800 }])),
        { findCoverIds, lookupIsbn: jest.fn(async () => result(lookedUp)), search: jest.fn(async () => result(searched)), onAttached: (id) => attached.push(id) },
      );

      await expect(backfillCovers(db, options)).resolves.toEqual({ checked: 4, attached: 4, none: 0, failed: 0, offline: false });
      // One search for every book with an ISBN (newest first); no lookup for the books it found.
      expect(findCoverIds).toHaveBeenCalledTimes(1);
      expect(findCoverIds).toHaveBeenCalledWith([ISBNS[2], ISBNS[1], ISBNS[0]], undefined);
      expect(options.lookupIsbn).toHaveBeenCalledTimes(1);
      expect(options.lookupIsbn).toHaveBeenCalledWith(ISBNS[1], undefined);
      expect(options.search).toHaveBeenCalledTimes(1);
      // Found books first (newest first), then the looked-up ones.
      expect(attached).toEqual([hitB.id, hitA.id, noIsbn.id, miss.id]);
      expect(fixtures.calls).toEqual([olCoverByIdUrl(ids(2)), olCoverByIdUrl(ids(0)), olCoverByIdUrl(8), olCoverByIdUrl(7)]);
    });

    it('finds ids for a book known only by its ISBN-10', async () => {
      const book = await booksRepo.createBook(db, { title: 'Dune', isbn10: '0441172717', source: 'manual' });
      const findCoverIds = jest.fn(async (isbns: string[]) => batchOf(isbns));
      const { options } = setup({ [olCoverByIdUrl(ids(0))]: { bytes: images.large800 } }, { findCoverIds });
      await expect(backfillCovers(db, options)).resolves.toMatchObject({ attached: 1 });
      expect(findCoverIds).toHaveBeenCalledWith(['9780441172719'], undefined);
      expect(options.lookupIsbn).not.toHaveBeenCalled();
      expect(await coverOf(book.id)).toBeTruthy();
    });

    it('falls back to the full lookup when the found ids lead to no usable image, before recording anything', async () => {
      const book = await addBook('Good Omens', { isbn13: ISBNS[0] });
      const lookedUp = makeCandidate({ title: 'Good Omens', source: 'openlibrary', sourceId: 'OL3M', isbn13: ISBNS[0], coverRefs: { olEditionCoverIds: [42], olWorkCoverIds: [], googleVolumeId: null, googleImageUrl: null } });
      const isbnUrls = [olCoverByKeyUrl('isbn', ISBNS[0]), olCoverByKeyUrl('isbn', '0060853980')];
      const { options, fixtures } = setup(
        { [olCoverByIdUrl(ids(0))]: { bytes: images.pixelGif, headers: { 'Content-Type': 'image/gif' } }, ...Object.fromEntries(isbnUrls.map((u) => [u, missing])), [olCoverByIdUrl(42)]: { bytes: images.large800 } },
        { findCoverIds: jest.fn(async () => batchOf([ISBNS[0]])), lookupIsbn: jest.fn(async () => result(lookedUp)) },
      );
      await expect(backfillCovers(db, options)).resolves.toMatchObject({ checked: 1, attached: 1 });
      // The ISBN cover URLs were tried once, not again after the lookup.
      expect(fixtures.calls).toEqual([olCoverByIdUrl(ids(0)), ...isbnUrls, olCoverByIdUrl(42)]);
      expect(await coverOf(book.id)).toBeTruthy();
      expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
    });

    it('records one empty search when neither the batch nor the lookup has a cover', async () => {
      const book = await addBook('Good Omens', { isbn13: ISBNS[0] });
      const { options } = setup({}, { findCoverIds: jest.fn(async () => batchOf([ISBNS[0]])) });
      // Unrouted URLs answer 501, an HTTP error: no cover anywhere.
      await expect(backfillCovers(db, options)).resolves.toMatchObject({ checked: 1, none: 1 });
      expect(await coverAttemptsRepo.get(db, book.id)).toMatchObject({ attempts: 1, lastResult: 'none' });
    });

    it('stops without recording anything when the batch search finds the network gone', async () => {
      const book = await addBook('Good Omens', { isbn13: ISBNS[0] });
      const { options, fixtures } = setup({}, { findCoverIds: jest.fn(async () => Promise.reject(new OfflineError('https://openlibrary.org'))) });
      await expect(backfillCovers(db, options)).resolves.toEqual({ checked: 0, attached: 0, none: 0, failed: 0, offline: true });
      expect(options.lookupIsbn).not.toHaveBeenCalled();
      expect(fixtures.calls).toEqual([]);
      expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
    });

    it('looks every book up one by one when the batch search fails', async () => {
      await addBook('Good Omens', { isbn13: ISBNS[0] });
      const { options } = setup({}, { findCoverIds: jest.fn(async () => Promise.reject(new HttpError(500, 'https://openlibrary.org'))) });
      await backfillCovers(db, options);
      expect(options.lookupIsbn).toHaveBeenCalledWith(ISBNS[0], undefined);
    });

    it('works on at most `concurrency` books at once, and each cover is announced as it is stored', async () => {
      for (const [n, isbn] of ISBNS.entries()) await addBook(`Book ${n}`, { isbn13: isbn });
      const routes = createFixtureFetch(Object.fromEntries(ISBNS.map((_, n) => [olCoverByIdUrl(ids(n)), { bytes: images.large800 }])));
      let inFlight = 0;
      let most = 0;
      let started = 0;
      const slowFetch: FetchLike = async (url, init) => {
        started++;
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return routes.fetch(url, init);
      };
      const http = createHttpClient({ fetch: slowFetch, limiter: createRateLimiter({ minIntervalMs: 0, maxConcurrent: 10 }), retryDelaysMs: [] });
      const events: string[] = [];
      const { options } = setup({}, { http, findCoverIds: jest.fn(async (isbns: string[]) => batchOf([...isbns].reverse())), concurrency: 3, limit: 10 });
      const summary = await backfillCovers(db, {
        ...options,
        onAttached: () => void events.push(`attached after ${started} downloads started`),
      });
      expect(summary).toMatchObject({ checked: 6, attached: 6 });
      expect(most).toBe(3);
      expect(events).toHaveLength(6);
      // Progressive: the first cover was announced before the last download had started.
      expect(Number(/\d+/.exec(events[0])![0])).toBeLessThan(6);
    });

    it('leaves books another run is working on to that run', async () => {
      for (const isbn of ISBNS.slice(0, 3)) await addBook(isbn, { isbn13: isbn });
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const findCoverIds = jest.fn(async (isbns: string[]) => {
        await gate;
        return batchOf(isbns);
      });
      const { options } = setup(Object.fromEntries([0, 1, 2].map((n) => [olCoverByIdUrl(ids(n)), { bytes: images.large800 }])), { findCoverIds });
      const first = backfillCovers(db, { ...options, limit: 2 });
      await new Promise((r) => setTimeout(r, 0));
      const second = backfillCovers(db, { ...options, limit: 10 });
      release();
      const [a, b] = await Promise.all([first, second]);
      expect(a.checked + b.checked).toBe(3);
      expect(findCoverIds.mock.calls.map(([isbns]) => isbns.length).sort()).toEqual([1, 2]);
    });
  });
});
