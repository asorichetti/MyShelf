import type { AuthorRole, NewBook, SeriesConfidence } from '@/domain';

/** A book in a fixture: book fields plus its authors, genres and series by name. */
export interface FixtureBook extends Omit<NewBook, 'seriesId' | 'seriesPosition'> {
  authors?: (string | { name: string; role: AuthorRole })[];
  genres?: string[];
  /** `detected` marks a series that came from a metadata guess of that confidence, so the book asks "Is this …?". */
  series?: { name: string; position: number | null; detected?: Exclude<SeriesConfidence, 'high'> };
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
  /**
   * The first-run experience (P07-03): `false` shows the onboarding and turns
   * on Booky's welcome tips, `true` means it was finished (welcome tips on,
   * no onboarding). Unset, a fixture gets neither, so journeys start quietly.
   */
  onboarding?: boolean;
  loans?: FixtureLoan[];
  groups?: FixtureGroup[];
}
