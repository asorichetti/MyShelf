import { joinNames } from './book';
import { seriesProgress, type SeriesProgress } from './seriesGaps';
import { formatSeriesPosition } from './seriesPosition';

/**
 * What a save did to a series (P04-07, P04-08): whether it created or
 * revealed a gap (Booky's gap tip) or completed the series (the
 * celebration). Pure: the caller snapshots the series before and after.
 */

/** One series as it stood at a moment. */
export interface SeriesState {
  id: number;
  name: string;
  totalCount: number | null;
  /** Positions of its books (null for unnumbered ones), in any order. */
  positions: (number | null)[];
}

export type SeriesMilestone =
  | { type: 'series-gap'; seriesId: number; seriesName: string; owned: number[]; gaps: number[]; message: string }
  | { type: 'series-complete'; seriesId: number; seriesName: string; total: number; message: string };

const progressOf = (s: SeriesState): SeriesProgress => seriesProgress({ positions: s.positions, totalCount: s.totalCount });

/** Whole positions owned, ascending and distinct. */
export function ownedWholePositions(positions: readonly (number | null)[]): number[] {
  return [...new Set(positions.filter((p): p is number => p != null && Number.isInteger(p) && p > 0))].sort((a, b) => a - b);
}

const hash = (p: number) => `#${formatSeriesPosition(p)}`;

/**
 * "You have #1 and #3 of Discworld — #2 is missing." Long runs are
 * summarised: "You have 6 Discworld books — #3 and #5 are missing."
 */
export function gapTipMessage(name: string, owned: readonly number[], gaps: readonly number[]): string {
  const have = owned.length <= 4 ? `You have ${joinNames(owned.map(hash))} of ${name}` : `You have ${owned.length} ${name} books`;
  const missing =
    gaps.length === 1
      ? `${hash(gaps[0])} is missing.`
      : gaps.length <= 3
        ? `${joinNames(gaps.map(hash))} are missing.`
        : `${gaps.length} are missing, starting with ${hash(gaps[0])}.`;
  return `${have} — ${missing}`;
}

/** "Series complete! All 9 Discworld books." */
export function completionMessage(name: string, total: number): string {
  return total === 1 ? `Series complete! You have the ${name} book.` : `Series complete! All ${total} ${name} books.`;
}

/**
 * Milestones between two snapshots of the same series (`before` is null for
 * a series the save created). A gap tip when the series has gaps and the
 * save created a new one or added a book that shows one up; a celebration
 * when it went from incomplete to complete (so edits that keep it complete
 * do not celebrate again).
 */
export function seriesMilestones(before: SeriesState | null, after: SeriesState | null): SeriesMilestone[] {
  if (!after) return [];
  const was = before ? progressOf(before) : null;
  const now = progressOf(after);
  if (now.complete && now.total != null) {
    return was?.complete ? [] : [{ type: 'series-complete', seriesId: after.id, seriesName: after.name, total: now.total, message: completionMessage(after.name, now.total) }];
  }
  if (!now.gaps.length) return [];
  const newGap = now.gaps.some((g) => !was?.gaps.includes(g));
  const ownedBefore = before ? ownedWholePositions(before.positions) : [];
  const owned = ownedWholePositions(after.positions);
  // Nothing numbered yet (only a total): no "you have #…" to say.
  if (!owned.length) return [];
  const gainedBook = owned.some((p) => !ownedBefore.includes(p)) || after.positions.length > (before?.positions.length ?? 0);
  if (!newGap && !gainedBook) return [];
  return [{ type: 'series-gap', seriesId: after.id, seriesName: after.name, owned, gaps: now.gaps, message: gapTipMessage(after.name, owned, now.gaps) }];
}
