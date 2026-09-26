import { useCallback, useEffect, useState } from 'react';

import { seriesRepo, useDatabase } from '@/db';
import { seriesProgress, type Book, type Series, type SeriesProgress } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';

import { beginSeriesSave } from './seriesEvents';

export type SeriesState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; series: Series; books: Book[]; progress: SeriesProgress };

export interface SeriesActions {
  rename: (name: string) => Promise<void>;
  /** Sets (or with null, forgets) how many books the series has. May complete it. */
  setTotal: (total: number | null) => Promise<void>;
  /** Moves every book into `targetId` and deletes this series. */
  mergeInto: (targetId: number) => Promise<Series | null>;
  remove: () => Promise<void>;
}

/** Parses a route's `id` param; null when it is not a positive whole number. */
export function parseSeriesId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

/** One series with its books in reading order, and the edits its screen offers (P04-05). */
export function useSeries(id: number | null): SeriesState & SeriesActions {
  const db = useDatabase();
  const [state, setState] = useState<SeriesState>(id == null ? { status: 'missing' } : { status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id == null) return;
    let active = true;
    seriesRepo
      .getSeriesWithBooks(db, id)
      .then((found) => {
        if (!active) return;
        if (!found) return setState({ status: 'missing' });
        const progress = seriesProgress({ positions: found.books.map((b) => b.seriesPosition), totalCount: found.series.totalCount });
        setState({ status: 'ready', ...found, progress });
      })
      .catch((e) => {
        console.error('Could not load the series', e);
        if (active) setState({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [db, id, version]);
  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));

  const rename = useCallback(
    async (name: string) => {
      if (id == null) return;
      await seriesRepo.renameSeries(db, id, name);
      emit('library-changed');
    },
    [db, id],
  );

  const setTotal = useCallback(
    async (total: number | null) => {
      if (id == null) return;
      const probe = await beginSeriesSave(db, { seriesIds: [id] });
      await seriesRepo.setSeriesTotalCount(db, id, total);
      emit('library-changed');
      void probe.finish();
    },
    [db, id],
  );

  const mergeInto = useCallback(
    async (targetId: number) => {
      if (id == null) return null;
      const probe = await beginSeriesSave(db, { seriesIds: [targetId] });
      const target = await seriesRepo.mergeSeries(db, id, targetId);
      emit('library-changed');
      void probe.finish();
      return target;
    },
    [db, id],
  );

  const remove = useCallback(async () => {
    if (id == null) return;
    await seriesRepo.deleteSeries(db, id);
    emit('library-changed');
  }, [db, id]);

  return { ...(id == null ? { status: 'missing' as const } : state), rename, setTotal, mergeInto, remove };
}
