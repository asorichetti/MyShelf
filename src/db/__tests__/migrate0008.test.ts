/**
 * @jest-environment node
 */
import { booksRepo, getSchemaVersion, LATEST_VERSION, loansRepo, migrate, MigrationError, migrations, type Db, type Migration } from '@/db';
import { openBetterSqliteDatabase } from '@/db/betterSqlite';
import { openNodeDatabase } from '@/db/node';
import { loadFixture } from '@/testing/loadFixture';

const TABLES = ['books', 'authors', 'book_authors', 'genres', 'book_genres', 'series', 'groups', 'group_books', 'borrowers', 'loans', 'cover_attempts', 'settings'];

async function dump(db: Db): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

/** Columns, indexes (with their definitions) and foreign keys of a table. */
async function shape(db: Db, table: string) {
  return {
    columns: await db.all(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`),
    indexes: await db.all("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name", [table]),
    keys: await db.all(`SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list('${table}') ORDER BY "from"`),
  };
}

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

describe.each([
  ['plain search index', openNodeDatabase],
  ['FTS5', openBetterSqliteDatabase],
] as const)('migration 0008_no_id_reuse (%s)', (_name, open) => {
  let db: Db;
  beforeEach(async () => {
    db = await open();
    await migrate(db, upTo(7));
    await loadFixture(db, 'demo');
    await db.run("INSERT INTO cover_attempts (book_id, last_attempt_at, retry_after, last_result) VALUES (1, 'a', 'b', 'none')");
  });
  afterEach(() => db.close());

  it('keeps every row, column, index and link exactly as it was', async () => {
    const before = await dump(db);
    const shapes = { books: await shape(db, 'books'), loans: await shape(db, 'loans') };
    expect(await migrate(db, upTo(8))).toMatchObject({ from: 7, applied: [8] });
    expect(await getSchemaVersion(db)).toBe(8);
    expect(await dump(db)).toEqual(before);
    expect({ books: await shape(db, 'books'), loans: await shape(db, 'loans') }).toEqual(shapes);
    expect(await db.all('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('leaves foreign keys on, cascading from the new tables as before', async () => {
    await migrate(db);
    expect(await db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    const [dune] = await booksRepo.findBooksByIsbn(db, '9780441172719');
    await booksRepo.deleteBook(db, dune.id);
    for (const table of ['book_authors', 'book_genres', 'group_books', 'loans']) {
      expect(await db.all(`SELECT * FROM ${table} WHERE book_id = ?`, [dune.id])).toEqual([]);
    }
    await expect(db.run('INSERT INTO book_authors (book_id, author_id) VALUES (999, 1)')).rejects.toThrow(/FOREIGN KEY/);
    await expect(db.run("INSERT INTO books (title, format) VALUES ('X', 'scroll')")).rejects.toThrow(/CHECK/);
  });

  it('keeps the search index and the one-open-loan rule working', async () => {
    await migrate(db);
    expect((await booksRepo.listBookItems(db, { query: 'pratchett' })).length).toBeGreaterThan(0);
    const book = await booksRepo.createBook(db, { title: 'Brand new searchable' });
    expect((await booksRepo.listBookItems(db, { query: 'searchable' })).map((b) => b.id)).toEqual([book.id]);
    const open = (await loansRepo.listOpenLoans(db))[0];
    await expect(loansRepo.lendBook(db, { bookId: open.bookId, borrowerId: open.borrowerId, lentOn: open.lentOn })).rejects.toThrow(loansRepo.BookAlreadyOnLoanError);
  });

  it('never hands a deleted book’s or loan’s id to a new one', async () => {
    await migrate(db);
    const top = await booksRepo.createBook(db, { title: 'Newest' });
    const borrower = (await loansRepo.listBorrowers(db))[0];
    const loan = await loansRepo.lendBook(db, { bookId: top.id, borrowerId: borrower.id, lentOn: '2026-01-01' });
    await booksRepo.deleteBook(db, top.id);
    const next = await booksRepo.createBook(db, { title: 'Next' });
    expect(next.id).toBe(top.id + 1);
    expect((await loansRepo.lendBook(db, { bookId: next.id, borrowerId: borrower.id, lentOn: '2026-01-01' })).id).toBe(loan.id + 1);
  });
});

describe('a migration with foreign keys off', () => {
  it('fails and changes nothing when it leaves a broken reference, with foreign keys back on', async () => {
    const db = await openNodeDatabase();
    await migrate(db);
    const breaking: Migration = { version: 99, name: '0099_breaks', foreignKeysOff: true, up: 'INSERT INTO book_authors (book_id, author_id) VALUES (12345, 67890);' };
    await expect(migrate(db, [...migrations, breaking])).rejects.toThrow(MigrationError);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await db.all('SELECT * FROM book_authors')).toEqual([]);
    expect(await db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
    await db.close();
  });
});
