/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, getSchemaVersion, LATEST_VERSION, migrate, migrations, type Db } from '@/db';
import { openBetterSqliteDatabase } from '@/db/betterSqlite';
import { openNodeDatabase } from '@/db/node';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

/** A library written with only the columns schema 1 has, as an old install holds it. */
async function oldLibrary(db: Db): Promise<void> {
  await db.exec(`
INSERT INTO series (id, name) VALUES (1, 'Trilogien om Ødegård');
INSERT INTO books (id, title, subtitle, series_id, series_position, notes) VALUES
  (1, 'Søren Kierkegaard', 'Et liv', NULL, NULL, NULL),
  (2, 'Łódź nocą', NULL, NULL, NULL, 'Kupiona w Gdańsku'),
  (3, 'Straße der Besten', NULL, 1, 1, NULL),
  (4, 'Plain Title', NULL, NULL, NULL, 'Bought from Ælfric''s shop');
INSERT INTO authors (id, name) VALUES (1, 'Jørgen Møller'), (2, 'Þórr Ðórsson');
INSERT INTO book_authors (book_id, author_id) VALUES (1, 1), (4, 2);
INSERT INTO genres (id, name) VALUES (1, 'Œuvres');
INSERT INTO book_genres (book_id, genre_id) VALUES (2, 1);
`);
}

const titles = async (db: Db, query: string) => (await booksRepo.listBookItems(db, { query })).map((b) => b.title).sort();

describe.each([
  ['plain search index', 'plain', openNodeDatabase],
  ['FTS5', 'fts5', openBetterSqliteDatabase],
] as const)('migration 0009_search_folded (%s)', (_name, kind, open) => {
  let db: Db;
  afterEach(() => db.close());

  it.each([1, 5, 6, 7, 8])('upgrades a library from schema %i: the folded letters are found, nothing else changes', async (from) => {
    db = await open();
    await migrate(db, upTo(from));
    await oldLibrary(db);
    const before = await db.all('SELECT id, title, subtitle, series_id, notes FROM books ORDER BY id');
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await booksRepo.searchIndexKind(db)).toBe(kind);
    expect(await db.all('SELECT id, title, subtitle, series_id, notes FROM books ORDER BY id')).toEqual(before);
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
    const rows = await db.get<{ n: number }>(kind === 'fts5' ? 'SELECT COUNT(*) AS n FROM books_fts' : 'SELECT COUNT(*) AS n FROM books_search');
    expect(rows?.n).toBe(4);
    for (const [query, found] of [
      ['soren', ['Søren Kierkegaard']],
      ['Søren', ['Søren Kierkegaard']],
      ['lodz', ['Łódź nocą']],
      ['gdansk', ['Łódź nocą']],
      ['strasse', ['Straße der Besten']],
      ['straße', ['Straße der Besten']],
      ['odegard', ['Straße der Besten']],
      ['moller', ['Søren Kierkegaard']],
      ['thorr dorsson', ['Plain Title']],
      ['aelfric', ['Plain Title']],
      ['oeuvres', ['Łódź nocą']],
      ['plain', ['Plain Title']],
    ] as const) {
      expect({ query, found: await titles(db, query) }).toEqual({ query, found });
    }
  });

  it('keeps the index current through its triggers afterwards', async () => {
    db = await open();
    await migrate(db, upTo(8));
    await oldLibrary(db);
    await migrate(db);
    const book = await booksRepo.createBook(db, { title: 'Ørkenen' });
    expect(await titles(db, 'orken')).toEqual(['Ørkenen']);
    await booksRepo.updateBook(db, book.id, { title: 'Øen' });
    expect(await titles(db, 'orken')).toEqual([]);
    expect(await titles(db, 'oen')).toEqual(['Øen']);
    await authorsRepo.updateAuthor(db, 1, { name: 'Bjørn Ås' });
    expect(await titles(db, 'bjorn')).toEqual(['Søren Kierkegaard']);
    expect(await titles(db, 'moller')).toEqual([]);
    await booksRepo.deleteBook(db, book.id);
    expect(await titles(db, 'oen')).toEqual([]);
  });

  it('leaves a database without a search index alone', async () => {
    db = await open();
    await migrate(db, upTo(8).filter((m) => m.version !== 6));
    await oldLibrary(db);
    await migrate(db, migrations.filter((m) => m.version !== 6));
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await booksRepo.searchIndexKind(db)).toBeNull();
    expect(await titles(db, 'plain')).toEqual(['Plain Title']);
  });
});
