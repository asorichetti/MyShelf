/** Calendar dates are stored as ISO `YYYY-MM-DD` strings. */
export type IsoDate = string;

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

export function isOverdue(loan: Pick<Loan, 'dueOn' | 'returnedOn'>, today: IsoDate): boolean {
  return loan.returnedOn == null && loan.dueOn != null && loan.dueOn < today;
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
