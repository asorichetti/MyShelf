import { useEffect, useState } from 'react';

import { seriesRepo, useDatabase, type BookSeriesPlace } from '@/db';
import { useLibraryEvent } from '@/features/events';

/** A book's place in its series (P04-06), or null when it is in none. Reloads on `library-changed`. */
export function useBookSeries(bookId: number, seriesId: number | null, seriesPosition: number | null): BookSeriesPlace | null {
  const db = useDatabase();
  const [place, setPlace] = useState<BookSeriesPlace | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (seriesId == null) return;
    let active = true;
    seriesRepo
      .neighbours(db, bookId)
      .then((p) => active && setPlace(p))
      .catch((e) => console.warn('Could not load the book’s series', e));
    return () => {
      active = false;
    };
  }, [db, bookId, seriesId, seriesPosition, version]);
  useLibraryEvent('library-changed', () => setVersion((v) => v + 1));
  return seriesId == null ? null : place;
}
