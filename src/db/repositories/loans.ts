import { assertValidLoanDates, normaliseText, type Borrower, type IsoDate, type Loan, type LoanWithDetails, type NewLoan } from '@/domain';

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

/** Thrown when lending to a borrower who does not exist (e.g. deleted meanwhile). */
export class BorrowerNotFoundError extends Error {
  constructor(readonly borrowerId: number) {
    super(`Borrower ${borrowerId} does not exist`);
    this.name = 'BorrowerNotFoundError';
  }
}

/** Thrown when lending a book that does not exist (e.g. deleted meanwhile). */
export class BookNotFoundError extends Error {
  constructor(readonly bookId: number) {
    super(`Book ${bookId} does not exist`);
    this.name = 'BookNotFoundError';
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

/** Blank contact text is stored as null. */
const cleanContact = (contact: string | null | undefined): string | null => contact?.trim() || null;

export async function createBorrower(db: Db, name: string, contact: string | null = null): Promise<Borrower> {
  const clean = name.trim();
  const cleanedContact = cleanContact(contact);
  const { lastInsertRowId } = await db.run('INSERT INTO borrowers (name, contact) VALUES (?, ?)', [clean, cleanedContact]);
  return { id: lastInsertRowId, name: clean, contact: cleanedContact };
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
  const next = {
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    contact: 'contact' in patch ? cleanContact(patch.contact) : current.contact,
  };
  await db.run('UPDATE borrowers SET name = ?, contact = ? WHERE id = ?', [next.name, next.contact, id]);
  return next;
}

export interface BorrowerWithStats extends Borrower {
  /** Books they have now. */
  openLoans: number;
  /** Every loan, open or returned. */
  totalLoans: number;
  /** When they last borrowed something, or null. */
  lastLentOn: IsoDate | null;
}

type BorrowerStatsRow = Borrower & { open_loans: number; total_loans: number; last_lent_on: string | null };

const toStats = (r: BorrowerStatsRow): BorrowerWithStats => ({
  id: r.id,
  name: r.name,
  contact: r.contact,
  openLoans: r.open_loans,
  totalLoans: r.total_loans,
  lastLentOn: r.last_lent_on,
});

/** Borrowers with loan counts, most recent borrower first; people who never borrowed follow A-Z. */
export async function listBorrowersWithStats(db: Db): Promise<BorrowerWithStats[]> {
  const rows = await db.all<BorrowerStatsRow>(
    `SELECT p.id, p.name, p.contact,
       COUNT(l.id) AS total_loans,
       COUNT(l.id) - COUNT(l.returned_on) AS open_loans,
       MAX(l.lent_on) AS last_lent_on
     FROM borrowers p LEFT JOIN loans l ON l.borrower_id = p.id
     GROUP BY p.id
     ORDER BY last_lent_on IS NULL, last_lent_on DESC, p.name COLLATE NOCASE, p.id`,
  );
  return rows.map(toStats);
}

/** Matching key for borrower names: case, accents and punctuation ignored. */
const nameKey = (name: string) => normaliseText(name, { dropArticle: false });

/**
 * Borrowers whose name, or any word of it, starts with `prefix` (ignoring
 * case and accents), most recent borrower first. A blank prefix lists all.
 */
export async function searchBorrowers(db: Db, prefix: string): Promise<BorrowerWithStats[]> {
  const q = nameKey(prefix);
  const all = await listBorrowersWithStats(db);
  if (!q) return all;
  return all.filter((b) => {
    const key = nameKey(b.name);
    return key.startsWith(q) || key.split(' ').some((word) => word.startsWith(q));
  });
}

/**
 * An existing borrower with the same name ignoring case, accents and
 * punctuation ("sam" for "Sam"), so the picker can ask "Sam already exists —
 * use them?" instead of creating a duplicate. The oldest match wins.
 */
export async function findBorrowerByName(db: Db, name: string): Promise<Borrower | null> {
  const key = nameKey(name);
  if (!key) return null;
  return (await db.all<Borrower>('SELECT id, name, contact FROM borrowers ORDER BY id')).find((b) => nameKey(b.name) === key) ?? null;
}

/**
 * Deletes a borrower's returned loans (their history), leaving open loans,
 * so the borrower can then be deleted. Returns how many were removed.
 */
export async function deleteReturnedLoansForBorrower(db: Db, borrowerId: number): Promise<number> {
  return (await db.run('DELETE FROM loans WHERE borrower_id = ? AND returned_on IS NOT NULL', [borrowerId])).changes;
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

/**
 * Lends a book. Throws LoanValidationError for bad dates (see
 * `validateLoanDates`; the caller checks "not in the future" against its
 * clock), BookAlreadyOnLoanError if the book is already out, and
 * BorrowerNotFoundError / BookNotFoundError if either has gone.
 */
export async function lendBook(db: Db, input: NewLoan): Promise<Loan> {
  assertValidLoanDates(input);
  try {
    const { lastInsertRowId } = await db.run(
      'INSERT INTO loans (book_id, borrower_id, lent_on, due_on, note) VALUES (?, ?, ?, ?, ?)',
      [input.bookId, input.borrowerId, input.lentOn, input.dueOn ?? null, input.note ?? null],
    );
    return (await getLoan(db, lastInsertRowId))!;
  } catch (error) {
    if (/UNIQUE constraint failed: loans\.book_id/i.test(String(error))) throw new BookAlreadyOnLoanError(input.bookId);
    if (/FOREIGN KEY constraint failed/i.test(String(error))) {
      if (!(await getBorrower(db, input.borrowerId))) throw new BorrowerNotFoundError(input.borrowerId);
      throw new BookNotFoundError(input.bookId);
    }
    throw error;
  }
}

/**
 * Marks a loan returned. Returns null if the loan does not exist or was
 * already returned; throws LoanValidationError for a bad date or one before
 * the loan began.
 */
export async function returnLoan(db: Db, loanId: number, returnedOn: IsoDate): Promise<Loan | null> {
  const loan = await getLoan(db, loanId);
  if (!loan || loan.returnedOn != null) return null;
  assertValidLoanDates({ lentOn: loan.lentOn, dueOn: loan.dueOn, returnedOn });
  const { changes } = await db.run('UPDATE loans SET returned_on = ? WHERE id = ? AND returned_on IS NULL', [returnedOn, loanId]);
  return changes ? getLoan(db, loanId) : null;
}

/**
 * Undoes a return: the loan is open again. Returns null if the loan does not
 * exist or is already open; throws BookAlreadyOnLoanError if the book has
 * gone out on another loan since.
 */
export async function reopenLoan(db: Db, loanId: number): Promise<Loan | null> {
  const loan = await getLoan(db, loanId);
  if (!loan || loan.returnedOn == null) return null;
  try {
    await db.run('UPDATE loans SET returned_on = NULL WHERE id = ?', [loanId]);
  } catch (error) {
    if (/UNIQUE constraint failed: loans\.book_id/i.test(String(error))) throw new BookAlreadyOnLoanError(loan.bookId);
    throw error;
  }
  return getLoan(db, loanId);
}

/** Changes a loan's due date or note. Throws LoanValidationError for a bad due date. */
export async function updateLoan(db: Db, loanId: number, patch: Partial<Pick<Loan, 'dueOn' | 'note'>>): Promise<Loan | null> {
  const current = await getLoan(db, loanId);
  if (!current) return null;
  const next = { ...current, ...patch };
  assertValidLoanDates({ lentOn: next.lentOn, dueOn: next.dueOn });
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
