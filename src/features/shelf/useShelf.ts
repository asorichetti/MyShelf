import { useCallback, useEffect, useRef, useState } from 'react';

import { booksRepo, settingsRepo, useDatabase } from '@/db';
import { settingDefaults, type BookListItem, type ShelfSort } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/** How long typing must pause before the Shelf searches. */
export const SEARCH_DEBOUNCE_MS = 200;

export interface ShelfState {
  /** Books matching the current search, in the current order; null until first loaded. */
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
  /** Reloads now (also happens on mount and on `library-changed`). */
  reload: () => void;
}

/**
 * The Shelf's data: the book list for the current search and sort, and the
 * catalogue size. Loads on mount (tab screens mount when focused) and again
 * whenever a write emits `library-changed`. The sort is read from and saved
 * to the `shelfSort` setting.
 */
export function useShelf(): ShelfState {
  const db = useDatabase();
  const [query, setQuery] = useState('');
  const activeQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [sort, setSortState] = useState<ShelfSort | null>(null);
  const [items, setItems] = useState<BookListItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    let active = true;
    settingsRepo
      .getSetting(db, 'shelfSort')
      .then((saved) => active && setSortState((current) => current ?? saved))
      .catch((e) => {
        console.warn('Could not read the shelf sort; using the default', e);
        if (active) setSortState((current) => current ?? settingDefaults.shelfSort);
      });
    return () => {
      active = false;
    };
  }, [db]);

  useEffect(() => {
    if (!sort) return;
    const id = ++request.current;
    Promise.all([booksRepo.listBookItems(db, { query: activeQuery, ...sort }), booksRepo.countBooks(db)])
      .then(([list, count]) => {
        // A newer request (typing, a sort change, another write) wins.
        if (id !== request.current) return;
        setItems(list);
        setTotal(count);
      })
      .catch((e) => console.error('Could not load the shelf', e));
  }, [db, activeQuery, sort, version]);

  // Stale responses are dropped by the request counter above.
  useEffect(() => () => void request.current++, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent('library-changed', reload);

  const setSort = useCallback(
    (next: ShelfSort) => {
      setSortState(next);
      settingsRepo
        .setSetting(db, 'shelfSort', next)
        .then(() => emit('settings-changed'))
        .catch((e) => console.error('Could not save the shelf sort', e));
    },
    [db],
  );

  return { items, total, query, setQuery, activeQuery, sort: sort ?? settingDefaults.shelfSort, setSort, reload };
}
