/**
 * @jest-environment node
 */
import { authorsRepo, booksRepo, getSchemaVersion, LATEST_VERSION, migrate, migrations, type Db } from '@/db';
import { openBetterSqliteDatabase } from '@/db/betterSqlite';
import { openNodeDatabase } from '@/db/node';
import { sortPresets } from '@/domain';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

/** A library written with only the columns schema 1 has, as an old install holds it. */
async function oldLibrary(db: Db): Promise<void> {
  await db.exec(`
INSERT INTO series (id, name) VALUES (1, 'Discworld'), (2, 'Ångström Cycle');
INSERT INTO books (id, title, publication_year, series_id, series_position) VALUES
  (1, 'Mort', 1987, 1, 4),
  (2, 'The Colour of Magic', 1983, 1, 1),
  (3, 'Good Omens', 1990, NULL, NULL),
  (4, 'Émile', 1762, NULL, NULL),
  (5, 'Fjord', NULL, 2, 1),
  (6, 'Untitled Notes', NULL, NULL, NULL);
INSERT INTO authors (id, name, sort_name) VALUES (1, 'Terry Pratchett', 'Pratchett, Terry'), (2, 'Neil Gaiman', 'Gaiman, Neil'),
  (3, 'Jean-Jacques Rousseau', 'Rousseau, Jean-Jacques'), (4, 'Lise Øster', 'Øster, Lise');
INSERT INTO book_authors (book_id, author_id, position) VALUES (1, 1, 0), (2, 1, 0), (3, 1, 0), (3, 2, 1), (4, 3, 0), (5, 4, 0);
INSERT INTO genres (id, name) VALUES (1, 'Fantasy'), (2, 'Philosophy'), (3, 'Fiction');
INSERT INTO book_genres (book_id, genre_id) VALUES (1, 1), (2, 1), (3, 1), (4, 2), (5, 3);
`);
}

const library = sortPresets.find((p) => p.id === 'library')!.levels;
const callNumbers = sortPresets.find((p) => p.id === 'callNumber')!.levels;

describe.each([
  ['node:sqlite (plain search index, as on web)', openNodeDatabase],
  ['better-sqlite3 (FTS5, as on Android)', openBetterSqliteDatabase],
] as const)('migration 0010_book_sort_keys on %s', (_name, open) => {
  let db: Db;
  afterEach(() => db.close());

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])('upgrades a library from schema %i: a row to make for every book, then the sorts and the book page read them', async (from) => {
    db = await open();
    await migrate(db, upTo(from));
    await oldLibrary(db);
    const before = await db.all('SELECT id, title, publication_year, series_id, series_position FROM books ORDER BY id');
    await migrate(db);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await db.all('SELECT id, title, publication_year, series_id, series_position FROM books ORDER BY id')).toEqual(before);
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
    // One row per book, to be made the first time the app reads them.
    expect(await db.all('SELECT book_id, rules, title, call_number FROM book_sort_keys ORDER BY book_id')).toEqual(
      [1, 2, 3, 4, 5, 6].map((id) => ({ book_id: id, rules: 0, title: null, call_number: null })),
    );

    const items = await booksRepo.listBookItems(db, { sort: { levels: library } });
    // Library order: genre (Fantasy, Fiction, Philosophy, none), author, series (none last), number in series, title.
    expect(items.map((b) => b.title)).toEqual(['The Colour of Magic', 'Mort', 'Good Omens', 'Fjord', 'Émile', 'Untitled Notes']);
    expect(items[2].authors).toEqual(['Terry Pratchett', 'Neil Gaiman']);
    expect((await booksRepo.listBookItems(db, { sort: { levels: callNumbers } })).map((b) => b.title)).toEqual([
      'Fjord', // FIC OST
      'The Colour of Magic', // FIC PRA 1983
      'Mort', // FIC PRA 1987
      'Good Omens', // FIC PRA 1990
      'Untitled Notes', // GEN UNT
      'Émile', // PHI ROU 1762
    ]);
    expect((await booksRepo.getBookDetail(db, 4))!.callNumber).toBe('PHI ROU 1762');
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM book_sort_keys WHERE rules = 0'))!.n).toBe(0);

    // The triggers came with it.
    await authorsRepo.updateAuthor(db, 1, { sortName: 'Aaa, Terry' });
    expect((await booksRepo.getBookDetail(db, 1))!.callNumber).toBe('FIC AAA 1987');
    // Search still finds the old books.
    expect((await booksRepo.listBookItems(db, { query: 'omens' })).map((b) => b.title)).toEqual(['Good Omens']);
  });
});
