import { t, type MessageKey } from '@/i18n';

import { shelfSortKeys, type ShelfSort, type ShelfSortKey } from './book';
import { translatedLabels } from './shelfFilters';

/** How the Shelf is split into sections. */
export const shelfGroupings = ['none', 'genre', 'series', 'author', 'group', 'rating'] as const;
export type ShelfGroupBy = (typeof shelfGroupings)[number];

/** How each book is drawn: catalogue cards, a wall of covers, or spines on shelves. */
export const shelfViewModes = ['list', 'covers', 'spines'] as const;
export type ShelfViewMode = (typeof shelfViewModes)[number];

/** Catalogue keys naming each grouping and view mode. */
export const groupByLabelKeys: Record<ShelfGroupBy, MessageKey> = {
  none: 'shelfView.groupBy.none',
  genre: 'shelfView.groupBy.genre',
  series: 'shelfView.groupBy.series',
  author: 'shelfView.groupBy.author',
  group: 'shelfView.groupBy.group',
  rating: 'shelfView.groupBy.rating',
};
export const viewModeLabelKeys: Record<ShelfViewMode, MessageKey> = { list: 'shelfView.viewMode.list', covers: 'shelfView.viewMode.covers', spines: 'shelfView.viewMode.spines' };

/** Catalogue keys for the section holding books that belong to none of the grouping's buckets. */
export const ungroupedTitleKeys: Record<Exclude<ShelfGroupBy, 'none'>, MessageKey> = {
  genre: 'shelfView.ungrouped.genre',
  series: 'shelfView.ungrouped.series',
  author: 'shelfView.ungrouped.author',
  group: 'shelfView.ungrouped.group',
  rating: 'shelfView.ungrouped.rating',
};

/** The labels and titles themselves, translated each time they are read. */
export const groupByLabels = translatedLabels(groupByLabelKeys);
export const viewModeLabels = translatedLabels(viewModeLabelKeys);
export const ungroupedTitles = translatedLabels(ungroupedTitleKeys);

export function parseShelfGroupBy(value: unknown): ShelfGroupBy | null {
  return (shelfGroupings as readonly unknown[]).includes(value) ? (value as ShelfGroupBy) : null;
}

export function parseShelfViewMode(value: unknown): ShelfViewMode | null {
  return (shelfViewModes as readonly unknown[]).includes(value) ? (value as ShelfViewMode) : null;
}

export function parseShelfSort(value: unknown): ShelfSort | null {
  if (!value || typeof value !== 'object') return null;
  const { sort, direction } = value as Record<string, unknown>;
  if (!(shelfSortKeys as readonly unknown[]).includes(sort)) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { sort: sort as ShelfSortKey, direction };
}

/** "Fantasy · 23": a section header's text. */
export function sectionHeading(title: string, count: number): string {
  return t('shelfView.section.heading', { title, count });
}

/** "Fantasy, 23 books": what a screen reader says for a section header. */
export function sectionLabel(title: string, count: number): string {
  return t('bookList.nameAndCount', { name: title, count });
}
