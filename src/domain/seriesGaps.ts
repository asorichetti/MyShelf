/**
 * Gaps and progress for a series (P04-01). A series' main sequence is the
 * whole-numbered positions 1…N, where N is the larger of the user's
 * `total_count` and the highest position owned. Fractional positions (a 2.5
 * novella) are bonuses: they neither fill a gap nor count towards "owned",
 * but a 2.5 does imply a #2, so it extends N to 2.
 */

export interface SeriesShape {
  /** Positions of the books in the series; null for unnumbered books. */
  positions: readonly (number | null)[];
  /** How many books the series has, when the user has said. */
  totalCount: number | null;
}

export interface SeriesProgress {
  /** Distinct whole positions owned within 1…total. */
  owned: number;
  /** Length of the main sequence as far as we know it; null when nothing says. */
  total: number | null;
  /** Whole positions from 1…total that no book fills, ascending. */
  gaps: number[];
  /** Highest position owned (fractional ones included), or null. */
  maxPosition: number | null;
  /** True when the total is known from the user and every position is owned. */
  complete: boolean;
}

/** A place in the series: 0 is a prequel (#0), before the main sequence 1…N, like a 0.5. */
const isPosition = (p: number | null): p is number => p != null && Number.isFinite(p) && p >= 0;

/** The main sequence's known length: max(total_count, highest position owned, rounded down). */
export function seriesLength({ positions, totalCount }: SeriesShape): number | null {
  const highest = Math.max(0, ...positions.filter(isPosition).map(Math.floor));
  const length = Math.max(highest, totalCount ?? 0);
  return length > 0 ? length : null;
}

/** Missing whole positions from 1 to `seriesLength`, ascending. */
export function seriesGaps(shape: SeriesShape): number[] {
  const length = seriesLength(shape);
  if (length == null) return [];
  const have = new Set(shape.positions.filter((p): p is number => isPosition(p) && Number.isInteger(p)));
  const gaps: number[] = [];
  for (let i = 1; i <= length; i++) if (!have.has(i)) gaps.push(i);
  return gaps;
}

/** Owned / total / gaps in one pass, for "5 of 9 owned, 2 missing". */
export function seriesProgress(shape: SeriesShape): SeriesProgress {
  const total = seriesLength(shape);
  const gaps = seriesGaps(shape);
  const valid = shape.positions.filter(isPosition);
  return {
    owned: total == null ? 0 : total - gaps.length,
    total,
    gaps,
    maxPosition: valid.length ? Math.max(...valid) : null,
    complete: shape.totalCount != null && total != null && gaps.length === 0,
  };
}
