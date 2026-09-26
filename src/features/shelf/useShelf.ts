import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { booksRepo, shelfSectionsRepo, useDatabase, type FilterOptions, type ShelfSection } from '@/db';
import { type BookListItem, type ShelfFilters, type ShelfGroupBy, type ShelfSort, type ShelfViewMode } from '@/domain';
import { useLibraryEvent } from '@/features/events';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import { recordTiming, SHELF_QUERY_MEASURE, timingStart } from './timing';
import { defaultShelfPrefs, useShelfPrefs } from './useShelfPrefs';

/** How long typing must pause before the Shelf searches. */
export const SEARCH_DEBOUNCE_MS = 200;

export interface ShelfState {
  /** The books shown, grouped into sections (one untitled section when not grouped); null until loaded. */
  sections: ShelfSection[] | null;
  /** Books matching the search and filters, each once, in shelf order; null until first loaded. */
  items: BookListItem[] | null;
  /** Books in the whole catalogue; null until first loaded. */
  total: number | null;
  /** The search box text (the list follows it after a short pause). */
  query: string;
  setQuery: (query: string) => void;
  /** The search the list currently reflects. */
  activeQuery: string;
  sort: ShelfSort;
  /** Changes the order and remembers it in settings. */
  setSort: (sort: ShelfSort) => void;
  groupBy: ShelfGroupBy;
  setGroupBy: (groupBy: ShelfGroupBy) => void;
  viewMode: ShelfViewMode;
  setViewMode: (mode: ShelfViewMode) => void;
  filters: ShelfFilters;
  setFilters: (filters: ShelfFilters) => void;
  /** What the filter sheet can offer (genres with counts, formats, languages, years). */
  filterOptions: FilterOptions | null;
  /** Reloads now (also happens on mount and when the library, groups or loans change). */
  reload: () => void;
}

/**
 * The Shelf's data: the books for the current search, filters and sort, split
 * into sections by the current grouping, plus the catalogue size and the
 * filter sheet's options. Loads on mount (tab screens mount when focused) and
 * again whenever a write emits `library-changed`, `groups-changed` or
 * `loans-changed`. Sort, grouping, display mode and filters are remembered in
 * settings (`useShelfPrefs`).
 */
export function useShelf(): ShelfState {
  const db = useDatabase();
  const { prefs, setSort, setGroupBy, setViewMode, setFilters } = useShelfPrefs();
  const [query, setQuery] = useState('');
  const activeQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [sections, setSections] = useState<ShelfSection[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef(0);
  /** The newest request whose answer is on screen. */
  const applied = useRef(0);
  /** What the newest request asked for (search, sort, grouping, filters); null once unmounted. */
  const asked = useRef<string | null>('');
  const sort = prefs?.sort;
  const groupBy = prefs?.groupBy;
  const filters = prefs?.filters;

  useEffect(() => {
    if (!sort || !groupBy || !filters) return;
    const id = ++request.current;
    const key = JSON.stringify([activeQuery, sort, groupBy, filters]);
    asked.current = key;
    const started = timingStart();
    Promise.all([shelfSectionsRepo.listShelfSections(db, { groupBy, query: activeQuery, filters, ...sort }), booksRepo.countBooks(db)])
      .then(([result, count]) => {
        // An answer for an older search, sort or filter is dropped. For the same one, any answer newer than
        // the one shown is shown: while writes keep coming (covers arriving after an import), each reload
        // still reaches the screen instead of being overtaken by the next.
        if (key !== asked.current || id < applied.current) return;
        applied.current = id;
        recordTiming(SHELF_QUERY_MEASURE, started, { query: activeQuery, count: result.count });
        setSections(result.sections);
        setTotal(count);
      })
      .catch((e) => console.error('Could not load the shelf', e));
  }, [db, activeQuery, sort, groupBy, filters, version]);

  useEffect(() => {
    let active = true;
    booksRepo
      .listFilterOptions(db)
      .then((options) => active && setFilterOptions(options))
      .catch((e) => console.error('Could not load the filter options', e));
    return () => {
      active = false;
    };
  }, [db, version]);

  // Answers arriving after unmount are dropped.
  useEffect(
    () => () => {
      asked.current = null;
    },
    [],
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['library-changed', 'groups-changed', 'loans-changed'], reload);

  const items = useMemo(() => {
    if (!sections) return null;
    if (sections.length <= 1) return sections[0]?.items ?? [];
    const seen = new Set<number>();
    const out: BookListItem[] = [];
    for (const s of sections) {
      for (const item of s.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [sections]);

  const current = prefs ?? defaultShelfPrefs;
  return {
    sections,
    items,
    total,
    query,
    setQuery,
    activeQuery,
    sort: current.sort,
    setSort,
    groupBy: current.groupBy,
    setGroupBy,
    viewMode: current.viewMode,
    setViewMode,
    filters: current.filters,
    setFilters,
    filterOptions,
    reload,
  };
}
