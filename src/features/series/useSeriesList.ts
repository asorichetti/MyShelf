import { useEffect, useState } from 'react';

import { seriesRepo, useDatabase, type SeriesSort, type SeriesSummary } from '@/db';
import { useLibraryEvent } from '@/features/events';

export interface SeriesListState {
  status: 'loading' | 'ready' | 'error';
  series: SeriesSummary[];
  sort: SeriesSort;
  setSort: (sort: SeriesSort) => void;
}

/** The series list (P04-04): every series with its progress, A-Z or most recently added to first. */
export function useSeriesList(): SeriesListState {
  const db = useDatabase();
  const [sort, setSort] = useState<SeriesSort>('name');
  const [state, setState] = useState<Omit<SeriesListState, 'sort' | 'setSort'>>({ status: 'loading', series: [] });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    seriesRepo
      .listSeriesWithStats(db, { sort })
      .then((series) => active && setState({ status: 'ready', series }))
      .catch((e) => {
        console.error('Could not list the series', e);
        if (active) setState((s) => ({ ...s, status: 'error' }));
      });
    return () => {
      active = false;
    };
  }, [db, sort, version]);
  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));
  return { ...state, sort, setSort };
}
