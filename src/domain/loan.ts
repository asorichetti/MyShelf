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
  /** The book's cover, where the query includes it. */
  bookCoverUri?: string | null;
}

export interface NewLoan {
  bookId: number;
  borrowerId: number;
  lentOn: IsoDate;
  dueOn?: IsoDate | null;
  note?: string | null;
}
