import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { bookMatchKey, type BookFormat } from '@/domain';
import { useMetadataService } from '@/features/lookup/metadataService';
import { isAbortError } from '@/services/http';
import type { BookCandidate, MetadataService } from '@/services/metadata';

import type { ScanSession } from './sessionStore';

/** One work in the picker: the search result (or first volume) and the editions known for it. */
export interface WorkGroup {
  key: string;
  /** What the group header shows: the work (a search result) or its first volume. */
  work: BookCandidate;
  /** Editions that came with the results (Google Books volumes, ISBN hits). */
  members: BookCandidate[];
}

export type EditionsLoad = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; editions: BookCandidate[] } | { status: 'error' };

export interface EditionFilters {
  format: BookFormat | null;
  language: string | null;
}

export interface EditionPicker {
  /** One candidate from an ISBN: shown on its own, already selected. */
  single: BookCandidate | null;
  groups: WorkGroup[];
  expanded: ReadonlySet<string>;
  toggle: (key: string) => void;
  loads: Readonly<Record<string, EditionsLoad>>;
  /** A group's editions after the filters, members first, de-duplicated by ISBN. */
  editionsOf: (key: string) => BookCandidate[];
  filters: EditionFilters;
  setFilters: (f: Partial<EditionFilters>) => void;
  /** Formats and languages present among the editions loaded so far. */
  available: { formats: BookFormat[]; languages: string[] };
  selected: BookCandidate | null;
  select: (candidate: BookCandidate) => void;
  /** The selected edition, with what its work knows filled in (subjects, series hints, summary). */
  chosen: () => BookCandidate | null;
}

const groupKey = (c: BookCandidate) => c.workKey ?? `t:${bookMatchKey(c.title, c.authors[0])}`;
const titleKey = (c: BookCandidate) => bookMatchKey(c.title, c.authors[0]);

/**
 * Groups search results by work: Open Library works by their key, and any
 * other result (a Google Books volume) with the work of the same title and
 * first author, else on its own. Order follows the ranking.
 */
export function groupByWork(candidates: readonly BookCandidate[]): WorkGroup[] {
  const groups: WorkGroup[] = [];
  for (const c of candidates) {
    const sameWork = (g: WorkGroup) => !g.work.workKey || !c.workKey || g.work.workKey === c.workKey;
    const existing = groups.find((g) => g.key === groupKey(c)) ?? groups.find((g) => titleKey(g.work) === titleKey(c) && sameWork(g));
    if (existing) {
      if (c.kind === 'edition') existing.members.push(c);
      else if (existing.work.kind === 'edition') {
        // A work outranks its volume as the header, and its key lists the editions.
        existing.work = c;
        existing.key = groupKey(c);
      }
      continue;
    }
    groups.push({ key: groupKey(c), work: c, members: c.kind === 'edition' ? [c] : [] });
  }
  return groups;
}

/** An edition picked from a work, with the work's subjects, series hints, summary and key where it has none. */
export function enrichEdition(edition: BookCandidate, group: WorkGroup | null): BookCandidate {
  if (!group) return edition;
  const others = [group.work, ...group.members].filter((c) => c !== edition);
  const subjects = edition.subjects.length ? edition.subjects : [...new Set(others.flatMap((c) => c.subjects))];
  const hints = [...edition.seriesHints, ...others.flatMap((c) => c.seriesHints)];
  return {
    ...edition,
    subjects,
    seriesHints: hints.filter((h, i) => hints.findIndex((x) => x.name === h.name && x.position === h.position) === i),
    summary: edition.summary ?? others.find((c) => c.summary)?.summary ?? null,
    workKey: edition.workKey ?? group.work.workKey,
    authors: edition.authors.length ? edition.authors : group.work.authors,
  };
}

function dedupe(list: BookCandidate[]): BookCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = c.isbn13 ?? c.isbn10 ?? `${c.source}:${c.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const single = session && session.source !== 'cover' && candidates.length === 1 ? candidates[0] : null;
  const groups = useMemo(() => (single ? [] : groupByWork(candidates)), [candidates, single]);
  // One work: open it straight away.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(groups.length === 1 ? [groups[0].key] : []));
  const [fetched, setFetched] = useState<Record<string, EditionsLoad>>({});
  const [filters, setFilterState] = useState<EditionFilters>({ format: null, language: null });
  const [selected, setSelected] = useState<BookCandidate | null>(single);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const all = controllers.current;
    return () => all.forEach((c) => c.abort());
  }, []);

  /** Open Library works list their editions; anything else has only the editions that came with it. */
  const loadable = useCallback((g: WorkGroup) => Boolean(g.work.workKey && g.work.source === 'openlibrary'), []);

  // Load the editions of every opened work, once.
  useEffect(() => {
    for (const group of groups) {
      if (!expanded.has(group.key) || !loadable(group) || controllers.current.has(group.key)) continue;
      const abort = new AbortController();
      controllers.current.set(group.key, abort);
      service
        .editions(group.work.workKey!, { signal: abort.signal, authors: group.work.authors })
        .then((editions) => !abort.signal.aborted && setFetched((l) => ({ ...l, [group.key]: { status: 'ready', editions } })))
        .catch((error) => {
          if (!abort.signal.aborted && !isAbortError(error)) setFetched((l) => ({ ...l, [group.key]: { status: 'error' } }));
        });
    }
  }, [expanded, groups, loadable, service]);

  const loads = useMemo(() => {
    const out: Record<string, EditionsLoad> = {};
    for (const g of groups) {
      out[g.key] = !loadable(g)
        ? { status: 'ready', editions: [] }
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
      const loaded = load?.status === 'ready' ? load.editions : [];
      const list = dedupe([...group.members, ...loaded]);
      // A work with no editions to show can be chosen itself.
      return list.length || load?.status === 'loading' || load?.status === 'idle' ? list : [group.work];
    },
    [groups, loads],
  );

  const editionsOf = useCallback(
    (key: string) =>
      allEditionsOf(key).filter(
        (c) => (!filters.format || c.format === filters.format) && (!filters.language || c.language === filters.language),
      ),
    [allEditionsOf, filters],
  );

  const available = useMemo(() => {
    const all = groups.flatMap((g) => (expanded.has(g.key) ? allEditionsOf(g.key) : []));
    return {
      formats: [...new Set(all.map((c) => c.format).filter((f): f is BookFormat => Boolean(f)))],
      languages: [...new Set(all.map((c) => c.language).filter((l): l is string => Boolean(l)))],
    };
  }, [groups, expanded, allEditionsOf]);

  const chosen = useCallback(() => {
    if (!selected) return null;
    if (single) return selected;
    const group = groups.find((g) => g.work === selected || allEditionsOf(g.key).includes(selected)) ?? null;
    return enrichEdition(selected, group);
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
    available,
    selected,
    select: setSelected,
    chosen,
  };
}
