/**
 * Cover files on the phone (`covers/`), end to end: every stored cover has a
 * file of its own, and a file goes only when nothing names it. The real
 * native `downloadCover` / `storeCoverFile` run over an in-memory file system.
 */
import { booksRepo, settingsRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { exportBackup, restoreBackup, undoRestore } from '@/services/backup';
import { images } from '@/services/covers/__fixtures__/images';
import { coverBatchUrl } from '@/services/covers/batchCoverIds';
import { olCoverByIdUrl } from '@/services/covers/coverUrls';
import { createHttpClient, createRateLimiter } from '@/services/http';
import batch from '@/services/metadata/__fixtures__/openlibrary/search-isbn-batch.json';
import { createTestDb } from '@/testing/createTestDb';
import { createFixtureFetch } from '@/testing/fixtureFetch';

import { attachBestCover, backfillCoversNow, clearCoverHolds, holdCover, releaseCoverOfDeletedBook, replacingLibrary } from '../index';

jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/').replace(/\/+/g, '/').replace('file:/', 'file:///');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      dirs.add(this.uri);
    }
    get exists() {
      return dirs.has(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      files.set(this.uri, new Uint8Array());
    }
    write(bytes: Uint8Array) {
      files.set(this.uri, bytes);
    }
    get exists() {
      return files.has(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
    copy(target: File) {
      if (!files.has(this.uri)) throw new Error('source missing');
      files.set(target.uri, files.get(this.uri)!);
    }
  }
  return { __esModule: true, Directory, File, Paths: { document: new Directory('file:///data/docs') }, __files: files };
});

const fs = jest.requireMock<{ __files: Map<string, Uint8Array> }>('expo-file-system');
const COVERS = 'file:///data/docs/covers';
const ORIGINAL = new Uint8Array([0xff, 0xd8, 0x0a]);
const coverFiles = () => [...fs.__files.keys()].filter((k) => k.startsWith(`${COVERS}/`)).sort();

const GOOD_OMENS = { title: 'Good Omens', isbn13: '9780060853983', cover: 10482245 };
const HOBBIT = { title: 'The Hobbit', isbn13: '9780547928227', cover: 14624642 };

let db: Db;
beforeEach(async () => {
  fs.__files.clear();
  clearCoverHolds();
  db = await createTestDb();
  await settingsRepo.setSetting(db, 'googleBooksEnabled', false);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await db.close();
});

/** Answers the cover backfill's batch search and cover downloads for these books. */
function mockCoverApi(books: readonly { isbn13: string; cover: number }[]) {
  const fixtures = createFixtureFetch(
    { [coverBatchUrl(books.map((b) => b.isbn13))]: { body: batch } },
    Object.fromEntries(books.map((b) => [olCoverByIdUrl(b.cover), { bytes: images.large800 }])),
  );
  jest.spyOn(global, 'fetch').mockImplementation((url, init) => fixtures.fetch(String(url), init as never));
  return fixtures;
}

/** A backup of a library of these books, as another phone makes it (ids from 1, no cover files). */
async function backupOf(books: readonly { title: string; isbn13: string }[]) {
  const other = await createTestDb();
  for (const b of books) await booksRepo.createBook(other, { title: b.title, isbn13: b.isbn13, source: 'manual' });
  const backup = await exportBackup(other, { appVersion: 'test' });
  await other.close();
  return backup;
}

describe('a Replace restore, its cover backfill, then "Undo restore"', () => {
  it('brings back the original covers: the backfill never wrote over a file the safety copy names', async () => {
    // An install from before unique names: book 1's cover is covers/1.jpg.
    const mine = await booksRepo.createBook(db, { title: 'My own book', source: 'manual' });
    expect(mine.id).toBe(1);
    fs.__files.set(`${COVERS}/1.jpg`, ORIGINAL);
    await booksRepo.updateBook(db, 1, { coverUri: `${COVERS}/1.jpg` });

    const backup = await backupOf([GOOD_OMENS]);
    const restored = await replacingLibrary(db, () => restoreBackup(db, backup, { mode: 'replace', openScratch: () => openNodeDatabase() }));
    const [goodOmens] = await booksRepo.listBooks(db);
    expect(goodOmens).toMatchObject({ id: 1, title: 'Good Omens', coverUri: null });

    mockCoverApi([GOOD_OMENS]);
    await expect(backfillCoversNow(db)).resolves.toMatchObject({ attached: 1 });
    const fetched = (await booksRepo.getBook(db, 1))!.coverUri!;
    expect(fetched).toMatch(/^file:\/\/\/data\/docs\/covers\/1-[a-z0-9]+\.jpg$/);
    expect(fs.__files.get(`${COVERS}/1.jpg`)).toEqual(ORIGINAL);

    await replacingLibrary(db, () => undoRestore(db, restored.safetyCopy!.id, { openScratch: () => openNodeDatabase() }));
    expect(await booksRepo.getBook(db, 1)).toMatchObject({ title: 'My own book', coverUri: `${COVERS}/1.jpg` });
    expect(fs.__files.get(`${COVERS}/1.jpg`)).toEqual(ORIGINAL);
    // The cover fetched for the restored book is named by nothing now: it went.
    expect(coverFiles()).toEqual([`${COVERS}/1.jpg`]);
  });

  it('keeps the replaced library’s covers while the safety copy names them, and lets them go with the next restore', async () => {
    await booksRepo.createBook(db, { title: 'My own book', source: 'manual' });
    fs.__files.set(`${COVERS}/1.jpg`, ORIGINAL);
    await booksRepo.updateBook(db, 1, { coverUri: `${COVERS}/1.jpg` });
    const backup = await backupOf([GOOD_OMENS]);
    await replacingLibrary(db, () => restoreBackup(db, backup, { mode: 'replace', openScratch: () => openNodeDatabase() }));
    expect(coverFiles()).toEqual([`${COVERS}/1.jpg`]);
    // A second restore replaces the safety copy: the first library's cover is named by nothing now.
    await replacingLibrary(db, () => restoreBackup(db, backup, { mode: 'replace', openScratch: () => openNodeDatabase() }));
    expect(coverFiles()).toEqual([]);
  });
});

describe('a deleted book put back under a new id', () => {
  it('keeps its own cover file while another book takes its old id and gets a cover of its own', async () => {
    // Book 1 has a cover; it is deleted, a restore brings in another book 1, and Undo puts the first back as book 2.
    await booksRepo.createBook(db, { title: 'My own book', source: 'manual' });
    fs.__files.set(`${COVERS}/1.jpg`, ORIGINAL);
    await booksRepo.updateBook(db, 1, { coverUri: `${COVERS}/1.jpg` });
    const snapshot = (await booksRepo.removeBook(db, 1))!;
    holdCover(`${COVERS}/1.jpg`);
    await restoreBackup(db, await backupOf([HOBBIT]), { mode: 'replace', openScratch: () => openNodeDatabase() });
    const back = await booksRepo.restoreBook(db, snapshot);
    expect(back).not.toBe(1);
    await releaseCoverOfDeletedBook(db, `${COVERS}/1.jpg`);
    expect((await booksRepo.getBook(db, back))!.coverUri).toBe(`${COVERS}/1.jpg`);

    // The Hobbit, now book 1, gets its cover from the backfill: a file of its own, not covers/1.jpg.
    mockCoverApi([HOBBIT]);
    await backfillCoversNow(db);
    const hobbit = (await booksRepo.getBook(db, 1))!;
    expect(hobbit.title).toBe('The Hobbit');
    expect(hobbit.coverUri).not.toBe(`${COVERS}/1.jpg`);
    expect(fs.__files.get(`${COVERS}/1.jpg`)).toEqual(ORIGINAL);

    // Deleting The Hobbit later takes its own file only.
    await booksRepo.removeBook(db, 1);
    await releaseCoverOfDeletedBook(db, hobbit.coverUri);
    expect(coverFiles()).toEqual([`${COVERS}/1.jpg`]);
  });
});

describe('replacing a cover', () => {
  it('"Find a better cover": the new file first, then the book names it, then the old one goes', async () => {
    const book = await booksRepo.createBook(db, { title: GOOD_OMENS.title, isbn13: GOOD_OMENS.isbn13, source: 'manual' });
    fs.__files.set(`${COVERS}/${book.id}.jpg`, ORIGINAL);
    await booksRepo.updateBook(db, book.id, { coverUri: `${COVERS}/${book.id}.jpg` });
    const fixtures = mockCoverApi([GOOD_OMENS]);
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const result = await attachBestCover(db, book.id, { olEditionCoverIds: [GOOD_OMENS.cover] }, { http, replace: true, includeGoogle: false });
    expect(result.status).toBe('attached');
    const now = (await booksRepo.getBook(db, book.id))!.coverUri!;
    expect(now).not.toBe(`${COVERS}/${book.id}.jpg`);
    expect(coverFiles()).toEqual([now]);
  });

  it('a book that cannot take the new cover keeps its old one, and the new file goes', async () => {
    const book = await booksRepo.createBook(db, { title: GOOD_OMENS.title, isbn13: GOOD_OMENS.isbn13, source: 'manual' });
    fs.__files.set(`${COVERS}/${book.id}.jpg`, ORIGINAL);
    await booksRepo.updateBook(db, book.id, { coverUri: `${COVERS}/${book.id}.jpg` });
    const fixtures = mockCoverApi([GOOD_OMENS]);
    const http = createHttpClient({ fetch: fixtures.fetch, limiter: createRateLimiter({ minIntervalMs: 0 }) });
    const real = booksRepo.updateBook;
    jest.spyOn(booksRepo, 'updateBook').mockImplementation(async (d, id, patch) => {
      if (patch.coverUri) throw new Error('database is locked');
      return real(d, id, patch);
    });
    const result = await attachBestCover(db, book.id, { olEditionCoverIds: [GOOD_OMENS.cover] }, { http, replace: true, includeGoogle: false });
    expect(result.status).toBe('failed');
    expect((await booksRepo.getBook(db, book.id))!.coverUri).toBe(`${COVERS}/${book.id}.jpg`);
    expect(coverFiles()).toEqual([`${COVERS}/${book.id}.jpg`]);
    expect(fs.__files.get(`${COVERS}/${book.id}.jpg`)).toEqual(ORIGINAL);
  });
});
