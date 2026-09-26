/**
 * @jest-environment node
 */
import { BookAlreadyOnLoanError, booksRepo, loansRepo as repo, type Db } from '@/db';
import { LoanValidationError } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
let bookId: number;
let samId: number;
beforeEach(async () => {
  db = await createTestDb();
  bookId = (await booksRepo.createBook(db, { title: 'Dune', coverUri: 'https://example.org/dune.jpg' })).id;
  samId = (await repo.createBorrower(db, 'Sam')).id;
});
afterEach(() => db.close());

const lend = (lentOn = '2026-06-01', dueOn: string | null = '2026-06-10', book = bookId) => repo.lendBook(db, { bookId: book, borrowerId: samId, lentOn, dueOn });

describe('returnLoan', () => {
  it('closes the loan so it moves to History', async () => {
    const loan = await lend();
    const done = await repo.returnLoan(db, loan.id, '2026-06-12');
    expect(done?.returnedOn).toBe('2026-06-12');
    expect(await repo.listOpenLoans(db)).toEqual([]);
    expect((await repo.listReturnedLoans(db)).map((l) => l.id)).toEqual([loan.id]);
  });

  it('refuses a return before the lent date and ignores a second return', async () => {
    const loan = await lend();
    await expect(repo.returnLoan(db, loan.id, '2026-05-31')).rejects.toBeInstanceOf(LoanValidationError);
    expect(await repo.returnLoan(db, loan.id, '2026-06-02')).not.toBeNull();
    expect(await repo.returnLoan(db, loan.id, '2026-06-03')).toBeNull();
    expect((await repo.getLoan(db, loan.id))?.returnedOn).toBe('2026-06-02');
  });
});

describe('reopenLoan (undo a return)', () => {
  it('puts a returned loan back out', async () => {
    const loan = await lend();
    await repo.returnLoan(db, loan.id, '2026-06-05');
    const again = await repo.reopenLoan(db, loan.id);
    expect(again).toMatchObject({ id: loan.id, returnedOn: null });
    expect((await repo.getOpenLoanForBook(db, bookId))?.id).toBe(loan.id);
  });

  it('refuses when the book has gone out on another loan since', async () => {
    const first = await lend();
    await repo.returnLoan(db, first.id, '2026-06-05');
    await lend('2026-06-06', null);
    await expect(repo.reopenLoan(db, first.id)).rejects.toBeInstanceOf(BookAlreadyOnLoanError);
    expect((await repo.getLoan(db, first.id))?.returnedOn).toBe('2026-06-05');
  });

  it('returns null for an open or unknown loan', async () => {
    const loan = await lend();
    expect(await repo.reopenLoan(db, loan.id)).toBeNull();
    expect(await repo.reopenLoan(db, 9999)).toBeNull();
  });
});

describe('listReturnedLoans', () => {
  it('lists returned loans, most recently returned first, with the book cover', async () => {
    const other = (await booksRepo.createBook(db, { title: 'Mort' })).id;
    const a = await lend('2026-05-01', null);
    await repo.returnLoan(db, a.id, '2026-05-20');
    const b = await lend('2026-05-02', null, other);
    await repo.returnLoan(db, b.id, '2026-05-25');
    await lend('2026-06-01', null);
    const list = await repo.listReturnedLoans(db);
    expect(list.map((l) => [l.bookTitle, l.returnedOn])).toEqual([
      ['Mort', '2026-05-25'],
      ['Dune', '2026-05-20'],
    ]);
    expect(list[1]).toMatchObject({ borrowerName: 'Sam', bookCoverUri: 'https://example.org/dune.jpg' });
  });
});

describe('countOverdueLoans', () => {
  it('counts open loans due before today only', async () => {
    const other = (await booksRepo.createBook(db, { title: 'Mort' })).id;
    const third = (await booksRepo.createBook(db, { title: 'Emma' })).id;
    await lend('2026-06-01', '2026-06-10');
    await lend('2026-06-01', '2026-06-15', other);
    const returned = await lend('2026-06-01', '2026-06-02', third);
    await repo.returnLoan(db, returned.id, '2026-06-03');
    expect(await repo.countOverdueLoans(db, '2026-06-15')).toBe(1);
    expect(await repo.countOverdueLoans(db, '2026-06-16')).toBe(2);
    expect(await repo.countOverdueLoans(db, '2026-06-10')).toBe(0);
  });
});
