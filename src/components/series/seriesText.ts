import { t } from '@/i18n';

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

export const booksText = (n: number) => t('common.books', { count: n });

/** "5 of 9", or "2 books" when none is numbered. */
export function progressText(s: SeriesCounts): string {
  if (s.total == null) return s.bookCount ? booksText(s.bookCount) : t('series.progress.noBooksYet');
  return t('series.progress.short', { owned: s.owned, total: s.total });
}

/** "5 of 9 owned, 2 missing" / "3 of 3 owned, complete" / "2 books, not numbered". */
export function progressSentence(s: SeriesCounts): string {
  if (s.total == null) return s.bookCount ? t('series.progress.notNumbered', { books: booksText(s.bookCount) }) : t('series.progress.noBooksYet');
  const tail = s.missing
    ? t('series.progress.missing', { count: s.missing })
    : s.totalCount != null
      ? t('series.progress.complete')
      : t('series.progress.noneMissing');
  return t('series.progress.sentence', { owned: s.owned, total: s.total, tail });
}

/** What a screen reader says for a series: "Discworld, 5 of 9 owned, 2 missing". */
export function seriesLabel(s: SeriesCounts): string {
  return t('series.progress.label', { name: s.name, progress: progressSentence(s) });
}
