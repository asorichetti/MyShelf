import type { Borrower, IsoDate, Loan, LoanWithDetails, NewLoan } from '@/domain';

import type { Db } from '../types';

/** Thrown when lending a book that is already out on an open loan. */
export class BookAlreadyOnLoanError extends Error {
  constructor(readonly bookId: number) {
    super(`Book ${bookId} is already on loan`);
    this.name = 'BookAlreadyOnLoanError';
  }
}

/** Thrown when deleting a borrower who still has loan history. */
export class BorrowerHasLoansError extends Error {
  constructor(readonly borrowerId: number) {
    super(`Borrower ${borrowerId} has loans and cannot be deleted`);
    this.name = 'BorrowerHasLoansError';
  }
}

interface LoanRow {
  id: number;
  book_id: number;
  borrower_id: number;
  lent_on: string;
  due_on: string | null;
  returned_on: string | null;
  note: string | null;
}

const LOAN_COLUMNS = 'l.id, l.book_id, l.borrower_id, l.lent_on, l.due_on, l.returned_on, l.note';
const DETAIL_SELECT = `SELECT ${LOAN_COLUMNS}, b.title AS book_title, p.name AS borrower_name
  FROM loans l JOIN books b ON b.id = l.book_id JOIN borrowers p ON p.id = l.borrower_id`;

const toLoan = (r: LoanRow): Loan => ({
  id: r.id,
  bookId: r.book_id,
  borrowerId: r.borrower_id,
  lentOn: r.lent_on,
  dueOn: r.due_on,
  returnedOn: r.returned_on,
  note: r.note,
});

const toDetails = (r: LoanRow & { book_title: string; borrower_name: string }): LoanWithDetails => ({
  ...toLoan(r),
  bookTitle: r.book_title,
  borrowerName: r.borrower_name,
});

// ---- Borrowers ----

export async function createBorrower(db: Db, name: string, contact: string | null = null): Promise<Borrower> {
  const clean = name.trim();
  const { lastInsertRowId } = await db.run('INSERT INTO borrowers (name, contact) VALUES (?, ?)', [clean, contact]);
  return { id: lastInsertRowId, name: clean, contact };
}

export async function getBorrower(db: Db, id: number): Promise<Borrower | null> {
  return db.get<Borrower>('SELECT id, name, contact FROM borrowers WHERE id = ?', [id]);
}

export async function listBorrowers(db: Db): Promise<Borrower[]> {
  return db.all<Borrower>('SELECT id, name, contact FROM borrowers ORDER BY name COLLATE NOCASE, id');
}

export async function updateBorrower(db: Db, id: number, patch: Partial<Pick<Borrower, 'name' | 'contact'>>): Promise<Borrower | null> {
  const current = await getBorrower(db, id);
  if (!current) return null;
  const next = { ...current, ...patch, name: patch.name?.trim() ?? current.name };
  await db.run('UPDATE borrowers SET name = ?, contact = ? WHERE id = ?', [next.name, next.contact, id]);
  return next;
}

/** Deletes a borrower. Throws BorrowerHasLoansError if any loans (open or past) reference them. */
export async function deleteBorrower(db: Db, id: number): Promise<boolean> {
  try {
    return (await db.run('DELETE FROM borrowers WHERE id = ?', [id])).changes > 0;
  } catch (error) {
    if (/FOREIGN KEY constraint failed/i.test(String(error))) throw new BorrowerHasLoansError(id);
    throw error;
  }
}

// ---- Loans ----

/** Lends a book. Throws BookAlreadyOnLoanError if the book is already out. */
export async function lendBook(db: Db, input: NewLoan): Promise<Loan> {
  try {
    const { lastInsertRowId } = await db.run(
      'INSERT INTO loans (book_id, borrower_id, lent_on, due_on, note) VALUES (?, ?, ?, ?, ?)',
      [input.bookId, input.borrowerId, input.lentOn, input.dueOn ?? null, input.note ?? null],
    );
    return (await getLoan(db, lastInsertRowId))!;
  } catch (error) {
    if (/UNIQUE constraint failed: loans\.book_id/i.test(String(error))) throw new BookAlreadyOnLoanError(input.bookId);
    throw error;
  }
}

/** Marks a loan returned. Returns null if the loan does not exist or was already returned. */
export async function returnLoan(db: Db, loanId: number, returnedOn: IsoDate): Promise<Loan | null> {
  const { changes } = await db.run('UPDATE loans SET returned_on = ? WHERE id = ? AND returned_on IS NULL', [returnedOn, loanId]);
  return changes ? getLoan(db, loanId) : null;
}

export async function updateLoan(db: Db, loanId: number, patch: Partial<Pick<Loan, 'dueOn' | 'note'>>): Promise<Loan | null> {
  const current = await getLoan(db, loanId);
  if (!current) return null;
  const next = { ...current, ...patch };
  await db.run('UPDATE loans SET due_on = ?, note = ? WHERE id = ?', [next.dueOn, next.note, loanId]);
  return next;
}

export async function deleteLoan(db: Db, loanId: number): Promise<boolean> {
  return (await db.run('DELETE FROM loans WHERE id = ?', [loanId])).changes > 0;
}

export async function getLoan(db: Db, id: number): Promise<Loan | null> {
  const row = await db.get<LoanRow>(`SELECT ${LOAN_COLUMNS} FROM loans l WHERE l.id = ?`, [id]);
  return row ? toLoan(row) : null;
}

export async function getOpenLoanForBook(db: Db, bookId: number): Promise<Loan | null> {
  const row = await db.get<LoanRow>(`SELECT ${LOAN_COLUMNS} FROM loans l WHERE l.book_id = ? AND l.returned_on IS NULL`, [bookId]);
  return row ? toLoan(row) : null;
}

/** Books currently out, soonest due first (no due date last). */
export async function listOpenLoans(db: Db): Promise<LoanWithDetails[]> {
  const rows = await db.all<LoanRow & { book_title: string; borrower_name: string }>(
    `${DETAIL_SELECT} WHERE l.returned_on IS NULL ORDER BY l.due_on IS NULL, l.due_on, l.lent_on, l.id`,
  );
  return rows.map(toDetails);
}

/** Open loans whose due date is before `today`. */
export async function listOverdueLoans(db: Db, today: IsoDate): Promise<LoanWithDetails[]> {
  const rows = await db.all<LoanRow & { book_title: string; borrower_name: string }>(
    `${DETAIL_SELECT} WHERE l.returned_on IS NULL AND l.due_on < ? ORDER BY l.due_on, l.id`,
    [today],
  );
  return rows.map(toDetails);
}

/** A book's loan history, newest first. */
export async function listLoansForBook(db: Db, bookId: number): Promise<LoanWithDetails[]> {
  const rows = await db.all<LoanRow & { book_title: string; borrower_name: string }>(
    `${DETAIL_SELECT} WHERE l.book_id = ? ORDER BY l.lent_on DESC, l.id DESC`,
    [bookId],
  );
  return rows.map(toDetails);
}

/** A borrower's loans, open ones first, then newest first. */
export async function listLoansForBorrower(db: Db, borrowerId: number): Promise<LoanWithDetails[]> {
  const rows = await db.all<LoanRow & { book_title: string; borrower_name: string }>(
    `${DETAIL_SELECT} WHERE l.borrower_id = ? ORDER BY l.returned_on IS NOT NULL, l.lent_on DESC, l.id DESC`,
    [borrowerId],
  );
  return rows.map(toDetails);
}
