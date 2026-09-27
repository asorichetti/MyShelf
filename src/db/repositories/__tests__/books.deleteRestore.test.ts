/**
 * @jest-environment node
 */
import { booksRepo, groupsRepo, libraryRepo, loansRepo, type Db } from '@/db';
import { emptyDraft, validateBookDraft } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterEach(() => db.close());

const TABLES = ['books', 'authors', 'book_authors', 'genres', 'book_genres', 'series', 'groups', 'group_books', 'borrowers', 'loans'];

/** Every row of every library table, in a stable order. */
async function dump(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.all(`SELECT * FROM ${t} ORDER BY 1, 2`);
  return out;
}

const idOf = async (isbn: string) => (await booksRepo.findBooksByIsbn(db, isbn))[0].id;

describe('removeBook and restoreBook', () => {
  it.each([
    ['Dune (open loan, only book by its author)', '9780441172719'],
    ['Good Omens (two authors, in a group)', '9780575048003'],
    ['Mort (series, returned loan)', '9780552131063'],
    ['The Murder of Roger Ackroyd (overdue loan)', '9780007527526'],
  ])('%s: delete removes every dependent row, undo restores them exactly', async (_name, isbn) => {
    const id = await idOf(isbn);
    const before = await dump();

    const snapshot = await booksRepo.removeBook(db, id);
    expect(snapshot).not.toBeNull();
    expect(await booksRepo.getBook(db, id)).toBeNull();
    for (const table of ['book_authors', 'book_genres', 'group_books', 'loans']) {
      const left = await db.all(`SELECT * FROM ${table} WHERE book_id = ?`, [id]);
      expect(left).toEqual([]);
    }
    expect(await booksRepo.countBooks(db)).toBe(11);

    await booksRepo.restoreBook(db, snapshot!);
    expect(await dump()).toEqual(before);
  });

  it('removes an author left without books, and brings them back on undo', async () => {
    const id = await idOf('9780441172719');
    const snapshot = await booksRepo.removeBook(db, id);
    expect(await db.all("SELECT * FROM authors WHERE name = 'Frank Herbert'")).toEqual([]);
    await booksRepo.restoreBook(db, snapshot!);
    expect((await booksRepo.getBookDetail(db, id))!.authors.map((a) => a.name)).toEqual(['Frank Herbert']);
  });

  it('restores a group or borrower deleted in the meantime', async () => {
    const id = await idOf('9780575048003');
    const [group] = await groupsRepo.listGroups(db);
    const snapshot = await booksRepo.removeBook(db, id);
    await groupsRepo.deleteGroup(db, group.id);
    await booksRepo.restoreBook(db, snapshot!);
    expect((await groupsRepo.listGroupsForBook(db, id)).map((g) => g.name)).toEqual(['Holiday reads']);

    const ackroyd = await idOf('9780007527526');
    const snap2 = await booksRepo.removeBook(db, ackroyd);
    const priya = (await loansRepo.listBorrowers(db)).find((b) => b.name === 'Priya')!;
    await loansRepo.deleteBorrower(db, priya.id);
    await booksRepo.restoreBook(db, snap2!);
    expect((await loansRepo.getOpenLoanForBook(db, ackroyd))!.borrowerId).toBe(priya.id);
  });

  it('is all or nothing: a failed restore leaves the library as it was', async () => {
    const id = await idOf('9780441172719');
    const snapshot = await booksRepo.removeBook(db, id);
    const counts = await libraryRepo.countRows(db);
    await expect(booksRepo.restoreBook(db, { ...snapshot!, loans: [{ ...snapshot!.loans[0], lent_on: null }] })).rejects.toThrow();
    expect(await libraryRepo.countRows(db)).toEqual(counts);
  });

  it('never gives a deleted book’s id (or its loans’) to a book added before Undo, so Undo puts it back as it was', async () => {
    // The newest book, with an author and an open loan: the highest book and loan ids.
    const borrower = (await loansRepo.listBorrowers(db))[0];
    const draft = validateBookDraft({ ...emptyDraft(), title: 'Newest', authors: [{ name: 'Nova Author', role: 'author', sortName: null }] });
    if (!draft.ok) throw new Error('invalid draft');
    const id = await booksRepo.saveBookDraft(db, draft.value);
    const lent = await loansRepo.lendBook(db, { bookId: id, borrowerId: borrower.id, lentOn: '2026-01-01' });
    const snapshot = (await booksRepo.removeBook(db, id))!;

    // Covers are stored as covers/<book id>.jpg: a newcomer must not inherit the deleted book's file.
    const newcomer = await booksRepo.createBook(db, { title: 'Newcomer' });
    expect(newcomer.id).toBeGreaterThan(id);
    const loan = await loansRepo.lendBook(db, { bookId: newcomer.id, borrowerId: borrower.id, lentOn: '2026-01-02' });
    expect(loan.id).toBeGreaterThan(lent.id);

    expect(await booksRepo.restoreBook(db, snapshot)).toBe(id);
    const detail = (await booksRepo.getBookDetail(db, id))!;
    expect(detail).toMatchObject({ title: 'Newest', openLoan: { id: lent.id, borrowerId: borrower.id, lentOn: '2026-01-01' } });
    expect(detail.authors.map((a) => a.name)).toEqual(['Nova Author']);
    expect((await booksRepo.getBookDetail(db, newcomer.id))!).toMatchObject({ title: 'Newcomer', openLoan: { id: loan.id } });
  });

  it('still brings a book back, under a new id, if its id is taken all the same (a restored backup)', async () => {
    const dune = await idOf('9780441172719');
    const snapshot = (await booksRepo.removeBook(db, dune))!;
    await db.run('INSERT INTO books (id, title) VALUES (?, ?)', [dune, 'Squatter']);
    const restored = await booksRepo.restoreBook(db, snapshot);
    expect(restored).not.toBe(dune);
    const detail = (await booksRepo.getBookDetail(db, restored))!;
    expect(detail.title).toBe('Dune');
    expect(detail.authors.map((a) => a.name)).toEqual(['Frank Herbert']);
    expect(detail.openLoan).not.toBeNull();
    expect((await booksRepo.getBook(db, dune))!.title).toBe('Squatter');
  });

  it('returns null for an unknown book', async () => {
    expect(await booksRepo.removeBook(db, 99999)).toBeNull();
  });
});
