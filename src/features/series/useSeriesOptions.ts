import { useEffect, useState } from 'react';

import { seriesRepo, useDatabase, type SeriesSummary } from '@/db';
import { useLibraryEvent } from '@/features/events';

/** Every series in the library with its counts (A-Z), for the series picker. Reloads on `library-changed`. */
export function useSeriesOptions(): SeriesSummary[] {
  const db = useDatabase();
  const [series, setSeries] = useState<SeriesSummary[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    seriesRepo
      .listSeriesWithStats(db)
      .then((list) => active && setSeries(list))
      .catch((e) => console.warn('Could not list the series', e));
    return () => {
      active = false;
    };
  }, [db, version]);
  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));
  return series;
}
