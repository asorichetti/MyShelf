/** The counts every series summary shows (a `SeriesSummary` or a series detail). */
export interface SeriesCounts {
  name: string;
  owned: number;
  total: number | null;
  missing: number;
  /** Every linked book, numbered or not. */
  bookCount: number;
  /** The user's own total, when set. */
  totalCount: number | null;
}

export const booksText = (n: number) => (n === 1 ? '1 book' : `${n} books`);

/** "5 of 9", or "2 books" when none is numbered. */
export function progressText(s: SeriesCounts): string {
  if (s.total == null) return s.bookCount ? booksText(s.bookCount) : 'No books yet';
  return `${s.owned} of ${s.total}`;
}

/** "5 of 9 owned, 2 missing" / "3 of 3 owned, complete" / "2 books, not numbered". */
export function progressSentence(s: SeriesCounts): string {
  if (s.total == null) return s.bookCount ? `${booksText(s.bookCount)}, not numbered` : 'No books yet';
  const tail = s.missing ? `${s.missing} missing` : s.totalCount != null ? 'complete' : 'none missing so far';
  return `${s.owned} of ${s.total} owned, ${tail}`;
}

/** What a screen reader says for a series: "Discworld, 5 of 9 owned, 2 missing". */
export function seriesLabel(s: SeriesCounts): string {
  return `${s.name}, ${progressSentence(s)}`;
}
