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
  bookId = (await booksRepo.createBook(db, { title: 'Dune' })).id;
  samId = (await repo.createBorrower(db, 'Sam')).id;
});
afterEach(() => db.close());

const lend = (lentOn = '2026-06-01', dueOn: string | null = '2026-06-10', book = bookId) => repo.lendBook(db, { bookId: book, borrowerId: samId, lentOn, dueOn });

describe('returnLoan', () => {
  it('closes the loan', async () => {
    const loan = await lend();
    const done = await repo.returnLoan(db, loan.id, '2026-06-12');
    expect(done?.returnedOn).toBe('2026-06-12');
    expect(await repo.listOpenLoans(db)).toEqual([]);
    expect((await repo.listLoansForBook(db, bookId)).map((l) => l.returnedOn)).toEqual(['2026-06-12']);
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
