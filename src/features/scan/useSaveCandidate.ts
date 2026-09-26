import { useCallback } from 'react';

import { useBooky } from '@/components/booky';
import { booksRepo, useDatabase, type Db } from '@/db';
import { candidateSeries } from '@/domain';
import { attachCoverFromCandidate, type AttachCoverResult } from '@/features/covers';
import { emit } from '@/features/events';
import { applyDetectedSeries } from '@/features/series/detectedSeries';
import { beginSeriesSave } from '@/features/series/seriesEvents';
import type { BookCandidate } from '@/services/metadata';

export interface SaveCandidateOptions {
  /**
   * Called when the cover chain finds no online cover for the saved book
   * (P03-14: offer the cover photo taken for recognition). Not called when
   * a cover was found, or offline.
   */
  onNoOnlineCover?: (bookId: number) => void;
  /** Skip Booky's "Shelved!" (batch saves announce once). */
  quiet?: boolean;
}

export interface SavedCandidate {
  id: number;
  title: string;
  /** Books on the shelf after the save. */
  count: number;
  /** Resolves when the cover chain is done (never rejects). */
  cover: Promise<AttachCoverResult | null>;
}

/**
 * Saves one candidate: the book in one transaction, then its series guess
 * (`applyDetectedSeries`, which asks "Is this Discworld #5?" for a weaker
 * guess) with the series milestones, then — in the background — its best real
 * cover. A cover that cannot be found or fetched leaves the book saved with
 * its generated cover.
 */
export async function saveCandidate(db: Db, candidate: BookCandidate, { onNoOnlineCover }: SaveCandidateOptions = {}): Promise<SavedCandidate> {
  const series = candidateSeries(candidate);
  const probe = await beginSeriesSave(db, { seriesNames: series ? [series.name] : [] });
  const id = await booksRepo.createBookFromCandidate(db, candidate);
  await applyDetectedSeries(db, id, series);
  emit('library-changed');
  void probe.finish(id);
  const count = await booksRepo.countBooks(db);
  const cover = attachCoverFromCandidate(db, id, candidate)
    .then((result) => {
      if (result.status === 'attached') emit('library-changed');
      if (result.status === 'none') onNoOnlineCover?.(id);
      return result;
    })
    .catch(() => null);
  return { id, title: candidate.title, count, cover };
}

/** "Shelved! That's 12 books." (PLAN §8: the book-added trigger). */
export function shelvedMessage(count: number): string {
  return `Shelved! That’s ${count === 1 ? '1 book' : `${count} books`}.`;
}

/** `save(candidate)` with Booky's excited "Shelved! That's N books." */
export function useSaveCandidate(): { save: (candidate: BookCandidate, options?: SaveCandidateOptions) => Promise<SavedCandidate> } {
  const db = useDatabase();
  const { showTip } = useBooky();
  const save = useCallback(
    async (candidate: BookCandidate, options: SaveCandidateOptions = {}) => {
      const saved = await saveCandidate(db, candidate, options);
      if (!options.quiet) showTip({ expression: 'excited', message: shelvedMessage(saved.count) });
      return saved;
    },
    [db, showTip],
  );
  return { save };
}
