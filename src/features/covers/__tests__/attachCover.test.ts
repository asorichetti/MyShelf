/**
 * @jest-environment node
 */
import { booksRepo, coverAttemptsRepo, type Db } from '@/db';
import { coverCandidates, type CoverSource } from '@/services/covers';
import { images } from '@/services/covers/__fixtures__/images';
import { createHttpClient, createRateLimiter, type HttpClient } from '@/services/http';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch, type FixtureRoutes } from '@/testing/fixtureFetch';

import { attachBestCover } from '../attachCover';

const T0 = Date.parse('2026-09-01T12:00:00.000Z');
const source: CoverSource = { isbn13: '9780552166591', olEditionCoverIds: [101] };
const [edition, byIsbn13, byIsbn10] = coverCandidates(source).map((c) => c.url);
const missing = { status: 404, text: 'Not Found' };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

function setup(routes: FixtureRoutes) {
  const fixtures = createFixtureFetch(routes);
  const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }), retryDelaysMs: [] });
  const stored: { bookId: number; url: string; bytes: Uint8Array }[] = [];
  const downloadCover = jest.fn(async (bookId: number, url: string, { http: client }: { http: Pick<HttpClient, 'getBinary'> }) => {
    const { bytes } = await client.getBinary(url);
    stored.push({ bookId, url, bytes });
    return `file:///doc/covers/${bookId}.jpg`;
  });
  return { fixtures, http, stored, downloadCover };
}

describe('attachBestCover', () => {
  it('stores the best real cover without downloading it twice', async () => {
    const book = await booksRepo.createBook(db, { title: 'The Colour of Magic', isbn13: '9780552166591' });
    await coverAttemptsRepo.recordAttempt(db, book.id, 'none', { now: T0 });
    const { http, fixtures, stored, downloadCover } = setup({ [edition]: { bytes: images.large800 } });

    const result = await attachBestCover(db, book.id, source, { http, downloadCover });

    expect(result).toMatchObject({
      status: 'attached',
      coverUri: `file:///doc/covers/${book.id}.jpg`,
      cover: { url: edition, origin: 'openlibrary-edition', width: 800, height: 1200 },
    });
    expect(result).not.toHaveProperty('cover.bytes');
    expect(fixtures.calls).toEqual([edition]);
    expect(stored).toEqual([{ bookId: book.id, url: edition, bytes: images.large800 }]);
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBe(`file:///doc/covers/${book.id}.jpg`);
    expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
  });

  it('records an empty search so the backfill waits', async () => {
    const book = await booksRepo.createBook(db, { title: 'Obscure', isbn13: '9780552166591' });
    const { http, downloadCover } = setup({ [edition]: missing, [byIsbn13]: missing, [byIsbn10]: { bytes: images.pixelGif } });
    const result = await attachBestCover(db, book.id, source, { http, downloadCover, now: () => T0 });
    expect(result).toMatchObject({ status: 'none', tried: [{ outcome: 'not-found' }, { outcome: 'not-found' }, { outcome: 'placeholder' }] });
    expect(downloadCover).not.toHaveBeenCalled();
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBeNull();
    expect(await coverAttemptsRepo.get(db, book.id)).toMatchObject({ attempts: 1, lastResult: 'none' });
  });

  it('records nothing when offline', async () => {
    const book = await booksRepo.createBook(db, { title: 'Offline' });
    const offline = () => {
      throw new TypeError('Network request failed');
    };
    const { http, downloadCover } = setup({ [edition]: offline, [byIsbn13]: offline, [byIsbn10]: offline });
    await expect(attachBestCover(db, book.id, source, { http, downloadCover })).resolves.toEqual({ status: 'offline' });
    expect(await coverAttemptsRepo.get(db, book.id)).toBeNull();
  });

  it('records a failure with a short backoff', async () => {
    const book = await booksRepo.createBook(db, { title: 'Busy' });
    const { http, downloadCover } = setup({ [edition]: { status: 429, text: 'slow down' }, [byIsbn13]: missing, [byIsbn10]: missing });
    const result = await attachBestCover(db, book.id, source, { http, downloadCover, now: () => T0 });
    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('Rate limited') });
    expect(await coverAttemptsRepo.get(db, book.id)).toMatchObject({ lastResult: 'error', retryAfter: '2026-09-01T13:00:00.000Z' });
  });

  it('never replaces a cover the book already has unless asked', async () => {
    const book = await booksRepo.createBook(db, { title: 'Mine', coverUri: 'file:///doc/covers/photo.jpg' });
    const { http, fixtures, downloadCover } = setup({ [edition]: { bytes: images.large800 } });
    await expect(attachBestCover(db, book.id, source, { http, downloadCover })).resolves.toEqual({ status: 'kept' });
    expect(fixtures.calls).toEqual([]);
    await expect(attachBestCover(db, book.id, source, { http, downloadCover, replace: true })).resolves.toMatchObject({ status: 'attached' });
  });

  it('keeps a cover the user chose while the search ran', async () => {
    const book = await booksRepo.createBook(db, { title: 'Picked meanwhile' });
    const photo = `file:///doc/covers/${book.id}.jpg`;
    const { downloadCover } = setup({});
    // The user picks their own photo while the cover is downloading.
    const http = {
      getBinary: async () => {
        await booksRepo.updateBook(db, book.id, { coverUri: photo });
        return { bytes: images.large800, contentType: 'image/jpeg' };
      },
    };
    await expect(attachBestCover(db, book.id, source, { http, downloadCover })).resolves.toEqual({ status: 'kept' });
    expect(downloadCover).not.toHaveBeenCalled();
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBe(photo);
  });

  it('keeps a cover the user chose while a replacement was searched for', async () => {
    const book = await booksRepo.createBook(db, { title: 'Replaced meanwhile', coverUri: 'https://covers.example/old.jpg' });
    const photo = `file:///doc/covers/${book.id}.jpg`;
    const { downloadCover } = setup({});
    const http = {
      getBinary: async () => {
        await booksRepo.updateBook(db, book.id, { coverUri: photo });
        return { bytes: images.large800, contentType: 'image/jpeg' };
      },
    };
    await expect(attachBestCover(db, book.id, source, { http, downloadCover, replace: true })).resolves.toEqual({ status: 'kept' });
    expect(downloadCover).not.toHaveBeenCalled();
    expect((await booksRepo.getBook(db, book.id))?.coverUri).toBe(photo);
  });

  it('stores no file for a book deleted while the search ran', async () => {
    const book = await booksRepo.createBook(db, { title: 'Deleted meanwhile' });
    const { downloadCover } = setup({});
    const http = {
      getBinary: async () => {
        await booksRepo.removeBook(db, book.id);
        return { bytes: images.large800, contentType: 'image/jpeg' };
      },
    };
    await expect(attachBestCover(db, book.id, source, { http, downloadCover })).resolves.toMatchObject({ status: 'failed' });
    expect(downloadCover).not.toHaveBeenCalled();
  });

  it('reports a storage failure without losing the book', async () => {
    const book = await booksRepo.createBook(db, { title: 'Disk full' });
    const { http } = setup({ [edition]: { bytes: images.large800 } });
    const downloadCover = jest.fn(async () => Promise.reject(new Error('ENOSPC')));
    await expect(attachBestCover(db, book.id, source, { http, downloadCover })).resolves.toEqual({ status: 'failed', error: 'ENOSPC' });
    expect(await booksRepo.getBook(db, book.id)).toMatchObject({ title: 'Disk full', coverUri: null });
  });

  it('rejects when cancelled', async () => {
    const book = await booksRepo.createBook(db, { title: 'Cancelled' });
    const { http, downloadCover } = setup({ [edition]: { bytes: images.large800 } });
    await expect(attachBestCover(db, book.id, source, { http, downloadCover, signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
