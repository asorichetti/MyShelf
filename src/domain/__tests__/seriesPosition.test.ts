import { formatSeriesLabel, formatSeriesPosition, isValidSeriesPosition, parsePosition, parseSeriesPosition } from '@/domain';

describe('parseSeriesPosition', () => {
  it.each<[string | null | undefined, number | null]>([
    // plain numbers
    ['3', 3],
    [' 3 ', 3],
    ['03', 3],
    ['3.', 3],
    ['3.5', 3.5],
    ['3,5', 3.5],
    ['0.5', 0.5],
    ['2½', 2.5],
    ['2 ½', 2.5],
    // hash and keywords
    ['#3', 3],
    ['# 3', 3],
    ['Book 3', 3],
    ['book3', 3],
    ['BOOK 3', 3],
    ['Bk. 3', 3],
    ['vol. 2', 2],
    ['Vol 2', 2],
    ['Volume 2', 2],
    ['Part 4', 4],
    ['Pt. 4', 4],
    ['No. 7', 7],
    ['Number 7', 7],
    ['Nr. 7', 7],
    ['Tome 2', 2],
    ['T. 2', 2],
    ['Band 3', 3],
    ['Libro 3', 3],
    ['Book #3', 3],
    ['Book 3.5', 3.5],
    // roman numerals
    ['III', 3],
    ['iv', 4],
    ['Part II', 2],
    ['Book XII', 12],
    ['Vol. IX', 9],
    // words
    ['Part Two', 2],
    ['Book Three', 3],
    ['three', 3],
    ['Third', 3],
    // "of N" totals are dropped
    ['Book 3 of 9', 3],
    ['3 of 9', 3],
    ['Book Three of Nine', 3],
    ['3/9', 3],
    // rejected
    ['', null],
    ['   ', null],
    ['Book', null],
    ['#', null],
    ['0', null],
    ['-1', null],
    ['10000', null],
    ['IIII', null],
    ['D', null],
    ['abc', null],
    ['3a', null],
    [null, null],
    [undefined, null],
  ])('%p → %p', (text, expected) => {
    expect(parseSeriesPosition(text)).toBe(expected);
  });

  it('agrees with the metadata parser on bare values', () => {
    for (const s of ['5', '#5', '2.5', '2,5', 'IV', 'xii', 'three', '0', 'mild', '']) {
      expect(parseSeriesPosition(s)).toBe(parsePosition(s));
    }
  });
});

describe('formatSeriesPosition', () => {
  it.each<[number | null | undefined, string]>([
    [5, '5'],
    [5.0, '5'],
    [2.5, '2.5'],
    [0.5, '0.5'],
    [2.25, '2.25'],
    [0.1 + 0.2, '0.3'],
    [2.5000000001, '2.5'],
    [12, '12'],
    [null, ''],
    [undefined, ''],
    [Number.NaN, ''],
  ])('%p → %p', (value, expected) => {
    expect(formatSeriesPosition(value)).toBe(expected);
  });

  it.each([1, 2, 2.5, 3.75, 10, 0.5, 42, 9999])('round-trips %p', (n) => {
    expect(parseSeriesPosition(formatSeriesPosition(n))).toBe(n);
  });
});

describe('formatSeriesLabel', () => {
  it.each<[string, number | null, string]>([
    ['Discworld', 5, 'Discworld #5'],
    ['The Expanse', 2.5, 'The Expanse #2.5'],
    ['Discworld', null, 'Discworld'],
  ])('%p %p → %p', (name, pos, expected) => {
    expect(formatSeriesLabel(name, pos)).toBe(expected);
  });
});

describe('isValidSeriesPosition', () => {
  it.each<[number | null | undefined, boolean]>([
    [1, true],
    [2.5, true],
    [9999, true],
    [0, false],
    [-1, false],
    [10000, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    [null, false],
    [undefined, false],
  ])('%p → %p', (value, expected) => {
    expect(isValidSeriesPosition(value)).toBe(expected);
  });
});
