/**
 * @jest-environment node
 */
import { booksRepo, loansRepo, type Db } from '@/db';
import { loanStatus, noFilters, setToday } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';
import { loadFixture } from '@/testing/loadFixture';

let db: Db;
beforeAll(async () => {
  setToday('2026-06-15');
  db = await createTestDb();
  await loadFixture(db, 'demo');
});
afterAll(() => {
  setToday(null);
  return db.close();
});

describe('listBookItems loan status (P05-09)', () => {
  it('says who has each book out and when it is due', async () => {
    const items = await booksRepo.listBookItems(db);
    const out = items.filter((b) => b.onLoan).map((b) => [b.title, b.loanBorrower, b.loanDueOn]);
    expect(out).toEqual([
      ['Dune', 'Sam', '2026-06-26'],
      ['The Murder of Roger Ackroyd', 'Priya', '2026-06-10'],
    ]);
    // Mort was lent and returned: home, with no borrower.
    expect(items.find((b) => b.title === 'Mort')).toMatchObject({ onLoan: false, loanBorrower: null, loanDueOn: null });
  });

  it('matches the Loans tab: the same books, the same overdue verdict', async () => {
    const items = await booksRepo.listBookItems(db);
    const open = await loansRepo.listOpenLoans(db);
    const shelf = items
      .filter((b) => b.onLoan)
      .map((b) => `${b.title}:${loanStatus({ dueOn: b.loanDueOn ?? null, returnedOn: null }, '2026-06-15')}`)
      .sort();
    expect(shelf).toEqual(open.map((l) => `${l.bookTitle}:${loanStatus(l, '2026-06-15')}`).sort());
  });

  it('the Shelf\'s "On loan" filter lists the same books', async () => {
    const titles = (await booksRepo.listBookItems(db, { filters: { ...noFilters, loan: 'onLoan' } })).map((b) => b.title);
    expect(titles).toEqual(['Dune', 'The Murder of Roger Ackroyd']);
    expect((await booksRepo.listBookItems(db, { filters: { ...noFilters, loan: 'onLoan' }, query: 'dune' })).map((b) => b.title)).toEqual(['Dune']);
  });
});
