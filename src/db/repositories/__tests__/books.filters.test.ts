/**
 * @jest-environment node
 */
import { booksRepo, genresRepo, type Db } from '@/db';
import { noFilters, type ShelfFilters } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const f = (patch: Partial<ShelfFilters>): ShelfFilters => ({ ...noFilters, ...patch });
const titles = async (filters: ShelfFilters, query?: string) =>
  (await booksRepo.listBookItems(db, { filters, query })).map((i) => i.title);
const genreId = async (name: string) => (await genresRepo.findGenreByName(db, name))!.id;

describe('shelf filters', () => {
  it('builds no clause when nothing is set', () => {
    expect(booksRepo.filterClause(noFilters)).toBeNull();
  });

  it('binds every value as a parameter, never splicing it into the SQL', () => {
    const evil = "en'); DROP TABLE books; --";
    const clause = booksRepo.filterClause(f({ genreIds: [1, 2], formats: ['paperback'], languages: [evil], yearFrom: 1900, yearTo: 1950, recentlyAdded: true, loan: 'onLoan', series: 'inSeries' }))!;
    expect(clause.sql).not.toContain('DROP');
    expect(clause.sql).not.toContain('1900');
    expect(clause.sql).not.toContain('paperback');
    expect(clause.params).toEqual([1, 2, 'paperback', evil, 1900, 1950, '-30 days']);
    expect(clause.sql.match(/\?/g)).toHaveLength(clause.params.length);
  });

  it('ORs within genres', async () => {
    const got = await titles(f({ genreIds: [await genreId('Science Fiction'), await genreId('Classics')] }));
    expect(got.sort()).toEqual(['Dune', 'Pride and Prejudice', 'The Hound of the Baskervilles', 'The Left Hand of Darkness']);
  });

  it('ANDs across filter kinds', async () => {
    const fantasy = await genreId('Fantasy');
    expect(await titles(f({ genreIds: [fantasy], series: 'standalone' }))).toEqual(['Good Omens']);
    expect(await titles(f({ genreIds: [fantasy], formats: ['hardcover'] }))).toEqual(['Good Omens']);
    expect(await titles(f({ genreIds: [await genreId('Science Fiction')], loan: 'onLoan' }))).toEqual(['Dune']);
  });

  it('filters by loan status', async () => {
    expect((await titles(f({ loan: 'onLoan' }))).sort()).toEqual(['Dune', 'The Murder of Roger Ackroyd']);
    // Mort was lent and returned: it is at home.
    const home = await titles(f({ loan: 'atHome' }));
    expect(home).toHaveLength(10);
    expect(home).toContain('Mort');
  });

  it('filters by series, year range, language and format', async () => {
    expect(await titles(f({ series: 'inSeries' }))).toHaveLength(5);
    expect(await titles(f({ yearFrom: 1960, yearTo: 1970 }))).toEqual(['Dune', 'The Left Hand of Darkness', 'A Wizard of Earthsea']);
    expect(await titles(f({ yearTo: 1850 }))).toEqual(['Pride and Prejudice']);
    expect(await titles(f({ languages: ['fr'] }))).toEqual([]);
    expect(await titles(f({ languages: ['en'] }))).toHaveLength(12);
  });

  it('filters books added in the last 30 days', async () => {
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    await db.run("UPDATE books SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-40 days') WHERE id != ?", [dune.id]);
    expect(await titles(f({ recentlyAdded: true }))).toEqual(['Dune']);
  });

  it('combines with the search', async () => {
    expect(await titles(f({ series: 'inSeries' }), 'earthsea')).toEqual(['The Farthest Shore', 'A Wizard of Earthsea']);
  });

  it('offers only values some book has', async () => {
    const options = await booksRepo.listFilterOptions(db);
    expect(options.genres.map((g) => [g.name, g.count])).toEqual([
      ['Classics', 2],
      ['Fantasy', 6],
      ['Mystery', 3],
      ['Science Fiction', 2],
    ]);
    expect(options.formats).toEqual(['hardcover', 'paperback']);
    expect(options.languages).toEqual(['en']);
    expect([options.minYear, options.maxYear]).toEqual([1813, 1990]);
  });
});
