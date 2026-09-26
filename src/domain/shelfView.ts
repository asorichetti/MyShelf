import { shelfSortKeys, type ShelfSort, type ShelfSortKey } from './book';

/** How the Shelf is split into sections. */
export const shelfGroupings = ['none', 'genre', 'series', 'author', 'group'] as const;
export type ShelfGroupBy = (typeof shelfGroupings)[number];

/** How each book is drawn: catalogue cards, a wall of covers, or spines on shelves. */
export const shelfViewModes = ['list', 'covers', 'spines'] as const;
export type ShelfViewMode = (typeof shelfViewModes)[number];

export const groupByLabels: Record<ShelfGroupBy, string> = {
  none: 'None',
  genre: 'Genre',
  series: 'Series',
  author: 'Author',
  group: 'My groups',
};

export const viewModeLabels: Record<ShelfViewMode, string> = { list: 'List', covers: 'Covers', spines: 'Spines' };

/** Title of the section holding books that belong to none of the grouping's buckets. */
export const ungroupedTitles: Record<Exclude<ShelfGroupBy, 'none'>, string> = {
  genre: 'No genre',
  series: 'Not in a series',
  author: 'No author',
  group: 'Not in a group',
};

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
  return `${title} · ${count}`;
}

/** "Fantasy, 23 books": what a screen reader says for a section header. */
export function sectionLabel(title: string, count: number): string {
  return `${title}, ${count === 1 ? '1 book' : `${count} books`}`;
}
