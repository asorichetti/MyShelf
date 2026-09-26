import { seriesGaps, seriesLength, seriesProgress, type SeriesShape } from '@/domain';

const shape = (positions: (number | null)[], totalCount: number | null = null): SeriesShape => ({ positions, totalCount });

describe('seriesGaps', () => {
  it.each<[string, SeriesShape, number[]]>([
    ['empty series', shape([]), []],
    ['only unnumbered books', shape([null, null]), []],
    ['complete run, unknown total', shape([1, 2, 3]), []],
    ['missing middle, unknown total', shape([1, 3]), [2]],
    ['missing start, unknown total', shape([3]), [1, 2]],
    ['unordered input', shape([5, 1, 3]), [2, 4]],
    ['duplicates count once', shape([1, 1, 3]), [2]],
    ['known total adds trailing gaps', shape([1, 2], 5), [3, 4, 5]],
    ['known total with nothing owned', shape([], 3), [1, 2, 3]],
    ['known total with only unnumbered books', shape([null], 2), [1, 2]],
    ['max position beyond total wins', shape([1, 6], 4), [2, 3, 4, 5]],
    ['fractional novella does not fill a gap', shape([1, 2.5, 3]), [2]],
    ['fractional novella implies its whole number', shape([1, 2.5]), [2]],
    ['fractional beyond total extends the run', shape([1, 2, 3.5], 2), [3]],
    ['fractional below 1 is ignored', shape([0.5, 1, 2]), []],
    ['zero and negative positions are ignored', shape([0, -1, 2]), [1]],
    ['non-finite positions are ignored', shape([Number.NaN, Number.POSITIVE_INFINITY, 2]), [1]],
    ['unnumbered books alongside numbered', shape([null, 1, 3, null], 4), [2, 4]],
  ])('%s', (_, input, expected) => {
    expect(seriesGaps(input)).toEqual(expected);
  });
});

describe('seriesLength', () => {
  it.each<[SeriesShape, number | null]>([
    [shape([]), null],
    [shape([null]), null],
    [shape([0.5]), null],
    [shape([2.5]), 2],
    [shape([3], 9), 9],
    [shape([12], 9), 12],
    [shape([], 7), 7],
  ])('%p → %p', (input, expected) => {
    expect(seriesLength(input)).toBe(expected);
  });
});

describe('seriesProgress', () => {
  it.each<[string, SeriesShape, ReturnType<typeof seriesProgress>]>([
    ['nothing known', shape([]), { owned: 0, total: null, gaps: [], maxPosition: null, complete: false }],
    ['unknown total, no gaps, never complete', shape([1, 2, 3]), { owned: 3, total: 3, gaps: [], maxPosition: 3, complete: false }],
    ['Discworld 5 of 9', shape([1, 2, 3, 5, 6], 9), { owned: 5, total: 9, gaps: [4, 7, 8, 9], maxPosition: 6, complete: false }],
    ['novella does not count as owned', shape([1, 1.5, 3], 3), { owned: 2, total: 3, gaps: [2], maxPosition: 3, complete: false }],
    ['duplicates count once', shape([1, 1, 2], 2), { owned: 2, total: 2, gaps: [], maxPosition: 2, complete: true }],
    ['complete with bonus novella', shape([1, 2, 2.5, 3], 3), { owned: 3, total: 3, gaps: [], maxPosition: 3, complete: true }],
    ['fractional max position reported as is', shape([1, 2.5]), { owned: 1, total: 2, gaps: [2], maxPosition: 2.5, complete: false }],
    ['unnumbered books do not count', shape([null, null], 2), { owned: 0, total: 2, gaps: [1, 2], maxPosition: null, complete: false }],
  ])('%s', (_, input, expected) => {
    expect(seriesProgress(input)).toEqual(expected);
  });
});
