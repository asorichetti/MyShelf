/**
 * @jest-environment node
 */
import {
  BookAlreadyOnLoanError,
  BookNotFoundError,
  booksRepo,
  BorrowerHasLoansError,
  BorrowerNotFoundError,
  loansRepo as repo,
  type Db,
} from '@/db';
import { LoanValidationError, type IsoDate } from '@/domain';
import { createTestDb } from '@/testing/createTestDb';

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const book = (title: string) => booksRepo.createBook(db, { title });
const lend = (bookId: number, borrowerId: number, lentOn: IsoDate = '2026-09-01', dueOn: IsoDate | null = null) =>
  repo.lendBook(db, { bookId, borrowerId, lentOn, dueOn });
const names = (list: { name: string }[]) => list.map((b) => b.name);

describe('borrower CRUD', () => {
  it('trims names and stores blank contact as null', async () => {
    const sam = await repo.createBorrower(db, '  Sam ', '  ');
    expect(sam).toEqual({ id: sam.id, name: 'Sam', contact: null });
    const kim = await repo.createBorrower(db, 'Kim', ' next door ');
    expect(kim.contact).toBe('next door');
    expect(await repo.getBorrower(db, kim.id)).toEqual(kim);
  });

  it.each<[string, Parameters<typeof repo.updateBorrower>[2], { name: string; contact: string | null }]>([
    ['name only', { name: ' Samantha ' }, { name: 'Samantha', contact: 'sam@example.com' }],
    ['contact only', { contact: '07700 900123' }, { name: 'Sam', contact: '07700 900123' }],
    ['clear contact with null', { contact: null }, { name: 'Sam', contact: null }],
    ['clear contact with blank', { contact: '   ' }, { name: 'Sam', contact: null }],
    ['empty patch', {}, { name: 'Sam', contact: 'sam@example.com' }],
  ])('updates %s', async (_, patch, expected) => {
    const sam = await repo.createBorrower(db, 'Sam', 'sam@example.com');
    expect(await repo.updateBorrower(db, sam.id, patch)).toEqual({ id: sam.id, ...expected });
    expect(await repo.getBorrower(db, sam.id)).toEqual({ id: sam.id, ...expected });
  });

  it('refuses a blank name', async () => {
    await expect(repo.createBorrower(db, '   ')).rejects.toThrow(/CHECK/);
  });

  it('returns null for a missing borrower', async () => {
    expect(await repo.getBorrower(db, 999)).toBeNull();
    expect(await repo.updateBorrower(db, 999, { name: 'x' })).toBeNull();
    expect(await repo.deleteBorrower(db, 999)).toBe(false);
  });
});

describe('findBorrowerByName (duplicate suggestion)', () => {
  it.each([
    ['Sam', 'sam'],
    ['Sam', '  SAM '],
    ['Zoë', 'zoe'],
    ["Mary-Jane O'Neill", 'mary jane oneill'],
  ])('"%s" is suggested for "%s"', async (stored, typed) => {
    const b = await repo.createBorrower(db, stored);
    expect(await repo.findBorrowerByName(db, typed)).toEqual(b);
  });

  it.each([['Samantha'], ['Sa'], [''], ['  ']])('nothing is suggested for "%s"', async (typed) => {
    await repo.createBorrower(db, 'Sam');
    expect(await repo.findBorrowerByName(db, typed)).toBeNull();
  });

  it('keeps articles significant in names', async () => {
    await repo.createBorrower(db, 'The Smiths');
    expect(await repo.findBorrowerByName(db, 'Smiths')).toBeNull();
  });

  it('prefers the oldest when duplicates already exist', async () => {
    const first = await repo.createBorrower(db, 'Sam');
    await repo.createBorrower(db, 'SAM');
    expect((await repo.findBorrowerByName(db, 'sam'))!.id).toBe(first.id);
  });
});

describe('listBorrowersWithStats / searchBorrowers', () => {
  async function seed() {
    const sam = await repo.createBorrower(db, 'Sam Vimes');
    const kim = await repo.createBorrower(db, 'Kim');
    const zoe = await repo.createBorrower(db, 'Zoë Samuels');
    const amy = await repo.createBorrower(db, 'Amy');
    const [a, b, c] = [await book('A'), await book('B'), await book('C')];
    const old = await lend(a.id, sam.id, '2026-01-01');
    await repo.returnLoan(db, old.id, '2026-01-10');
    await lend(b.id, sam.id, '2026-03-01');
    await lend(c.id, kim.id, '2026-06-01');
    return { sam, kim, zoe, amy };
  }

  it('counts open and total loans, most recent borrower first, then A-Z', async () => {
    const { sam, kim, zoe, amy } = await seed();
    expect(await repo.listBorrowersWithStats(db)).toEqual([
      { ...kim, openLoans: 1, totalLoans: 1, lastLentOn: '2026-06-01' },
      { ...sam, openLoans: 1, totalLoans: 2, lastLentOn: '2026-03-01' },
      { ...amy, openLoans: 0, totalLoans: 0, lastLentOn: null },
      { ...zoe, openLoans: 0, totalLoans: 0, lastLentOn: null },
    ]);
  });

  it.each<[string, string[]]>([
    ['', ['Kim', 'Sam Vimes', 'Amy', 'Zoë Samuels']],
    ['   ', ['Kim', 'Sam Vimes', 'Amy', 'Zoë Samuels']],
    ['s', ['Sam Vimes', 'Zoë Samuels']],
    ['SAM', ['Sam Vimes', 'Zoë Samuels']],
    ['vim', ['Sam Vimes']],
    ['zoe', ['Zoë Samuels']],
    ['zoë', ['Zoë Samuels']],
    ['k', ['Kim']],
    ['im', []],
    ['%', ['Kim', 'Sam Vimes', 'Amy', 'Zoë Samuels']],
    ['x', []],
  ])('prefix "%s"', async (prefix, expected) => {
    await seed();
    expect(names(await repo.searchBorrowers(db, prefix))).toEqual(expected);
  });
});

describe('deleting borrowers', () => {
  it('deletes a borrower with no loans', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    expect(await repo.deleteBorrower(db, sam.id)).toBe(true);
    expect(await repo.getBorrower(db, sam.id)).toBeNull();
  });

  it('is blocked while a book is out, even after clearing history', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const [a, b] = [await book('A'), await book('B')];
    const past = await lend(a.id, sam.id, '2026-01-01');
    await repo.returnLoan(db, past.id, '2026-01-05');
    const current = await lend(b.id, sam.id, '2026-02-01');

    await expect(repo.deleteBorrower(db, sam.id)).rejects.toBeInstanceOf(BorrowerHasLoansError);
    expect(await repo.deleteReturnedLoansForBorrower(db, sam.id)).toBe(1);
    expect((await repo.listLoansForBorrower(db, sam.id)).map((l) => l.id)).toEqual([current.id]);
    await expect(repo.deleteBorrower(db, sam.id)).rejects.toBeInstanceOf(BorrowerHasLoansError);
    expect(await repo.getBorrower(db, sam.id)).not.toBeNull();

    await repo.returnLoan(db, current.id, '2026-02-10');
    expect(await repo.deleteReturnedLoansForBorrower(db, sam.id)).toBe(1);
    expect(await repo.deleteBorrower(db, sam.id)).toBe(true);
  });

  it('clearing history only touches that borrower', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const kim = await repo.createBorrower(db, 'Kim');
    const a = await book('A');
    const l1 = await lend(a.id, sam.id, '2026-01-01');
    await repo.returnLoan(db, l1.id, '2026-01-02');
    const l2 = await lend(a.id, kim.id, '2026-01-03');
    await repo.returnLoan(db, l2.id, '2026-01-04');
    expect(await repo.deleteReturnedLoansForBorrower(db, sam.id)).toBe(1);
    expect(names((await repo.listLoansForBook(db, a.id)).map((l) => ({ name: l.borrowerName })))).toEqual(['Kim']);
    expect(await repo.deleteReturnedLoansForBorrower(db, 999)).toBe(0);
  });
});

describe('lending rules in the repository', () => {
  it('allows one open loan per book', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const kim = await repo.createBorrower(db, 'Kim');
    const a = await book('A');
    const first = await lend(a.id, sam.id);
    await expect(lend(a.id, kim.id, '2026-09-02')).rejects.toBeInstanceOf(BookAlreadyOnLoanError);
    await expect(lend(a.id, sam.id, '2026-09-02')).rejects.toBeInstanceOf(BookAlreadyOnLoanError);
    expect(await repo.getOpenLoanForBook(db, a.id)).toEqual(first);
  });

  it('refuses to lend to a deleted borrower', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    await repo.deleteBorrower(db, sam.id);
    const error = await lend(a.id, sam.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BorrowerNotFoundError);
    expect((error as BorrowerNotFoundError).borrowerId).toBe(sam.id);
    expect(await repo.getOpenLoanForBook(db, a.id)).toBeNull();
  });

  it('refuses to lend a deleted book', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    await booksRepo.deleteBook(db, a.id);
    await expect(lend(a.id, sam.id)).rejects.toBeInstanceOf(BookNotFoundError);
  });

  it.each<[string, { lentOn: IsoDate; dueOn?: IsoDate | null }, string]>([
    ['malformed lent date', { lentOn: '2026-9-1' }, 'lentOn invalid-date'],
    ['impossible due date', { lentOn: '2026-02-01', dueOn: '2026-02-30' }, 'dueOn invalid-date'],
    ['due before lent', { lentOn: '2026-02-01', dueOn: '2026-01-31' }, 'dueOn due-before-lent'],
  ])('rejects %s before touching the database', async (_, dates, message) => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    const error = await repo.lendBook(db, { bookId: a.id, borrowerId: sam.id, ...dates }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoanValidationError);
    expect((error as Error).message).toContain(message);
    expect(await repo.listLoansForBook(db, a.id)).toEqual([]);
  });

  it('accepts a return after the due date and a same-day return', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const [a, b] = [await book('A'), await book('B')];
    const late = await lend(a.id, sam.id, '2026-09-01', '2026-09-15');
    expect(await repo.returnLoan(db, late.id, '2026-10-01')).toMatchObject({ returnedOn: '2026-10-01', dueOn: '2026-09-15' });
    const quick = await lend(b.id, sam.id, '2026-09-01');
    expect(await repo.returnLoan(db, quick.id, '2026-09-01')).toMatchObject({ returnedOn: '2026-09-01' });
  });

  it('rejects a malformed or early return date and leaves the loan open', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    const loan = await lend(a.id, sam.id, '2026-09-10');
    await expect(repo.returnLoan(db, loan.id, '10/09/2026')).rejects.toBeInstanceOf(LoanValidationError);
    await expect(repo.returnLoan(db, loan.id, '2026-09-09')).rejects.toBeInstanceOf(LoanValidationError);
    expect(await repo.getOpenLoanForBook(db, a.id)).toEqual(loan);
    expect(await repo.returnLoan(db, 999, '2026-09-11')).toBeNull();
  });

  it('validates a changed due date', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    const loan = await lend(a.id, sam.id, '2026-09-10', '2026-09-20');
    await expect(repo.updateLoan(db, loan.id, { dueOn: '2026-09-01' })).rejects.toBeInstanceOf(LoanValidationError);
    expect(await repo.updateLoan(db, loan.id, { dueOn: null })).toMatchObject({ dueOn: null });
    expect(await repo.getLoan(db, loan.id)).toMatchObject({ dueOn: null });
  });

  it('the database CHECK constraints remain as a backstop', async () => {
    const sam = await repo.createBorrower(db, 'Sam');
    const a = await book('A');
    await expect(
      db.run('INSERT INTO loans (book_id, borrower_id, lent_on, due_on) VALUES (?, ?, ?, ?)', [a.id, sam.id, '2026-09-10', '2026-09-01']),
    ).rejects.toThrow(/CHECK/);
  });
});
