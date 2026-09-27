import { useCallback } from 'react';

import { bookCount, useBooky, type BookyEvent } from '@/components/booky';
import { booksRepo, useDatabase, type Db } from '@/db';
import { candidateSeries } from '@/domain';
import { attachCoverFromCandidate, type AttachCoverResult } from '@/features/covers';
import { emit } from '@/features/events';
import { clearPendingLookup } from '@/features/lookup/clearPendingLookup';
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
 * cover. An ISBN waiting in the offline queue leaves it. A cover that cannot be found or fetched leaves the book saved with
 * its generated cover.
 */
export async function saveCandidate(db: Db, candidate: BookCandidate, { onNoOnlineCover }: SaveCandidateOptions = {}): Promise<SavedCandidate> {
  const series = candidateSeries(candidate);
  const probe = await beginSeriesSave(db, { seriesNames: series ? [series.name] : [] });
  const id = await booksRepo.createBookFromCandidate(db, candidate);
  await applyDetectedSeries(db, id, series);
  emit('library-changed');
  // Scanned offline and now saved: its details are no longer waiting (P02-10).
  if (await clearPendingLookup(db, candidate.isbn13)) emit('pending-changed');
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

/** Shelf sizes worth a little extra sparkle from Booky: 10, 50, then every hundred. */
export const isBookMilestone = (count: number) => count === 10 || count === 50 || (count > 0 && count % 100 === 0);

/** Booky's `book-added` event: "Shelved! That's 12 books." (PLAN §8), with a milestone variant. */
export function bookAddedEvent(count: number): BookyEvent {
  return { type: 'book-added', variant: isBookMilestone(count) ? 'milestone' : undefined, vars: { books: bookCount(count) } };
}

/** `save(candidate)` with Booky's excited "Shelved! That's N books." */
export function useSaveCandidate(): { save: (candidate: BookCandidate, options?: SaveCandidateOptions) => Promise<SavedCandidate> } {
  const db = useDatabase();
  const { emit } = useBooky();
  const save = useCallback(
    async (candidate: BookCandidate, options: SaveCandidateOptions = {}) => {
      const saved = await saveCandidate(db, candidate, options);
      if (!options.quiet) void emit(bookAddedEvent(saved.count));
      return saved;
    },
    [db, emit],
  );
  return { save };
}
