import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { bookLanguagePreference, type BookFormat } from '@/domain';
import { useMetadataService } from '@/features/lookup/metadataService';
import { isAbortError } from '@/services/http';
import type { BookCandidate, MetadataService } from '@/services/metadata';

import { editionMatches, enrichEdition, groupByWork, orderEditionPages, type WorkGroup } from './editionChoice';

import type { ScanSession } from './sessionStore';

export { enrichEdition, groupByWork, type WorkGroup } from './editionChoice';

export type EditionsLoad =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'ready';
      /** Every edition loaded so far, page after page. */
      editions: BookCandidate[];
      /** The pages as they came (`EDITIONS_PAGE` at a time). */
      pages: BookCandidate[][];
      /** Editions loaded. */
      loaded: number;
      /** Editions Open Library has for the work, when known. */
      total: number | null;
      /** Where the next page starts; null when all are loaded. */
      nextOffset: number | null;
      /** "Show more editions": the next page's state. */
      more: 'idle' | 'loading' | 'error';
    }
  | { status: 'error' };

export interface EditionFilters {
  format: BookFormat | null;
  language: string | null;
  /** Year, publisher or ISBN typed to find an edition among those loaded (`editionMatches`). */
  text: string;
}

export interface EditionPicker {
  /** One candidate from an ISBN: shown on its own, already selected. */
  single: BookCandidate | null;
  groups: WorkGroup[];
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
  loads: Readonly<Record<string, EditionsLoad>>;
  /**
   * A group's editions after the filters, de-duplicated by ISBN, likeliest
   * first: in the language read on the cover (else the app's), closest to
   * the title read, with a cover, fullest record (`orderEditions`).
   */
  editionsOf: (key: string) => BookCandidate[];
  filters: EditionFilters;
  setFilters: (f: Partial<EditionFilters>) => void;
  /** Whether a work has editions not loaded yet. */
  hasMore: (key: string) => boolean;
  /** Loads a work's next page of editions ("Show more editions"). */
  loadMore: (key: string) => void;
  /** Formats and languages present among the editions loaded so far; the preferred language first. */
  available: { formats: BookFormat[]; languages: string[] };
  selected: BookCandidate | null;
  select: (candidate: BookCandidate) => void;
  /** The selected edition, with what its work knows filled in (subjects, series hints, summary, fallback covers). */
  chosen: () => BookCandidate | null;
}

/**
 * The edition picker's state (P03-08): works from a cover search, each
 * expanding to its editions (loaded from Open Library on demand), filters by
 * format and language, and one selection. A single ISBN result skips the
 * grouping and starts selected.
 */
export function useEditionPicker(session: ScanSession | null, { service: injected }: { service?: MetadataService } = {}): EditionPicker {
  const appService = useMetadataService();
  const service = injected ?? appService;
  const candidates = useMemo(() => session?.candidates ?? [], [session]);
  // The cover's language, else the app's: editions in it come first.
  const language = useMemo(() => session?.language ?? bookLanguagePreference(null), [session]);
  const wantedTitle = session?.guess?.title ?? null;
  const single = session && session.source !== 'cover' && candidates.length === 1 ? candidates[0] : null;
  const groups = useMemo(() => (single ? [] : groupByWork(candidates)), [candidates, single]);
  // One work: open it straight away.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(groups.length === 1 ? [groups[0].key] : []));
  const [fetched, setFetched] = useState<Record<string, EditionsLoad>>({});
  const [filters, setFilterState] = useState<EditionFilters>({ format: null, language: null, text: '' });
  const [selected, setSelected] = useState<BookCandidate | null>(single);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const all = controllers.current;
    return () => all.forEach((c) => c.abort());
  }, []);
  // What is loaded now, for `loadMore` (state lags a render).
  const fetchedNow = useRef(fetched);
  useEffect(() => {
    fetchedNow.current = fetched;
  }, [fetched]);

  /** Open Library works list their editions; anything else has only the editions that came with it. */
  const loadable = useCallback((g: WorkGroup) => Boolean(g.work.workKey && g.work.source === 'openlibrary'), []);

  // Load the editions of every opened work, once.
  useEffect(() => {
    for (const group of groups) {
      if (!expanded.has(group.key) || !loadable(group) || controllers.current.has(group.key)) continue;
      const abort = new AbortController();
      controllers.current.set(group.key, abort);
      service
        .editionsPage(group.work.workKey!, { signal: abort.signal, authors: group.work.authors })
        .then(
          (page) =>
            !abort.signal.aborted &&
            setFetched((l) => ({
              ...l,
              [group.key]: { status: 'ready', editions: page.editions, pages: [page.editions], loaded: page.editions.length, total: page.total, nextOffset: page.nextOffset, more: 'idle' },
            })),
        )
        .catch((error) => {
          if (!abort.signal.aborted && !isAbortError(error)) setFetched((l) => ({ ...l, [group.key]: { status: 'error' } }));
        });
    }
  }, [expanded, groups, loadable, service]);

  const loadMore = useCallback(
    (key: string) => {
      const group = groups.find((g) => g.key === key);
      const load = fetchedNow.current[key];
      const abort = controllers.current.get(key);
      if (!group || !abort || load?.status !== 'ready' || load.nextOffset == null || load.more === 'loading') return;
      const offset = load.nextOffset;
      const update = (change: (current: Extract<EditionsLoad, { status: 'ready' }>) => EditionsLoad) =>
        setFetched((l) => {
          const current = l[key];
          const next = current?.status === 'ready' ? { ...l, [key]: change(current) } : l;
          fetchedNow.current = next;
          return next;
        });
      update((current) => ({ ...current, more: 'loading' }));
      fetchedNow.current = { ...fetchedNow.current, [key]: { ...load, more: 'loading' } };
      service
        .editionsPage(group.work.workKey!, { signal: abort.signal, authors: group.work.authors, offset })
        .then((page) => {
          if (abort.signal.aborted) return;
          update((current) => {
            const pages = [...current.pages, page.editions];
            return { ...current, pages, editions: pages.flat(), loaded: current.loaded + page.editions.length, total: page.total, nextOffset: page.nextOffset, more: 'idle' };
          });
        })
        .catch((error) => {
          if (!abort.signal.aborted && !isAbortError(error)) update((current) => ({ ...current, more: 'error' }));
        });
    },
    [groups, service],
  );

  const hasMore = useCallback((key: string) => {
    const load = fetched[key];
    return load?.status === 'ready' && load.nextOffset != null;
  }, [fetched]);

  const loads = useMemo(() => {
    const out: Record<string, EditionsLoad> = {};
    for (const g of groups) {
      out[g.key] = !loadable(g)
        ? { status: 'ready', editions: [], pages: [], loaded: 0, total: 0, nextOffset: null, more: 'idle' }
        : (fetched[g.key] ?? (expanded.has(g.key) ? { status: 'loading' } : { status: 'idle' }));
    }
    return out;
  }, [groups, loadable, fetched, expanded]);

  const toggle = useCallback((key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allEditionsOf = useCallback(
    (key: string) => {
      const group = groups.find((g) => g.key === key);
      if (!group) return [];
      const load = loads[key];
      const pages = load?.status === 'ready' ? load.pages : [];
      const list = orderEditionPages(group, pages, { language, title: wantedTitle });
      // A work with no editions to show can be chosen itself.
      return list.length || load?.status === 'loading' || load?.status === 'idle' ? list : [group.work];
    },
    [groups, loads, language, wantedTitle],
  );

  const editionsOf = useCallback(
    (key: string) =>
      allEditionsOf(key).filter(
        (c) =>
          (!filters.format || c.format === filters.format) && (!filters.language || c.language === filters.language) && editionMatches(c, filters.text),
      ),
    [allEditionsOf, filters],
  );

  const available = useMemo(() => {
    const all = groups.flatMap((g) => (expanded.has(g.key) ? allEditionsOf(g.key) : []));
    const preferred = language.code;
    const languages = [...new Set(all.map((c) => c.language).filter((l): l is string => Boolean(l)))];
    return {
      formats: [...new Set(all.map((c) => c.format).filter((f): f is BookFormat => Boolean(f)))],
      languages: preferred && languages.includes(preferred) ? [preferred, ...languages.filter((l) => l !== preferred)] : languages,
    };
  }, [groups, expanded, allEditionsOf, language]);

  const chosen = useCallback(() => {
    if (!selected) return null;
    if (single) return selected;
    const group = groups.find((g) => g.work === selected || allEditionsOf(g.key).includes(selected)) ?? null;
    return enrichEdition(selected, group, group ? allEditionsOf(group.key) : []);
  }, [selected, single, groups, allEditionsOf]);

  return {
    single,
    groups,
    expanded,
    toggle,
    loads,
    editionsOf,
    filters,
    setFilters: (f) => setFilterState((current) => ({ ...current, ...f })),
    hasMore,
    loadMore,
    available,
    selected,
    select: setSelected,
    chosen,
  };
}
