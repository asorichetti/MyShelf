import type { AuthorRole, NewBook } from '@/domain';

/** A book in a fixture: book fields plus its authors, genres and series by name. */
export interface FixtureBook extends Omit<NewBook, 'seriesId' | 'seriesPosition'> {
  authors?: (string | { name: string; role: AuthorRole })[];
  genres?: string[];
  series?: { name: string; position: number | null };
}

/** A loan, with dates relative to "today" so overdue stays overdue. */
export interface FixtureLoan {
  /** Title of the book lent (unique within the fixture). */
  book: string;
  borrower: string;
  lentDaysAgo: number;
  /** Negative means the due date has passed. */
  dueInDays?: number | null;
  returnedDaysAgo?: number | null;
  note?: string | null;
}

export interface FixtureGroup {
  name: string;
  colour?: string | null;
  icon?: string | null;
  /** Titles, in shelf order. */
  books: string[];
}

export interface Fixture {
  books: FixtureBook[];
  loans?: FixtureLoan[];
  groups?: FixtureGroup[];
}
