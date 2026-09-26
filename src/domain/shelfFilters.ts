import { bookFormats, type BookFormat } from './book';
import { isRating, minRatingLabel, type Rating } from './rating';

/** Whether a book is out on loan. */
export type LoanFilter = 'any' | 'onLoan' | 'atHome';
/** Whether a book belongs to a series. */
export type SeriesFilter = 'any' | 'inSeries' | 'standalone';

/**
 * The Shelf's filters. Different kinds combine with AND; the genres (and the
 * formats and languages) are alternatives, combined with OR.
 */
export interface ShelfFilters {
  genreIds: number[];
  formats: BookFormat[];
  /** ISO 639-1 codes. */
  languages: string[];
  loan: LoanFilter;
  series: SeriesFilter;
  yearFrom: number | null;
  yearTo: number | null;
  /** Only books the reader rated at least this many stars (unrated books are left out); null for any. */
  minRating: Rating | null;
  /** Only books added in the last 30 days. */
  recentlyAdded: boolean;
}

/** How far back "recently added" reaches. */
export const RECENTLY_ADDED_DAYS = 30;

export const noFilters: Readonly<ShelfFilters> = Object.freeze({
  genreIds: [],
  formats: [],
  languages: [],
  loan: 'any',
  series: 'any',
  yearFrom: null,
  yearTo: null,
  minRating: null,
  recentlyAdded: false,
});

const loanFilters: readonly LoanFilter[] = ['any', 'onLoan', 'atHome'];
const seriesFilters: readonly SeriesFilter[] = ['any', 'inSeries', 'standalone'];

const isYear = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 9999;
const uniq = <T>(list: T[]) => [...new Set(list)];

/**
 * Reads filters from untrusted input (a stored setting): anything missing or
 * of the wrong shape falls back to "no filter" for that field.
 */
export function parseShelfFilters(value: unknown): ShelfFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...noFilters, genreIds: [], formats: [], languages: [] };
  const v = value as Record<string, unknown>;
  const list = (x: unknown) => (Array.isArray(x) ? x : []);
  let yearFrom = isYear(v.yearFrom) ? v.yearFrom : null;
  let yearTo = isYear(v.yearTo) ? v.yearTo : null;
  if (yearFrom != null && yearTo != null && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  return {
    genreIds: uniq(list(v.genreIds).filter((id): id is number => Number.isInteger(id) && (id as number) > 0)),
    formats: uniq(list(v.formats).filter((f): f is BookFormat => (bookFormats as readonly unknown[]).includes(f))),
    languages: uniq(list(v.languages).filter((l): l is string => typeof l === 'string' && /^[a-z]{2}$/.test(l))),
    loan: loanFilters.includes(v.loan as LoanFilter) ? (v.loan as LoanFilter) : 'any',
    series: seriesFilters.includes(v.series as SeriesFilter) ? (v.series as SeriesFilter) : 'any',
    yearFrom,
    yearTo,
    minRating: isRating(v.minRating) ? v.minRating : null,
    recentlyAdded: v.recentlyAdded === true,
  };
}

/** How many filters are switched on (each genre, format and language counts once). */
export function activeFilterCount(f: ShelfFilters): number {
  return (
    f.genreIds.length +
    f.formats.length +
    f.languages.length +
    (f.loan !== 'any' ? 1 : 0) +
    (f.series !== 'any' ? 1 : 0) +
    (f.yearFrom != null || f.yearTo != null ? 1 : 0) +
    (f.minRating != null ? 1 : 0) +
    (f.recentlyAdded ? 1 : 0)
  );
}

export const hasActiveFilters = (f: ShelfFilters) => activeFilterCount(f) > 0;

/** One removable chip under the Shelf toolbar. */
export interface FilterChip {
  /** Stable key, e.g. `genre:3`, `loan`. */
  key: string;
  label: string;
  /** The filters with this one removed. */
  without: ShelfFilters;
}

export const formatLabels: Record<BookFormat, string> = {
  hardcover: 'Hardback',
  paperback: 'Paperback',
  ebook: 'E-book',
  audiobook: 'Audiobook',
  other: 'Other format',
};

export const loanFilterLabels: Record<LoanFilter, string> = { any: 'Any', onLoan: 'On loan', atHome: 'At home' };
export const seriesFilterLabels: Record<SeriesFilter, string> = { any: 'Any', inSeries: 'In a series', standalone: 'Standalone' };

/** "1950–1999", "From 1950", "Up to 1999". */
export function yearRangeLabel(from: number | null, to: number | null): string {
  if (from != null && to != null) return from === to ? `Published ${from}` : `${from}–${to}`;
  if (from != null) return `From ${from}`;
  return `Up to ${to}`;
}

/**
 * The active filters as chips, in the filter sheet's order. `genreName` and
 * `languageName` turn ids and codes into words.
 */
export function filterChips(
  f: ShelfFilters,
  genreName: (id: number) => string | undefined,
  languageName: (code: string) => string = (c) => c,
): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const id of f.genreIds) {
    chips.push({ key: `genre:${id}`, label: genreName(id) ?? 'Genre', without: { ...f, genreIds: f.genreIds.filter((g) => g !== id) } });
  }
  for (const format of f.formats) {
    chips.push({ key: `format:${format}`, label: formatLabels[format], without: { ...f, formats: f.formats.filter((x) => x !== format) } });
  }
  for (const code of f.languages) {
    chips.push({ key: `language:${code}`, label: languageName(code), without: { ...f, languages: f.languages.filter((x) => x !== code) } });
  }
  if (f.loan !== 'any') chips.push({ key: 'loan', label: loanFilterLabels[f.loan], without: { ...f, loan: 'any' } });
  if (f.series !== 'any') chips.push({ key: 'series', label: seriesFilterLabels[f.series], without: { ...f, series: 'any' } });
  if (f.yearFrom != null || f.yearTo != null) {
    chips.push({ key: 'year', label: yearRangeLabel(f.yearFrom, f.yearTo), without: { ...f, yearFrom: null, yearTo: null } });
  }
  if (f.minRating != null) chips.push({ key: 'rating', label: minRatingLabel(f.minRating), without: { ...f, minRating: null } });
  if (f.recentlyAdded) chips.push({ key: 'recent', label: `Added in the last ${RECENTLY_ADDED_DAYS} days`, without: { ...f, recentlyAdded: false } });
  return chips;
}

/** Toggles a value in a list (adds it when missing, removes it when present). */
export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
