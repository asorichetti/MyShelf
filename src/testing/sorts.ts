import type { ShelfSort, SortDirection, SortKeyId, SortLevel } from '@/domain';

/** A one-level sort, for tests: `oneKey('year', 'desc')`. */
export function oneKey(key: SortKeyId, direction: SortDirection = 'asc'): ShelfSort {
  return { levels: [{ key, direction }] };
}

/** A sort from `['genre', 'asc'], ['author', 'desc']` pairs, for tests. */
export function levels(...pairs: [SortKeyId, SortDirection?][]): SortLevel[] {
  return pairs.map(([key, direction = 'asc']) => ({ key, direction }));
}
