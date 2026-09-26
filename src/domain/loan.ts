import type { IsoDate } from './dates';

export interface Borrower {
  id: number;
  name: string;
  contact: string | null;
}

export interface Loan {
  id: number;
  bookId: number;
  borrowerId: number;
  lentOn: IsoDate;
  dueOn: IsoDate | null;
  returnedOn: IsoDate | null;
  note: string | null;
}

export interface LoanWithDetails extends Loan {
  bookTitle: string;
  borrowerName: string;
}

export interface NewLoan {
  bookId: number;
  borrowerId: number;
  lentOn: IsoDate;
  dueOn?: IsoDate | null;
  note?: string | null;
}

/** An open loan whose due date is before `today`. */
export function isOverdue(loan: Pick<Loan, 'dueOn' | 'returnedOn'>, today: IsoDate): boolean {
  return loan.returnedOn == null && loan.dueOn != null && loan.dueOn < today;
}
