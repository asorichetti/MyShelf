/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, coverAttemptsRepo as repo, getSchemaVersion, migrate, migrations, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { createTestDb } from '@/testing/createTestDb';

const T0 = Date.parse('2026-09-01T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();
const DAY = 24 * 3_600_000;

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('0004_cover_attempts migration', () => {
  it('upgrades a version 3 database and is idempotent', async () => {
    const old = await openNodeDatabase();
    await migrate(old, migrations.slice(0, 3));
    expect(await getSchemaVersion(old)).toBe(3);
    expect((await migrate(old)).applied).toEqual([4]);
    expect((await migrate(old)).applied).toEqual([]);
    await old.close();
  });

  it('only records known results and real books', async () => {
    const book = await booksRepo.createBook(db, { title: 'Dune' });
    await expect(
      db.run("INSERT INTO cover_attempts (book_id, last_attempt_at, retry_after, last_result) VALUES (?, 'x', 'y', 'maybe')", [book.id]),
    ).rejects.toThrow(/CHECK/);
    await expect(repo.recordAttempt(db, 999, 'none')).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('cover attempts repository', () => {
  it('lists books without a cover, never-searched first, newest first', async () => {
    const old = await booksRepo.createBook(db, { title: 'Old', isbn13: '9780552166591' });
    await booksRepo.createBook(db, { title: 'Has cover', coverUri: 'file:///covers/2.jpg' });
    await booksRepo.createBook(db, { title: 'Blank cover', coverUri: '  ' });
    const fresh = await booksRepo.createBook(db, { title: 'Fresh', source: 'openlibrary', sourceId: 'OL1M' });
    const pratchett = await authorsRepo.createAuthor(db, 'Terry Pratchett');
    const kidby = await authorsRepo.createAuthor(db, 'Paul Kidby');
    await authorsRepo.setBookAuthors(db, old.id, [{ authorId: kidby.id, role: 'illustrator' }, { authorId: pratchett.id }]);
    await repo.recordAttempt(db, old.id, 'none', { now: T0 });

    const due = await repo.listBooksNeedingCover(db, { now: iso(T0 + 2 * DAY), limit: 10 });
    expect(due.map((b) => b.title)).toEqual(['Fresh', 'Blank cover', 'Old']);
    expect(due.find((b) => b.id === old.id)).toEqual({
      id: old.id,
      title: 'Old',
      isbn13: '9780552166591',
      isbn10: null,
      source: null,
      sourceId: null,
      firstAuthor: 'Terry Pratchett',
      attempts: 1,
    });
    expect(due[0]).toMatchObject({ id: fresh.id, source: 'openlibrary', sourceId: 'OL1M', firstAuthor: null, attempts: 0 });
    expect(await repo.listBooksNeedingCover(db, { now: iso(T0 + 2 * DAY), limit: 1 })).toHaveLength(1);
  });

  it('leaves a book alone until its retry time', async () => {
    const book = await booksRepo.createBook(db, { title: 'Obscure' });
    const first = await repo.recordAttempt(db, book.id, 'none', { now: T0 });
    expect(first).toEqual({
      bookId: book.id,
      attempts: 1,
      lastAttemptAt: iso(T0),
      retryAfter: iso(T0 + DAY),
      lastResult: 'none',
      lastError: null,
    });
    expect(await repo.listBooksNeedingCover(db, { now: iso(T0 + DAY - 1), limit: 10 })).toEqual([]);
    expect(await repo.listBooksNeedingCover(db, { now: iso(T0 + DAY), limit: 10 })).toHaveLength(1);

    const second = await repo.recordAttempt(db, book.id, 'none', { now: T0 + DAY });
    expect(second).toMatchObject({ attempts: 2, retryAfter: iso(T0 + 8 * DAY) });
    const third = await repo.recordAttempt(db, book.id, 'error', { now: T0 + 8 * DAY, error: 'Rate limited' });
    expect(third).toMatchObject({ attempts: 3, lastResult: 'error', lastError: 'Rate limited', retryAfter: iso(T0 + 9 * DAY) });
  });

  it('forgets attempts on clear and when the book is deleted', async () => {
    const a = await booksRepo.createBook(db, { title: 'A' });
    const b = await booksRepo.createBook(db, { title: 'B' });
    await repo.recordAttempt(db, a.id, 'none');
    await repo.recordAttempt(db, b.id, 'none');
    expect(await repo.clear(db, a.id)).toBe(true);
    expect(await repo.clear(db, a.id)).toBe(false);
    await booksRepo.deleteBook(db, b.id);
    expect(await repo.get(db, b.id)).toBeNull();
  });
});
