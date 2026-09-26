import { useCallback, useEffect, useState } from 'react';

import { seriesRepo, useDatabase } from '@/db';
import { isValidSeriesPosition, parseSeriesPosition } from '@/domain';
import { emit, useLibraryEvent } from '@/features/events';
import { beginSeriesSave } from '@/features/series/seriesEvents';
import { addToIdList, idListHas, removeFromIdList } from '@/features/series/seriesSettings';

export interface SeriesConfirmState {
  /** Whether to ask "Is this Discworld #5?" for this book. */
  asking: boolean;
  busy: boolean;
  /** Keeps the link and stops asking. */
  yes: () => Promise<void>;
  /** "Not a series": unlinks the book and never suggests a series for it again. */
  no: () => Promise<void>;
  /**
   * Links the book to another series (or position) instead. Returns an error
   * message for the form, or null once saved.
   */
  change: (name: string, positionText: string) => Promise<{ field: 'name' | 'position'; message: string } | null>;
}

/**
 * The confirmation for a series the metadata guessed with less than high
 * confidence (P04-03). `applyDetectedSeries` queues the book; this reads the
 * queue for one book and answers it.
 */
export function useSeriesConfirm(bookId: number, seriesId: number | null): SeriesConfirmState {
  const db = useDatabase();
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    idListHas(db, 'series.pendingConfirmBookIds', bookId)
      .then((has) => active && setPending(has))
      .catch(() => active && setPending(false));
    return () => {
      active = false;
    };
  }, [db, bookId, version]);
  useLibraryEvent(['library-changed', 'settings-changed'], () => setVersion((v) => v + 1));

  const run = useCallback(
    async <T>(work: () => Promise<T>): Promise<T> => {
      setBusy(true);
      try {
        return await work();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const yes = useCallback(
    () =>
      run(async () => {
        await removeFromIdList(db, 'series.pendingConfirmBookIds', bookId);
        setPending(false);
      }),
    [db, bookId, run],
  );

  const no = useCallback(
    () =>
      run(async () => {
        await seriesRepo.setBookSeries(db, bookId, null);
        await addToIdList(db, 'series.dismissedBookIds', bookId);
        await removeFromIdList(db, 'series.pendingConfirmBookIds', bookId);
        setPending(false);
        emit('library-changed');
      }),
    [db, bookId, run],
  );

  const change = useCallback<SeriesConfirmState['change']>(
    (name, positionText) =>
      run(async () => {
        const clean = name.trim();
        if (!clean) return { field: 'name' as const, message: 'Type the series name, or choose “Not a series”.' };
        let position: number | null = null;
        if (positionText.trim()) {
          position = parseSeriesPosition(positionText);
          if (!isValidSeriesPosition(position)) return { field: 'position' as const, message: 'Use a number like 3, or 2.5 for a novella between books.' };
        }
        const probe = await beginSeriesSave(db, { bookId, seriesNames: [clean] });
        const series = await seriesRepo.findOrCreateSeries(db, clean);
        await seriesRepo.setBookSeries(db, bookId, series.id, position);
        await removeFromIdList(db, 'series.pendingConfirmBookIds', bookId);
        setPending(false);
        emit('library-changed');
        void probe.finish(bookId);
        return null;
      }),
    [db, bookId, run],
  );

  return { asking: pending && seriesId != null, busy, yes, no, change };
}
