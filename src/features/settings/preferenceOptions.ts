import { sortKeyRegistry } from '@/db/sortKeys';
import {
  applyPreset,
  dateFormatLabels,
  dateFormats,
  defaultShelfSort,
  describeSort,
  parseSavedPresets,
  parseShelfSort,
  presetName,
  sameLevels,
  shelfGroupings,
  shelfViewModes,
  sortPresets,
  type Appearance,
  type SavedSortPreset,
  type ShelfGroupBy,
  type ShelfSort,
  type ShelfViewMode,
  type SortLevel,
} from '@/domain';
import { t, translate, type MessageKey } from '@/i18n';

/**
 * Single-key orders the Preferences screen offered before Phase 11 (and Phase 10's rating), kept
 * beside the presets so everyone's old choice is still one of the options.
 * ("Title, A to Z" and "Newest additions first" are now the presets "A–Z by
 * title" and "Newest additions".) Labels are catalogue keys.
 */
const singleKeyChoices: { level: SortLevel; label: MessageKey }[] = [
  { level: { key: 'title', direction: 'desc' }, label: 'preferences.sort.titleDesc' },
  { level: { key: 'author', direction: 'asc' }, label: 'preferences.sort.authorAsc' },
  { level: { key: 'author', direction: 'desc' }, label: 'preferences.sort.authorDesc' },
  { level: { key: 'year', direction: 'asc' }, label: 'preferences.sort.yearAsc' },
  { level: { key: 'year', direction: 'desc' }, label: 'preferences.sort.yearDesc' },
  { level: { key: 'added', direction: 'asc' }, label: 'preferences.sort.addedAsc' },
  { level: { key: 'rating', direction: 'desc' }, label: 'preferences.sort.ratingDesc' },
  { level: { key: 'rating', direction: 'asc' }, label: 'preferences.sort.ratingAsc' },
];

/** The stored sort, read the way the Shelf reads it (old single-key values included). */
export const storedSort = (value: unknown): ShelfSort => parseShelfSort(value) ?? defaultShelfSort;
export const storedPresets = (value: unknown): SavedSortPreset[] => parseSavedPresets(value);

/**
 * The orders offered in Settings (P08-07, P11-04): the built-in presets, the
 * user's saved ones, the old single-key orders and, when the Shelf's current
 * sort is none of those, that sort as "Custom". Values are
 * `preset:<id>`, `saved:<id>`, `level:<key>:<direction>` and `custom`.
 */
export function sortOptions(sort: ShelfSort, saved: readonly SavedSortPreset[]) {
  const options = [
    ...sortPresets.map((p) => ({ value: `preset:${p.id}`, label: presetName(p) })),
    ...saved.map((p) => ({ value: `saved:${p.id}`, label: p.name })),
    ...singleKeyChoices.map((c) => ({ value: `level:${c.level.key}:${c.level.direction}`, label: translate(c.label) })),
  ];
  if (sortValue(sort, saved) === 'custom') options.push({ value: 'custom', label: t('preferences.sort.custom', { summary: describeSort(sort.levels, sortKeyRegistry) }) });
  return options;
}

export function sortValue(sort: ShelfSort, saved: readonly SavedSortPreset[] = []): string {
  const preset = sortPresets.find((p) => sameLevels(p.levels, sort.levels));
  if (preset) return `preset:${preset.id}`;
  const own = saved.find((p) => sameLevels(p.levels, sort.levels));
  if (own) return `saved:${own.id}`;
  const single = singleKeyChoices.find((c) => sameLevels([c.level], sort.levels));
  if (single) return `level:${single.level.key}:${single.level.direction}`;
  return 'custom';
}

export function sortLabel(sort: ShelfSort, saved: readonly SavedSortPreset[] = []): string {
  const value = sortValue(sort, saved);
  return sortOptions(sort, saved).find((o) => o.value === value)?.label ?? describeSort(sort.levels, sortKeyRegistry);
}

/** The sort a Settings choice stands for; null for "custom" (nothing to change) or an unknown value. */
export function parseSortValue(value: string, saved: readonly SavedSortPreset[] = []): ShelfSort | null {
  const [kind, id, direction] = value.split(':');
  if (kind === 'preset') {
    const preset = sortPresets.find((p) => p.id === id);
    return preset ? applyPreset(preset.levels) : null;
  }
  if (kind === 'saved') {
    const own = saved.find((p) => p.id === id);
    return own ? applyPreset(own.levels) : null;
  }
  if (kind === 'level') {
    const single = singleKeyChoices.find((c) => c.level.key === id && c.level.direction === direction);
    return single ? { levels: [{ ...single.level }] } : null;
  }
  return null;
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
