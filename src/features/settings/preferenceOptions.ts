import {
  dateFormatLabels,
  dateFormats,
  groupByLabels,
  shelfGroupings,
  shelfViewModes,
  viewModeLabels,
  type ShelfSort,
} from '@/domain';

/** Sort orders offered in Settings, as `key:direction` values. */
export const sortOptions = [
  { value: 'title:asc', label: 'Title, A to Z' },
  { value: 'title:desc', label: 'Title, Z to A' },
  { value: 'author:asc', label: 'Author, A to Z' },
  { value: 'author:desc', label: 'Author, Z to A' },
  { value: 'year:asc', label: 'Year, oldest first' },
  { value: 'year:desc', label: 'Year, newest first' },
  { value: 'added:desc', label: 'Newest additions first' },
  { value: 'added:asc', label: 'Oldest additions first' },
] as const;

export const sortValue = (s: ShelfSort) => `${s.sort}:${s.direction}`;
export const sortLabel = (s: ShelfSort) => sortOptions.find((o) => o.value === sortValue(s))?.label ?? 'Title, A to Z';

export function parseSortValue(value: string): ShelfSort | null {
  const option = sortOptions.find((o) => o.value === value);
  if (!option) return null;
  const [sort, direction] = option.value.split(':') as [ShelfSort['sort'], ShelfSort['direction']];
  return { sort, direction };
}

export const groupByOptions = shelfGroupings.map((g) => ({ value: g, label: g === 'none' ? 'No sections' : groupByLabels[g] }));
export const viewModeOptions = shelfViewModes.map((m) => ({ value: m, label: viewModeLabels[m] }));
export const dateFormatOptions = dateFormats.map((f) => ({ value: f, label: dateFormatLabels[f] }));

/** Loan lengths offered as one tap; anything else is "Custom". */
export const LOAN_LENGTHS = [7, 14, 21, 28, 42] as const;
export const loanLengthLabel = (days: number) => (days % 7 === 0 ? `${days} days (${days / 7} ${days === 7 ? 'week' : 'weeks'})` : `${days} days`);
export const loanLengthOptions = [
  ...LOAN_LENGTHS.map((d) => ({ value: String(d), label: loanLengthLabel(d) })),
  { value: 'custom', label: 'Custom…' },
];
