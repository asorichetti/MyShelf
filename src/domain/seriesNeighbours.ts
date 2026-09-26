/**
 * A book's place in its series (P04-06): what comes before and after it, for
 * "Previous: …" and "Next: …" on the book detail page. Books are ordered by
 * position, so a 2.5 novella sits between #2 and #3. A neighbour is either a
 * book you own or a whole position you do not ("#6 not on your shelf yet").
 */

export interface PositionedBook {
  id: number;
  title: string;
  position: number | null;
}

export type SeriesNeighbour<B = PositionedBook> =
  | { kind: 'owned'; book: B }
  | { kind: 'missing'; position: number };

export interface SeriesNeighbours<B = PositionedBook> {
  previous: SeriesNeighbour<B> | null;
  next: SeriesNeighbour<B> | null;
}

const numbered = (p: number | null): p is number => p != null && Number.isFinite(p) && p > 0;

/**
 * Neighbours of `bookId` among `books` (any order). `length` is the series'
 * known length (`seriesLength`): past it there is no "next". An unnumbered
 * book, or one not in the list, has no neighbours.
 */
export function neighboursInSeries<B extends PositionedBook>(books: readonly B[], bookId: number, length: number | null): SeriesNeighbours<B> {
  const self = books.find((b) => b.id === bookId);
  if (!self || !numbered(self.position)) return { previous: null, next: null };
  const p = self.position;
  const ordered = books
    .filter((b): b is B & { position: number } => b.id !== bookId && numbered(b.position))
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title) || a.id - b.id);

  // The next whole position after this one (#3 after #2 or #2.5).
  const nextWhole = Math.floor(p) + 1;
  const after = ordered.find((b) => b.position > p);
  let next: SeriesNeighbour<B> | null = null;
  if (after && after.position <= nextWhole) next = { kind: 'owned', book: after };
  else if (length != null && nextWhole <= length) next = { kind: 'missing', position: nextWhole };
  else if (after) next = { kind: 'owned', book: after };

  // The whole position before this one (#2 before #3 or #2.5).
  const prevWhole = Math.ceil(p) - 1;
  const before = [...ordered].reverse().find((b) => b.position < p);
  let previous: SeriesNeighbour<B> | null = null;
  if (before && before.position >= prevWhole) previous = { kind: 'owned', book: before };
  else if (prevWhole >= 1) previous = { kind: 'missing', position: prevWhole };
  else if (before) previous = { kind: 'owned', book: before };

  return { previous, next };
}
