import { booksRepo, seriesRepo, settingsRepo, type Db } from '@/db';
import { seriesMilestones, type SeriesMilestone, type SeriesState } from '@/domain';

import { addToIdList } from './seriesSettings';

/**
 * Series milestones after a save (P04-07, P04-08): Booky's gap tip ("You
 * have #1 and #3 of Discworld — #2 is missing.", once per series, tip id
 * `series-gap:<seriesId>`) and the completion celebration ("Series complete!
 * All 9 Discworld books.", once per completion).
 *
 * Every path that saves a book calls it the same way:
 *
 *   const probe = await beginSeriesSave(db, { bookId, seriesNames: [draft.seriesName] });
 *   const savedId = await save();
 *   void probe.finish(savedId);
 *
 * The manual form (`useBookForm`) does this today. The scan save path
 * (`src/features/scan/useSaveCandidate.ts`, P03-09) should do the same around
 * its save, after `applyDetectedSeries`.
 *
 * `SeriesEventHost` (root layout) listens and shows the tip or celebration.
 * The Booky rules engine (P07-02) can take over the listening later.
 */

type Listener = (milestone: SeriesMilestone) => void;

const listeners = new Set<Listener>();

/** Listens for series milestones; returns the unsubscribe function. */
export function subscribeSeriesMilestones(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishSeriesMilestone(milestone: SeriesMilestone): void {
  for (const listener of [...listeners]) {
    try {
      listener(milestone);
    } catch (error) {
      console.error(`A ${milestone.type} listener failed`, error);
    }
  }
}

/** Booky's tip id for a series' gap tip. */
export const gapTipId = (seriesId: number) => `series-gap:${seriesId}`;

/**
 * Compares the series before and after a write and publishes what changed,
 * respecting Booky's mode (Off: nothing; Quiet: no gap tips) and showing a
 * gap tip only once per series. Returns what was published.
 */
export async function announceSeriesChanges(db: Db, before: ReadonlyMap<number, SeriesState>, alsoIds: Iterable<number> = []): Promise<SeriesMilestone[]> {
  const after = await seriesRepo.seriesStates(db, [...before.keys(), ...alsoIds]);
  const found = [...after.values()].flatMap((state) => seriesMilestones(before.get(state.id) ?? null, state));
  if (!found.length) return [];
  const mode = await settingsRepo.getSetting(db, 'bookyMode');
  if (mode === 'off') return [];
  const [tipped, muted] = await Promise.all([settingsRepo.getSetting(db, 'series.gapTipSeriesIds'), settingsRepo.getSetting(db, 'mutedTips')]);
  const published: SeriesMilestone[] = [];
  for (const m of found) {
    if (m.type === 'series-gap') {
      if (mode === 'quiet' || tipped.includes(m.seriesId) || muted.includes(gapTipId(m.seriesId))) continue;
      await addToIdList(db, 'series.gapTipSeriesIds', m.seriesId);
    }
    published.push(m);
    publishSeriesMilestone(m);
  }
  return published;
}

/** Snapshots the series a write may touch; `finish` announces what the write changed. */
export interface SeriesSaveProbe {
  /** Call after the write commits, with the saved book's id. Never throws. */
  finish: (savedBookId?: number | null) => Promise<SeriesMilestone[]>;
}

/**
 * Starts watching a book save: snapshots the book's current series and any
 * series named in the draft (matched the way the save will match them). Never
 * throws: if the snapshot fails the save goes ahead without milestones.
 */
export async function beginSeriesSave(db: Db, { bookId, seriesNames = [], seriesIds = [] }: { bookId?: number | null; seriesNames?: string[]; seriesIds?: number[] }): Promise<SeriesSaveProbe> {
  let before: Map<number, SeriesState> | null = null;
  try {
    const ids = [...seriesIds];
    if (bookId != null) {
      const current = await booksRepo.getBook(db, bookId);
      if (current?.seriesId != null) ids.push(current.seriesId);
    }
    for (const name of seriesNames) {
      const match = name.trim() ? await seriesRepo.findSeriesByName(db, name) : null;
      if (match) ids.push(match.id);
    }
    before = await seriesRepo.seriesStates(db, ids);
  } catch (error) {
    console.error('Could not look at the series before saving', error);
  }
  return {
    finish: async (savedBookId) => {
      if (!before) return [];
      try {
        const saved = savedBookId != null ? await booksRepo.getBook(db, savedBookId) : null;
        return await announceSeriesChanges(db, before, saved?.seriesId != null ? [saved.seriesId] : []);
      } catch (error) {
        console.error('Could not check the series after saving', error);
        return [];
      }
    },
  };
}
