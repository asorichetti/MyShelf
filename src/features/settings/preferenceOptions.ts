import { dateFormatLabels, dateFormats, shelfGroupings, shelfViewModes, type Appearance, type ShelfGroupBy, type ShelfSort, type ShelfViewMode } from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';

/** Sort orders offered in Settings, as `key:direction` values. Labels are catalogue keys, translated when the options are built. */
const sortChoices = [
  { value: 'title:asc', label: 'preferences.sort.titleAsc' },
  { value: 'title:desc', label: 'preferences.sort.titleDesc' },
  { value: 'author:asc', label: 'preferences.sort.authorAsc' },
  { value: 'author:desc', label: 'preferences.sort.authorDesc' },
  { value: 'year:asc', label: 'preferences.sort.yearAsc' },
  { value: 'year:desc', label: 'preferences.sort.yearDesc' },
  { value: 'added:desc', label: 'preferences.sort.addedDesc' },
  { value: 'added:asc', label: 'preferences.sort.addedAsc' },
  { value: 'rating:desc', label: 'preferences.sort.ratingDesc' },
  { value: 'rating:asc', label: 'preferences.sort.ratingAsc' },
] as const satisfies readonly { value: string; label: MessageKey }[];

/** The sort orders, with their labels in the current language. */
export const sortOptions = () => sortChoices.map((o) => ({ value: o.value, label: translate(o.label) }));

export const sortValue = (s: ShelfSort) => `${s.sort}:${s.direction}`;
export const sortLabel = (s: ShelfSort) => translate(sortChoices.find((o) => o.value === sortValue(s))?.label ?? 'preferences.sort.titleAsc');

export function parseSortValue(value: string): ShelfSort | null {
  const option = sortChoices.find((o) => o.value === value);
  if (!option) return null;
  const [sort, direction] = option.value.split(':') as [ShelfSort['sort'], ShelfSort['direction']];
  return { sort, direction };
}

const groupByKeys: Record<ShelfGroupBy, MessageKey> = {
  none: 'preferences.groupBy.none',
  genre: 'preferences.groupBy.genre',
  series: 'preferences.groupBy.series',
  author: 'preferences.groupBy.author',
  group: 'preferences.groupBy.group',
  rating: 'preferences.groupBy.rating',
};

const viewModeKeys: Record<ShelfViewMode, MessageKey> = {
  list: 'preferences.viewMode.list',
  covers: 'preferences.viewMode.covers',
  spines: 'preferences.viewMode.spines',
};

export const groupByOptions = () => shelfGroupings.map((g) => ({ value: g, label: translate(groupByKeys[g]) }));
export const viewModeOptions = () => shelfViewModes.map((m) => ({ value: m, label: translate(viewModeKeys[m]) }));
export const dateFormatOptions = () => dateFormats.map((f) => ({ value: f, label: translate(dateFormatLabels[f]) }));

/** Loan lengths offered as one tap; anything else is "Custom". */
export const LOAN_LENGTHS = [7, 14, 21, 28, 42] as const;
export const loanLengthLabel = (days: number) =>
  days % 7 === 0 ? t('preferences.loanLength.weeks', { days, count: days / 7 }) : t('preferences.loanLength.days', { count: days });
export const loanLengthOptions = () => [
  ...LOAN_LENGTHS.map((d) => ({ value: String(d), label: loanLengthLabel(d) })),
  { value: 'custom', label: t('preferences.loanLength.custom') },
];

const appearanceChoices = [
  { value: 'system', label: 'preferences.appearance.systemLabel', description: 'preferences.appearance.systemDescription' },
  { value: 'light', label: 'preferences.appearance.lightLabel', description: 'preferences.appearance.lightDescription' },
  { value: 'dark', label: 'preferences.appearance.darkLabel', description: 'preferences.appearance.darkDescription' },
] as const satisfies readonly { value: Appearance; label: MessageKey; description: MessageKey }[];

/** The Appearance choice (P09-02), in the order offered. */
export const appearanceOptions = () => appearanceChoices.map((o) => ({ value: o.value, label: translate(o.label), description: translate(o.description) }));
