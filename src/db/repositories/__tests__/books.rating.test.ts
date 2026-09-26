/**
 * @jest-environment node
 */
import { booksRepo, getSchemaVersion, LATEST_VERSION, migrate, migrations, shelfSectionsRepo, type Db } from '@/db';
import { openNodeDatabase } from '@/db/node';
import { draftFromDetail, noFilters, validateBookDraft, type ValidBookDraft } from '@/domain';
import { createFtsTestDb, createTestDb } from '@/testing/createTestDb';
import { oneKey } from '@/testing/sorts';

describe('migration 0007_book_rating', () => {
  it('is the next migration after the search index', () => {
    expect(migrations.map((m) => m.name)).toContain('0007_book_rating');
    expect(migrations.find((m) => m.name === '0007_book_rating')!.version).toBe(7);
  });

  it('gives a fresh database a nullable rating column', async () => {
    const db = await createTestDb();
    const cols = await db.all<{ name: string; type: string; notnull: number; dflt_value: unknown }>("SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('books')");
    expect(cols.find((c) => c.name === 'rating')).toEqual({ name: 'rating', type: 'INTEGER', notnull: 0, dflt_value: null });
    const book = await booksRepo.createBook(db, { title: 'Unrated' });
    expect(book.rating).toBeNull();
    await db.close();
  });

  it('brings an existing v6 database forward without touching its books', async () => {
    const db = await openNodeDatabase();
    await migrate(db, migrations.filter((m) => m.version <= 6));
    expect(await getSchemaVersion(db)).toBe(6);
    await db.run("INSERT INTO books (id, title, notes, created_at, updated_at) VALUES (1, 'Mort', 'Signed', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')");
    const result = await migrate(db);
    expect(result).toEqual({ from: 6, to: LATEST_VERSION, applied: [7] });
    const book = await booksRepo.getBook(db, 1);
    expect(book).toMatchObject({ title: 'Mort', notes: 'Signed', rating: null, updatedAt: '2020-01-01T00:00:00.000Z' });
    // The search index built by 0006 still finds it.
    expect((await booksRepo.listBookItems(db, { query: 'signed' })).map((b) => b.title)).toEqual(['Mort']);
    await db.close();
  });

  describe('CHECK constraint', () => {
    let db: Db;
    beforeEach(async () => {
      db = await createTestDb();
      await db.run("INSERT INTO books (id, title) VALUES (1, 'Dune')");
    });
    afterEach(() => db.close());

    it.each([1, 2, 3, 4, 5])('accepts %i stars', async (n) => {
      await db.run('UPDATE books SET rating = ? WHERE id = 1', [n]);
      expect(await db.get('SELECT rating FROM books WHERE id = 1')).toEqual({ rating: n });
    });

    it('accepts NULL, and 4.0 stored as 4', async () => {
      await db.run('UPDATE books SET rating = NULL WHERE id = 1');
      await db.run('UPDATE books SET rating = 4.0 WHERE id = 1');
      expect(await db.get('SELECT rating, typeof(rating) AS t FROM books WHERE id = 1')).toEqual({ rating: 4, t: 'integer' });
    });

    it.each([0, 6, -1, 4.5, 'four'])('refuses %p', async (v) => {
      await expect(db.run('UPDATE books SET rating = ? WHERE id = 1', [v])).rejects.toThrow(/CHECK/);
    });
  });
});

describe('setRating', () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(() => db.close());

  it('sets, changes and clears a rating, touching nothing else', async () => {
    const book = await booksRepo.createBook(db, { title: 'Dune', notes: 'Mine', publicationYear: 1965 });
    expect(await booksRepo.setRating(db, book.id, 4)).toBe(true);
    expect(await booksRepo.getBook(db, book.id)).toMatchObject({ rating: 4, notes: 'Mine', publicationYear: 1965 });
    await booksRepo.setRating(db, book.id, 2);
    expect((await booksRepo.getBookDetail(db, book.id))!.rating).toBe(2);
    await booksRepo.setRating(db, book.id, null);
    expect((await booksRepo.getBook(db, book.id))!.rating).toBeNull();
  });

  it('returns false for a missing book and refuses anything but 1-5 whole stars', async () => {
    expect(await booksRepo.setRating(db, 999, 3)).toBe(false);
    const book = await booksRepo.createBook(db, { title: 'Dune' });
    for (const bad of [0, 6, 2.5, Number.NaN]) await expect(booksRepo.setRating(db, book.id, bad)).rejects.toThrow(RangeError);
    expect((await booksRepo.getBook(db, book.id))!.rating).toBeNull();
  });

  it('does not disturb the search index (the triggers ignore the rating)', async () => {
    for (const make of [createTestDb, createFtsTestDb]) {
      const d = await make();
      const book = await booksRepo.createBook(d, { title: 'The Left Hand of Darkness' });
      await booksRepo.setRating(d, book.id, 5);
      expect((await booksRepo.listBookItems(d, { query: 'darkness' })).map((b) => [b.title, b.rating])).toEqual([['The Left Hand of Darkness', 5]]);
      await d.close();
    }
  });
});

describe('form saves and refreshes', () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(() => db.close());

  const draft = (patch: Partial<ValidBookDraft> = {}): ValidBookDraft => {
    const v = validateBookDraft({
      ...draftFromDetail({
        id: 0, title: 'Dune', subtitle: null, isbn13: null, isbn10: null, edition: null, publisher: null, publicationYear: null, pageCount: null,
        summary: null, coverUri: null, language: null, format: null, seriesId: null, seriesPosition: null, source: null, sourceId: null, notes: null,
        rating: null, createdAt: '', updatedAt: '', authors: [], genres: [], series: null, openLoan: null,
      }),
    });
    if (!v.ok) throw new Error('invalid');
    return { ...v.value, ...patch };
  };

  it('the form saves the rating on a new book and on an edit', async () => {
    const id = await booksRepo.saveBookDraft(db, draft({ rating: 3 }));
    expect((await booksRepo.getBook(db, id))!.rating).toBe(3);
    await booksRepo.saveBookDraft(db, draft({ rating: null }), id);
    expect((await booksRepo.getBook(db, id))!.rating).toBeNull();
  });

  it('refresh-from-catalogue never changes the rating, whatever the draft says', async () => {
    const id = await booksRepo.saveBookDraft(db, draft());
    await booksRepo.setRating(db, id, 5);
    await booksRepo.refreshBook(db, id, draft({ title: 'Dune (refreshed)', rating: 1 }), { userGenres: [] });
    await booksRepo.refreshBook(db, id, draft({ title: 'Dune (again)', rating: null }), { userGenres: [] });
    expect(await booksRepo.getBook(db, id)).toMatchObject({ title: 'Dune (again)', rating: 5 });
  });

  it('a draft without a rating leaves the stored one alone', async () => {
    const id = await booksRepo.saveBookDraft(db, draft({ rating: 4 }));
    await booksRepo.saveBookDraft(db, draft({ rating: undefined, title: 'Dune Messiah' }), id);
    expect(await booksRepo.getBook(db, id)).toMatchObject({ title: 'Dune Messiah', rating: 4 });
  });
});

describe('the Shelf with ratings', () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
    const add = async (title: string, rating: number | null) => {
      const b = await booksRepo.createBook(db, { title });
      if (rating != null) await booksRepo.setRating(db, b.id, rating);
    };
    await add('Mort', 5);
    await add('Dune', 4);
    await add('Emma', null);
    await add('The Hobbit', 4);
    await add('Beloved', 2);
    await add('Aesop', null);
  });
  afterAll(() => db.close());

  const titles = async (options: Parameters<typeof booksRepo.listBookItems>[1]) => (await booksRepo.listBookItems(db, options)).map((b) => b.title);

  it('list items carry the rating', async () => {
    const items = await booksRepo.listBookItems(db);
    expect(items.map((b) => [b.title, b.rating])).toEqual([
      ['Aesop', null],
      ['Beloved', 2],
      ['Dune', 4],
      ['Emma', null],
      ['The Hobbit', 4],
      ['Mort', 5],
    ]);
  });

  it('sorts by rating, highest or lowest first, unrated last either way, ties by title', async () => {
    expect(await titles({ sort: oneKey('rating', 'desc') })).toEqual(['Mort', 'Dune', 'The Hobbit', 'Beloved', 'Aesop', 'Emma']);
    expect(await titles({ sort: oneKey('rating', 'asc') })).toEqual(['Beloved', 'Dune', 'The Hobbit', 'Mort', 'Aesop', 'Emma']);
  });

  it('filters by a minimum rating, leaving unrated books out', async () => {
    expect(await titles({ filters: { ...noFilters, minRating: 4 } })).toEqual(['Dune', 'The Hobbit', 'Mort']);
    expect(await titles({ filters: { ...noFilters, minRating: 5 } })).toEqual(['Mort']);
    expect(await titles({ filters: { ...noFilters, minRating: 1 } })).toEqual(['Beloved', 'Dune', 'The Hobbit', 'Mort']);
  });

  it('tells the filter sheet whether any book is rated', async () => {
    expect((await booksRepo.listFilterOptions(db)).hasRatings).toBe(true);
    const empty = await createTestDb();
    await booksRepo.createBook(empty, { title: 'Unrated' });
    expect((await booksRepo.listFilterOptions(empty)).hasRatings).toBe(false);
    await empty.close();
  });

  it('groups by rating, best first, with the unrated books last', async () => {
    const { sections, count } = await shelfSectionsRepo.listShelfSections(db, { groupBy: 'rating', sort: oneKey('title') });
    expect(count).toBe(6);
    expect(sections.map((s) => [s.sectionKey, s.sectionTitle, s.items.map((i) => i.title)])).toEqual([
      ['rating:5', '5 stars', ['Mort']],
      ['rating:4', '4 stars', ['Dune', 'The Hobbit']],
      ['rating:2', '2 stars', ['Beloved']],
      ['rating:none', 'Not rated', ['Aesop', 'Emma']],
    ]);
  });
});
