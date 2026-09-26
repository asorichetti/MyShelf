import { useCallback, useEffect, useRef, useState } from 'react';

import { settingsRepo, useDatabase, type Db } from '@/db';
import {
  parseShelfFilters,
  parseShelfGroupBy,
  parseShelfSort,
  parseShelfViewMode,
  settingDefaults,
  type ShelfFilters,
  type ShelfGroupBy,
  type ShelfSort,
  type ShelfViewMode,
} from '@/domain';
import { emit } from '@/features/events';

/** How long a preference must stay put before it is written. */
export const PREFS_DEBOUNCE_MS = 300;

export interface ShelfPrefs {
  sort: ShelfSort;
  groupBy: ShelfGroupBy;
  viewMode: ShelfViewMode;
  filters: ShelfFilters;
}

type PrefKey = keyof ShelfPrefs;

const settingKeys = { sort: 'shelfSort', groupBy: 'shelfGroupBy', viewMode: 'shelfViewMode', filters: 'shelfFilters' } as const;

export const defaultShelfPrefs: ShelfPrefs = {
  sort: settingDefaults.shelfSort,
  groupBy: settingDefaults.shelfGroupBy,
  viewMode: settingDefaults.shelfViewMode,
  filters: settingDefaults.shelfFilters,
};

/** Reads the Shelf's preferences; anything unreadable or invalid falls back to its default. */
export async function loadShelfPrefs(db: Db): Promise<ShelfPrefs> {
  const [sort, groupBy, viewMode, filters] = await Promise.all([
    settingsRepo.getSetting(db, 'shelfSort'),
    settingsRepo.getSetting(db, 'shelfGroupBy'),
    settingsRepo.getSetting(db, 'shelfViewMode'),
    settingsRepo.getSetting(db, 'shelfFilters'),
  ]);
  return {
    sort: parseShelfSort(sort) ?? defaultShelfPrefs.sort,
    groupBy: parseShelfGroupBy(groupBy) ?? defaultShelfPrefs.groupBy,
    viewMode: parseShelfViewMode(viewMode) ?? defaultShelfPrefs.viewMode,
    filters: parseShelfFilters(filters),
  };
}

export interface ShelfPrefsState {
  /** Null until read from settings. */
  prefs: ShelfPrefs | null;
  setSort: (sort: ShelfSort) => void;
  setGroupBy: (groupBy: ShelfGroupBy) => void;
  setViewMode: (mode: ShelfViewMode) => void;
  setFilters: (filters: ShelfFilters) => void;
}

/**
 * The Shelf's sort, grouping, display mode and filters, read from settings on
 * load and written back on change: each key a short pause after its last
 * change (so tapping through filters writes once), and at once when the Shelf
 * goes away with a write still pending.
 */
export function useShelfPrefs(): ShelfPrefsState {
  const db = useDatabase();
  const [prefs, setPrefs] = useState<ShelfPrefs | null>(null);
  const pending = useRef(new Map<PrefKey, { value: ShelfPrefs[PrefKey]; timer: ReturnType<typeof setTimeout> }>());

  useEffect(() => {
    let active = true;
    loadShelfPrefs(db)
      .then((loaded) => active && setPrefs((current) => current ?? loaded))
      .catch((e) => {
        console.warn('Could not read the shelf preferences; using the defaults', e);
        if (active) setPrefs((current) => current ?? defaultShelfPrefs);
      });
    return () => {
      active = false;
    };
  }, [db]);

  const write = useCallback(
    <K extends PrefKey>(key: K, value: ShelfPrefs[K]) => {
      pending.current.delete(key);
      settingsRepo
        .setSetting(db, settingKeys[key], value as never)
        .then(() => emit('settings-changed'))
        .catch((e) => console.error(`Could not save the shelf's ${key}`, e));
    },
    [db],
  );

  // Flush whatever is still waiting when the Shelf unmounts.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const [key, { value, timer }] of waiting) {
        clearTimeout(timer);
        write(key, value);
      }
    };
  }, [write]);

  const update = useCallback(
    <K extends PrefKey>(key: K, value: ShelfPrefs[K]) => {
      setPrefs((current) => ({ ...(current ?? defaultShelfPrefs), [key]: value }));
      const previous = pending.current.get(key);
      if (previous) clearTimeout(previous.timer);
      pending.current.set(key, { value, timer: setTimeout(() => write(key, value), PREFS_DEBOUNCE_MS) });
    },
    [write],
  );

  return {
    prefs,
    setSort: useCallback((v: ShelfSort) => update('sort', v), [update]),
    setGroupBy: useCallback((v: ShelfGroupBy) => update('groupBy', v), [update]),
    setViewMode: useCallback((v: ShelfViewMode) => update('viewMode', v), [update]),
    setFilters: useCallback((v: ShelfFilters) => update('filters', v), [update]),
  };
}
